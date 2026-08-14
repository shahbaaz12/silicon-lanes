import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import { clearInstanceLogs, getInstanceLogs, listManagedInstances, startInstances, stopInstance } from "./docker-manager.js";
import { serviceCatalog } from "./service-catalog.js";

const execFileAsync = promisify(execFile);
const controlPanelDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(controlPanelDirectory, "..");
const lessonDirectory = path.join(repositoryRoot, "Lessons", "lesson-05-hybrid", "nginx");
const gatewayTemplate = path.join(lessonDirectory, "api-gateway.conf.template");
const loadBalancerTemplate = path.join(lessonDirectory, "load-balancer.conf.template");
const proxyParams = path.join(lessonDirectory, "proxy_params");
const lessonLabel = "lesson-05-hybrid";
const gatewayName = "hybridApiGateway1";
const loadBalancerName = "hybridLoadBalancer1";
const gatewayPort = 7512;
const networkName = "silicon-lanes-network";
const logClearTimes = new Map();

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

async function inspectInfrastructure(name, { includeStopped = false } = {}) {
  try {
    const [container] = JSON.parse(await docker(["inspect", name]));
    if (container.Config.Labels?.["com.silicon-lanes.lesson"] !== lessonLabel) {
      throw Object.assign(new Error(`Container name ${name} is already in use.`), { statusCode: 409 });
    }
    if (!includeStopped && !container.State.Running) return null;
    return container;
  } catch (error) {
    if (/No such (object|container)/i.test(error.stderr ?? "")) return null;
    throw error;
  }
}

function idsFromLabel(container, label) {
  return (container?.Config.Labels?.[label] ?? "").split(",").filter(Boolean);
}

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port }, () => server.close(() => resolve(true)));
  });
}

