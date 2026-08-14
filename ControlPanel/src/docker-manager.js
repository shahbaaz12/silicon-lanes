import path from "node:path";
import { serviceCatalog } from "./service-catalog.js";
import {
  docker,
  friendlyDockerError,
  portIsAvailable,
  repositoryRoot
} from "./infrastructure/docker-client.js";
const applicationServicesDirectory = path.join(repositoryRoot, "Application", "services");
const managedLabel = "com.silicon-lanes.managed=true";
const networkName = "silicon-lanes-network";
const postgresContainerName = "silicon-lanes-postgres";
const postgresVolumeName = "silicon-lanes-postgres-data";
const postgresPassword = process.env.SILICON_LANES_DATABASE_PASSWORD ?? "silicon_lanes";
const logClearTimes = new Map();

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

async function ensureNetwork() {
  try {
    await docker(["network", "inspect", networkName]);
  } catch (error) {
    if (!/(No such network|network .* not found)/i.test(error.stderr ?? "")) throw error;
    await docker(["network", "create", networkName]);
  }
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = await docker([
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      postgresContainerName
    ]);
    if (status === "healthy") return;
    if (status === "exited" || status === "dead") {
      throw new Error("The Silicon Lanes PostgreSQL container stopped unexpectedly.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("PostgreSQL did not become ready in time.");
}

async function ensurePostgres() {
  await ensureNetwork();
  try {
    const state = await docker(["inspect", "--format", "{{.State.Running}}", postgresContainerName]);
    if (state !== "true") await docker(["start", postgresContainerName]);
  } catch (error) {
    if (!/No such (object|container)/i.test(error.stderr ?? "")) throw error;
    await docker([
      "run",
      "--detach",
      "--name",
      postgresContainerName,
      "--network",
      networkName,
      "--label",
      "com.silicon-lanes.infrastructure=postgres",
      "--env",
      `POSTGRES_PASSWORD=${postgresPassword}`,
      "--volume",
      `${postgresVolumeName}:/var/lib/postgresql/data`,
      "--health-cmd",
      "pg_isready -U postgres",
      "--health-interval",
      "2s",
      "--health-timeout",
      "3s",
      "--health-retries",
      "20",
      "postgres:17-alpine"
    ]);
  }

  await waitForPostgres();
  for (const databaseName of new Set(Object.values(serviceCatalog).map(({ database }) => database))) {
    const exists = await docker([
      "exec",
      postgresContainerName,
      "psql",
      "--username",
      "postgres",
      "--tuples-only",
      "--no-align",
      "--command",
      `SELECT 1 FROM pg_database WHERE datname = '${databaseName}'`
    ]);
    if (exists !== "1") {
      await docker(["exec", postgresContainerName, "createdb", "--username", "postgres", databaseName]);
    }
  }
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

async function waitForServiceContainer(id, name) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = await docker([
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      id
    ]);
    if (status === "healthy") return;
    if (status === "unhealthy" || status === "exited" || status === "dead") {
      const logs = await docker(["logs", "--tail", "30", id]);
      throw new Error(`${name} failed to start.\n${logs}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${name} did not become ready in time.`);
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
    await ensurePostgres();
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
        "--network",
        networkName,
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
        "--env",
        `DATABASE_HOST=${postgresContainerName}`,
        "--env",
        "DATABASE_PORT=5432",
        "--env",
        "DATABASE_USER=postgres",
        "--env",
        `DATABASE_PASSWORD=${postgresPassword}`,
        "--env",
        `DATABASE_NAME=${service.database}`,
        "--env",
        `INSTANCE_NAME=${name}`,
        service.image
      ]);
      await waitForServiceContainer(id, name);
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
    logClearTimes.delete(instance.id);
    return instance;
  } catch (error) {
    throw friendlyDockerError(error);
  }
}

export async function stopServiceInstances(serviceKey) {
  const instances = (await listManagedInstances({ includeStopped: true }))
    .filter((instance) => instance.serviceKey === serviceKey);
  if (!instances.length) return [];

  try {
    await docker(["rm", "--force", ...instances.map(({ id }) => id)]);
    for (const instance of instances) logClearTimes.delete(instance.id);
    return instances;
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
      .filter((match) => {
        const clearTime = logClearTimes.get(instance.id);
        return !clearTime || Date.parse(match[1]) > clearTime;
      })
      .map((match) => `${match[1]}  ${match[2]}  ${match[3]}`);
    return requestLines.length ? requestLines.slice(-30).join("\n") : "No requests received yet.";
  } catch (error) {
    throw friendlyDockerError(error);
  }
}

export async function clearInstanceLogs(id) {
  const instance = await requireManagedContainer(id);
  logClearTimes.set(instance.id, Date.now());
  return instance;
}
