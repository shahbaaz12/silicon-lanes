import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import {
  clearInstanceLogs,
  getInstanceLogs,
  listManagedInstances,
  startInstances,
  stopInstance
} from "./docker-manager.js";
import { serviceCatalog } from "./service-catalog.js";

const execFileAsync = promisify(execFile);
const controlPanelDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(controlPanelDirectory, "..");
const nginxTemplate = path.join(repositoryRoot, "Lessons", "lesson-03-l7-load-balancer", "nginx", "default.conf.template");
const catalog = serviceCatalog.catalog;
const loadBalancerName = "loadBalancer1";
const loadBalancerPort = 7312;
const poolSize = 3;
const networkName = "silicon-lanes-network";
const lessonLabel = "lesson-03-l7-load-balancer";
const loadBalancerLogClearTimes = new Map();

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

function idsFromLabel(container, name) {
  return (container?.Config.Labels?.[name] ?? "").split(",").filter(Boolean);
}

async function inspectLoadBalancer({ includeStopped = false } = {}) {
  try {
    const [container] = JSON.parse(await docker(["inspect", loadBalancerName]));
    if (container.Config.Labels?.["com.silicon-lanes.lesson"] !== lessonLabel) {
      throw Object.assign(new Error(`Container name ${loadBalancerName} is already in use.`), { statusCode: 409 });
    }
    if (!includeStopped && !container.State.Running) return null;
    return container;
  } catch (error) {
    if (/No such (object|container)/i.test(error.stderr ?? "")) return null;
    throw error;
  }
}

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port }, () => server.close(() => resolve(true)));
  });
}

async function waitForLoadBalancer(id) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = await docker([
      "inspect", "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      id
    ]);
    if (status === "healthy") return;
    if (["unhealthy", "exited", "dead"].includes(status)) {
      const logs = await docker(["logs", "--tail", "40", id]);
      throw new Error(`L7 Load Balancer failed to start.\n${logs}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("L7 Load Balancer did not become ready in time.");
}

async function removeLoadBalancer(container) {
  if (!container) return;
  await docker(["rm", "--force", container.Id]);
  loadBalancerLogClearTimes.delete(container.Id);
}

async function catalogInstances() {
  return (await listManagedInstances())
    .filter((instance) => instance.serviceKey === catalog.key)
    .sort((left, right) => left.sequence - right.sequence);
}

async function ensurePool(preferredIds = [], previouslyOwnedIds = []) {
  const available = await catalogInstances();
  const preferred = preferredIds
    .map((id) => available.find((instance) => instance.id === id))
    .filter(Boolean);
  const selected = [...preferred];
  for (const instance of available) {
    if (selected.length === poolSize) break;
    if (!selected.some(({ id }) => id === instance.id)) selected.push(instance);
  }

  const ownedIds = new Set(previouslyOwnedIds.filter((id) => selected.some((instance) => instance.id === id)));
  if (selected.length < poolSize) {
    const started = await startInstances(catalog, poolSize - selected.length);
    selected.push(...started);
    started.forEach(({ id }) => ownedIds.add(id));
  }
  return { backends: selected.slice(0, poolSize), ownedIds: [...ownedIds] };
}

async function startLoadBalancerContainer(backends, ownedIds) {
  if (!await portIsAvailable(loadBalancerPort)) {
    throw Object.assign(new Error(`Port ${loadBalancerPort} is already in use.`), { statusCode: 409 });
  }
  const args = [
    "run", "--detach",
    "--name", loadBalancerName,
    "--hostname", loadBalancerName,
    "--network", networkName,
    "--label", `com.silicon-lanes.lesson=${lessonLabel}`,
    "--label", `com.silicon-lanes.backend-ids=${backends.map(({ id }) => id).join(",")}`,
    "--label", `com.silicon-lanes.backend-specs=${backends.map(({ name, containerPort }) => `${name}:${containerPort}`).join(";")}`,
    "--label", `com.silicon-lanes.owned-backend-ids=${ownedIds.join(",")}`,
    "--publish", `127.0.0.1:${loadBalancerPort}:80`,
    "--mount", `type=bind,source=${nginxTemplate},target=/etc/nginx/templates/default.conf.template,readonly`,
    "--health-cmd", "wget -q -O - http://127.0.0.1/lb-health >/dev/null || exit 1",
    "--health-interval", "2s",
    "--health-timeout", "3s",
    "--health-retries", "20"
  ];
  backends.forEach((backend, index) => args.push("--env", `CATALOG_${index + 1}=${backend.name}:${backend.containerPort}`));
  args.push("nginx:1.27-alpine");
  const id = await docker(args, { timeout: 5 * 60 * 1000 });
  await waitForLoadBalancer(id);
  return inspectLoadBalancer();
}

async function stateFrom(container) {
  if (!container) return {
    running: false,
    poolSize,
    needsRepair: false,
    loadBalancer: null,
    configuredBackends: [],
    services: []
  };
  const backendIds = idsFromLabel(container, "com.silicon-lanes.backend-ids");
  const ownedIds = new Set(idsFromLabel(container, "com.silicon-lanes.owned-backend-ids"));
  const instances = await listManagedInstances();
  const services = backendIds
    .map((id) => instances.find((instance) => instance.id === id))
    .filter(Boolean)
    .map((instance) => ({ ...instance, ownedByLesson: ownedIds.has(instance.id) }));
  return {
    running: Boolean(container.State.Running),
    poolSize,
    needsRepair: services.length < poolSize,
    loadBalancer: {
      id: container.Id,
      name: loadBalancerName,
      hostPort: loadBalancerPort,
      containerPort: 80,
      directUrl: `http://127.0.0.1:${loadBalancerPort}/api/products`
    },
    configuredBackends: (container.Config.Labels?.["com.silicon-lanes.backend-specs"] ?? "").split(";").filter(Boolean),
    services
  };
}