async function waitForHealthy(id, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const status = await docker(["inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", id]);
    if (status === "healthy") return;
    if (["unhealthy", "exited", "dead"].includes(status)) {
      const logs = await docker(["logs", "--tail", "60", id]);
      throw new Error(`${label} failed to start.\n${logs}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready in time.`);
}

async function removeInfrastructure(container) {
  if (!container) return;
  await docker(["rm", "--force", container.Id]);
  logClearTimes.delete(container.Id);
}

async function ensureServices(previousIds = [], previousOwnedIds = []) {
  const available = await listManagedInstances();
  const selected = [];
  const ownedIds = new Set(previousOwnedIds);
  const requirements = [
    { service: serviceCatalog.user, count: 1 },
    { service: serviceCatalog.order, count: 1 },
    { service: serviceCatalog.catalog, count: 2 }
  ];

  for (const requirement of requirements) {
    const preferred = previousIds
      .map((id) => available.find((instance) => instance.id === id && instance.serviceKey === requirement.service.key))
      .filter(Boolean);
    const candidates = available.filter((instance) => instance.serviceKey === requirement.service.key);
    const matches = [];
    for (const instance of [...preferred, ...candidates]) {
      if (matches.length === requirement.count) break;
      if (!matches.some(({ id }) => id === instance.id)) matches.push(instance);
    }
    if (matches.length < requirement.count) {
      const started = await startInstances(requirement.service, requirement.count - matches.length);
      matches.push(...started);
      started.forEach(({ id }) => ownedIds.add(id));
    }
    selected.push(...matches);
  }

  return {
    services: selected,
    ownedIds: [...ownedIds].filter((id) => selected.some((service) => service.id === id))
  };
}

async function startLoadBalancer(catalogs) {
  const id = await docker([
    "run", "--detach",
    "--name", loadBalancerName,
    "--hostname", loadBalancerName,
    "--network", networkName,
    "--label", `com.silicon-lanes.lesson=${lessonLabel}`,
    "--label", `com.silicon-lanes.backend-ids=${catalogs.map(({ id: backendId }) => backendId).join(",")}`,
    "--env", `CATALOG_1=${catalogs[0].name}:${catalogs[0].containerPort}`,
    "--env", `CATALOG_2=${catalogs[1].name}:${catalogs[1].containerPort}`,
    "--mount", `type=bind,source=${loadBalancerTemplate},target=/etc/nginx/templates/default.conf.template,readonly`,
    "--health-cmd", "wget -q -O - http://127.0.0.1/hybrid-lb-health >/dev/null || exit 1",
    "--health-interval", "2s", "--health-timeout", "3s", "--health-retries", "20",
    "nginx:1.27-alpine"
  ], { timeout: 5 * 60 * 1000 });
  await waitForHealthy(id, "Hybrid Load Balancer");
  return inspectInfrastructure(loadBalancerName);
}

async function startGateway(user, order, loadBalancer, services, ownedIds) {
  if (!await portIsAvailable(gatewayPort)) {
    throw Object.assign(new Error(`Port ${gatewayPort} is already in use.`), { statusCode: 409 });
  }
  const id = await docker([
    "run", "--detach",
    "--name", gatewayName,
    "--hostname", gatewayName,
    "--network", networkName,
    "--label", `com.silicon-lanes.lesson=${lessonLabel}`,
    "--label", `com.silicon-lanes.backend-ids=${services.map(({ id: backendId }) => backendId).join(",")}`,
    "--label", `com.silicon-lanes.owned-backend-ids=${ownedIds.join(",")}`,
    "--label", `com.silicon-lanes.load-balancer-id=${loadBalancer.Id}`,
    "--publish", `127.0.0.1:${gatewayPort}:80`,
    "--env", `USER_UPSTREAM=${user.name}:${user.containerPort}`,
    "--env", `ORDER_UPSTREAM=${order.name}:${order.containerPort}`,
    "--env", `CATALOG_LB_UPSTREAM=${loadBalancerName}:80`,
    "--mount", `type=bind,source=${gatewayTemplate},target=/etc/nginx/templates/default.conf.template,readonly`,
    "--mount", `type=bind,source=${proxyParams},target=/etc/nginx/hybrid_proxy_params,readonly`,
    "--health-cmd", "wget -q -O - http://127.0.0.1/hybrid-gateway-health >/dev/null || exit 1",
    "--health-interval", "2s", "--health-timeout", "3s", "--health-retries", "20",
    "nginx:1.27-alpine"
  ], { timeout: 5 * 60 * 1000 });
  await waitForHealthy(id, "Hybrid API Gateway");
  return inspectInfrastructure(gatewayName);
}

async function stateFrom(gateway, loadBalancer) {
  if (!gateway || !loadBalancer) {
    return { running: false, ready: false, gateway: null, loadBalancer: null, services: [], routes: hybridRoutes([]) };
  }
  const instances = await listManagedInstances();
  const backendIds = idsFromLabel(gateway, "com.silicon-lanes.backend-ids");
  const ownedIds = new Set(idsFromLabel(gateway, "com.silicon-lanes.owned-backend-ids"));
  const services = backendIds
    .map((id) => instances.find((instance) => instance.id === id))
    .filter(Boolean)
    .map((instance) => ({ ...instance, ownedByLesson: ownedIds.has(instance.id) }));
  return {
    running: Boolean(gateway.State.Running && loadBalancer.State.Running),
    ready: services.filter(({ serviceKey }) => serviceKey === "catalog").length === 2
      && services.some(({ serviceKey }) => serviceKey === "user")
      && services.some(({ serviceKey }) => serviceKey === "order"),
    gateway: { name: gatewayName, hostPort: gatewayPort, containerPort: 80, baseUrl: `http://127.0.0.1:${gatewayPort}` },
    loadBalancer: { name: loadBalancerName, containerPort: 80 },
    services,
    routes: hybridRoutes(services)
  };
}

function hybridRoutes(services) {
  return [
    { key: "user", name: "Users", path: "/api/users", via: "direct", instances: services.filter(({ serviceKey }) => serviceKey === "user") },
    { key: "catalog", name: "Products", path: "/api/products", via: "load-balancer", instances: services.filter(({ serviceKey }) => serviceKey === "catalog") },
    { key: "order", name: "Orders", path: "/api/orders", via: "direct", instances: services.filter(({ serviceKey }) => serviceKey === "order") }
  ];
}

export async function getHybridLessonState() {
  try {
    return stateFrom(await inspectInfrastructure(gatewayName), await inspectInfrastructure(loadBalancerName));
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function startHybridLesson() {
  try {
    const currentGateway = await inspectInfrastructure(gatewayName);
    const currentLoadBalancer = await inspectInfrastructure(loadBalancerName);
    const currentState = await stateFrom(currentGateway, currentLoadBalancer);
    if (currentState.ready) return currentState;

    const oldGateway = await inspectInfrastructure(gatewayName, { includeStopped: true });
    const oldLoadBalancer = await inspectInfrastructure(loadBalancerName, { includeStopped: true });
    const previousIds = idsFromLabel(oldGateway, "com.silicon-lanes.backend-ids");
    const previousOwnedIds = idsFromLabel(oldGateway, "com.silicon-lanes.owned-backend-ids");
    await removeInfrastructure(oldGateway);
    await removeInfrastructure(oldLoadBalancer);

    const pool = await ensureServices(previousIds, previousOwnedIds);
    const user = pool.services.find(({ serviceKey }) => serviceKey === "user");
    const order = pool.services.find(({ serviceKey }) => serviceKey === "order");
    const catalogs = pool.services.filter(({ serviceKey }) => serviceKey === "catalog");
    const loadBalancer = await startLoadBalancer(catalogs);
    const gateway = await startGateway(user, order, loadBalancer, pool.services, pool.ownedIds);
    await Promise.all(pool.services.map(({ id }) => clearInstanceLogs(id)));
    return stateFrom(gateway, loadBalancer);
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function stopHybridLesson() {
  try {
    const gateway = await inspectInfrastructure(gatewayName, { includeStopped: true });
    const loadBalancer = await inspectInfrastructure(loadBalancerName, { includeStopped: true });
    const ownedIds = idsFromLabel(gateway, "com.silicon-lanes.owned-backend-ids");
    await removeInfrastructure(gateway);
    await removeInfrastructure(loadBalancer);
    const runningIds = new Set((await listManagedInstances()).map(({ id }) => id));
    for (const id of ownedIds) if (runningIds.has(id)) await stopInstance(id);
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

function parseLogs(output, pattern, clearTime, format) {
  return output.split(/\r?\n/).map((line) => line.match(pattern)).filter(Boolean)
    .filter((match) => !clearTime || Date.parse(match[1]) > clearTime).map(format);
}

export async function getHybridLessonLogs() {
  try {
    const gateway = await inspectInfrastructure(gatewayName);
    const loadBalancer = await inspectInfrastructure(loadBalancerName);
    if (!gateway || !loadBalancer) return { gatewayLogs: "Start Lesson 5.", loadBalancerLogs: "Start Lesson 5.", serviceLogs: [] };
    const [gatewayOutput, loadBalancerOutput] = await Promise.all([
      docker(["logs", "--tail", "200", gateway.Id]), docker(["logs", "--tail", "200", loadBalancer.Id])
    ]);
    const gatewayLines = parseLogs(gatewayOutput, /^\[hybrid-gw\]\s+(\S+)\s+([A-Z]+)\s+(\S+)\s+(\d+)\s+service=(\S+)\s+server=(\S+)$/, logClearTimes.get(gateway.Id),
      (match) => `${match[1]}  ${match[2]}  ${match[3]}  → ${match[5]} / ${match[6]}`);
    const loadBalancerLines = parseLogs(loadBalancerOutput, /^\[hybrid-lb\]\s+(\S+)\s+([A-Z]+)\s+(\S+)\s+(\d+)\s+server=(\S+)$/, logClearTimes.get(loadBalancer.Id),
      (match) => `${match[1]}  ${match[2]}  ${match[3]}  → ${match[5]}`);
    const state = await stateFrom(gateway, loadBalancer);
    const serviceLogs = await Promise.all(state.services.map(async (service) => ({
      serviceKey: service.serviceKey, name: service.name, logs: await getInstanceLogs(service.id)
    })));
    return {
      gatewayLogs: gatewayLines.length ? gatewayLines.slice(-30).join("\n") : "No gateway requests yet.",
      loadBalancerLogs: loadBalancerLines.length ? loadBalancerLines.slice(-30).join("\n") : "No Catalog requests yet.",
      serviceLogs
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function clearHybridLessonLogs() {
  try {
    const gateway = await inspectInfrastructure(gatewayName);
    const loadBalancer = await inspectInfrastructure(loadBalancerName);
    if (!gateway || !loadBalancer) return;
    logClearTimes.set(gateway.Id, Date.now());
    logClearTimes.set(loadBalancer.Id, Date.now());
    const state = await stateFrom(gateway, loadBalancer);
    await Promise.all(state.services.map(({ id }) => clearInstanceLogs(id)));
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}
