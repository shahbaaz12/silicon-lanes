import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import { serviceCatalog } from "./service-catalog.js";

const execFileAsync = promisify(execFile);
const controlPanelDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(controlPanelDirectory, "..");
const applicationServicesDirectory = path.join(repositoryRoot, "Application", "services");
const databaseDirectory = path.join(repositoryRoot, "Database");
const managedLabel = "com.silicon-lanes.managed=true";

async function docker(args, options = {}) {
  const result = await execFileAsync("docker", args, {
    cwd: repositoryRoot,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    ...options
  });
  return result.stdout.trim();
}

function friendlyDockerError(error) {
  const message = error.stderr?.trim() || error.message;
  if (/cannot connect|pipe\/docker|daemon is not running/i.test(message)) {
    return Object.assign(new Error("Docker Desktop is not running."), { statusCode: 503 });
  }
  return Object.assign(new Error(message), { statusCode: 500 });
}

function inspectToInstance(container) {
  const labels = container.Config.Labels ?? {};
  const serviceKey = labels["com.silicon-lanes.service"];
  const service = serviceCatalog[serviceKey];
  if (!service) return null;

  const binding = container.NetworkSettings.Ports?.[`${service.containerPort}/tcp`]?.[0];
  const sequence = Number(labels["com.silicon-lanes.sequence"]);
  const instanceName = labels["com.silicon-lanes.instance-name"] ?? `${service.key}Service${sequence}`;
  return {
    id: container.Id,
    shortId: container.Id.slice(0, 12),
    name: instanceName,
    serviceKey,
    sequence,
    state: container.State.Running ? "running" : container.State.Status,
    running: container.State.Running,
    hostPort: binding ? Number(binding.HostPort) : null,
    containerPort: service.containerPort,
    startedAt: container.State.StartedAt
  };
}

export async function listManagedInstances({ includeStopped = false } = {}) {
  try {
    const idsOutput = await docker([
      "ps",
      "--all",
      "--filter",
      `label=${managedLabel}`,
      "--format",
      "{{.ID}}"
    ]);
    const ids = idsOutput.split(/\r?\n/).filter(Boolean);
    if (!ids.length) return [];
    const inspected = JSON.parse(await docker(["inspect", ...ids]));
    return inspected
      .map(inspectToInstance)
      .filter(Boolean)
      .filter((instance) => includeStopped || instance.running)
      .sort((left, right) => left.hostPort - right.hostPort);
  } catch (error) {
    throw friendlyDockerError(error);
  }
}

async function buildImage(service) {
  try {
    await docker([
      "build",
      "--tag",
      service.image,
      path.join(applicationServicesDirectory, service.folder)
    ], { timeout: 10 * 60 * 1000 });
  } catch (error) {
    throw friendlyDockerError(error);
  }
}

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function nextSlot(service, existing) {
  const occupiedSequences = new Set(
    existing.filter((instance) => instance.serviceKey === service.key && instance.running)
      .map((instance) => instance.sequence)
  );

  for (let sequence = 1; sequence <= 100; sequence += 1) {
    const hostPort = service.basePort + sequence - 1;
    if (!occupiedSequences.has(sequence) && await portIsAvailable(hostPort)) {
      return { sequence, hostPort };
    }
  }
  throw Object.assign(new Error(`No available ${service.name} port was found.`), { statusCode: 409 });
}

async function removeStoppedContainer(name) {
  try {
    const status = await docker(["inspect", "--format", "{{.State.Running}}", name]);
    if (status === "true") {
      throw Object.assign(new Error(`Container ${name} is already running.`), { statusCode: 409 });
    }
    await docker(["rm", name]);
  } catch (error) {
    if (error.statusCode === 409) throw error;
    if (!/No such (object|container)/i.test(error.stderr ?? "")) throw error;
  }
}

export async function startInstances(service, count) {
  try {
    await buildImage(service);
    const started = [];
    let existing = await listManagedInstances({ includeStopped: true });

    for (let index = 0; index < count; index += 1) {
      const { sequence, hostPort } = await nextSlot(service, existing);
      const name = `${service.key}Service${sequence}`;
      await removeStoppedContainer(name);
      const id = await docker([
        "run",
        "--detach",
        "--name",
        name,
        "--hostname",
        name,
        "--label",
        managedLabel,
        "--label",
        `com.silicon-lanes.service=${service.key}`,
        "--label",
        `com.silicon-lanes.sequence=${sequence}`,
        "--label",
        `com.silicon-lanes.instance-name=${name}`,
        "--publish",
        `127.0.0.1:${hostPort}:${service.containerPort}`,
        "--mount",
        `type=bind,source=${databaseDirectory},target=/data`,
        "--env",
        `DATABASE_PATH=/data/${service.database}-${sequence}.db`,
        "--env",
        `INSTANCE_NAME=${name}`,
        service.image
      ]);
      const instance = {
        id,
        shortId: id.slice(0, 12),
        name,
        serviceKey: service.key,
        sequence,
        state: "running",
        running: true,
        hostPort,
        containerPort: service.containerPort
      };
      started.push(instance);
      existing.push(instance);
    }
    return started;
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

async function requireManagedContainer(id) {
  const instances = await listManagedInstances({ includeStopped: true });
  const instance = instances.find((candidate) => candidate.id === id || candidate.shortId === id);
  if (!instance) {
    throw Object.assign(new Error("Managed service instance not found."), { statusCode: 404 });
  }
  return instance;
}

export async function stopInstance(id) {
  const instance = await requireManagedContainer(id);
  try {
    await docker(["rm", "--force", instance.id]);
    return instance;
  } catch (error) {
    throw friendlyDockerError(error);
  }
}

export async function getInstanceLogs(id) {
  const instance = await requireManagedContainer(id);
  try {
    const output = await docker(["logs", "--tail", "200", instance.id]);
    const requestLines = output
      .split(/\r?\n/)
      .map((line) => line.match(/^\[request\]\s+(\S+)\s+([A-Z]+)\s+(\S+)$/))
      .filter(Boolean)
      .map((match) => `${match[1]}  ${match[2]}  ${match[3]}`);
    return requestLines.length ? requestLines.slice(-30).join("\n") : "No requests received yet.";
  } catch (error) {
    throw friendlyDockerError(error);
  }
}

export async function requestInstance(id) {
  const instance = await requireManagedContainer(id);
  if (!instance.running || !instance.hostPort) {
    throw Object.assign(new Error("The service instance is not running."), { statusCode: 409 });
  }

  let response;
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${instance.hostPort}/health`);
      break;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!response) {
    throw Object.assign(new Error(`The instance is still starting: ${lastError?.message}`), { statusCode: 503 });
  }

  const body = await response.json();
  const logs = await getInstanceLogs(instance.id);
  return {
    statusCode: response.status,
    requestUrl: `http://localhost:${instance.hostPort}/health`,
    body,
    logs
  };
}