export async function getL7LoadBalancerLessonState() {
  try {
    return stateFrom(await inspectLoadBalancer());
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function startL7LoadBalancerLesson() {
  try {
    const running = await inspectLoadBalancer();
    const runningState = await stateFrom(running);
    if (runningState.running && !runningState.needsRepair) return runningState;

    const old = await inspectLoadBalancer({ includeStopped: true });
    const preferredIds = idsFromLabel(old, "com.silicon-lanes.backend-ids");
    const ownedIds = idsFromLabel(old, "com.silicon-lanes.owned-backend-ids");
    if (old) await removeLoadBalancer(old);
    const pool = await ensurePool(preferredIds, ownedIds);
    const loadBalancer = await startLoadBalancerContainer(pool.backends, pool.ownedIds);
    await Promise.all(pool.backends.map(({ id }) => clearInstanceLogs(id)));
    return stateFrom(loadBalancer);
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function stopL7LoadBalancerLesson() {
  try {
    const loadBalancer = await inspectLoadBalancer({ includeStopped: true });
    if (!loadBalancer) return;
    const ownedIds = idsFromLabel(loadBalancer, "com.silicon-lanes.owned-backend-ids");
    await removeLoadBalancer(loadBalancer);
    const runningIds = new Set((await listManagedInstances()).map(({ id }) => id));
    for (const id of ownedIds) {
      if (runningIds.has(id)) await stopInstance(id);
    }
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function killL7LoadBalancerBackend(id) {
  try {
    const loadBalancer = await inspectLoadBalancer();
    if (!loadBalancer || !idsFromLabel(loadBalancer, "com.silicon-lanes.backend-ids").includes(id)) {
      throw Object.assign(new Error("Catalog replica is not part of this lesson pool."), { statusCode: 404 });
    }
    await stopInstance(id);
    return stateFrom(loadBalancer);
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function getL7LoadBalancerLessonLogs() {
  try {
    const loadBalancer = await inspectLoadBalancer();
    if (!loadBalancer) return { loadBalancerLogs: "Start the lesson to see L7 Load Balancer requests.", serviceLogs: [] };
    const output = await docker(["logs", "--tail", "240", loadBalancer.Id]);
    const clearTime = loadBalancerLogClearTimes.get(loadBalancer.Id);
    const lines = output.split(/\r?\n/)
      .map((line) => line.match(/^\[lb\]\s+(\S+)\s+([A-Z]+)\s+(\S+)\s+(\d+)\s+server=(\S+)$/))
      .filter(Boolean)
      .filter((match) => !clearTime || Date.parse(match[1]) > clearTime)
      .map((match) => `${match[1]}  ${match[2]}  ${match[3]}  ${match[4]}  → ${match[5]}`);
    const state = await stateFrom(loadBalancer);
    const serviceLogs = await Promise.all(state.services.map(async (service) => ({
      id: service.id,
      name: service.name,
      logs: await getInstanceLogs(service.id)
    })));
    return {
      loadBalancerLogs: lines.length ? lines.slice(-40).join("\n") : "No load-balanced requests received yet.",
      serviceLogs
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function clearL7LoadBalancerLessonLogs() {
  try {
    const loadBalancer = await inspectLoadBalancer();
    if (!loadBalancer) return;
    loadBalancerLogClearTimes.set(loadBalancer.Id, Date.now());
    const state = await stateFrom(loadBalancer);
    await Promise.all(state.services.map(({ id }) => clearInstanceLogs(id)));
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}
