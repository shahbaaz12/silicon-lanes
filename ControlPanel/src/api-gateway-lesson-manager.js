import path from "node:path";
import {
  clearInstanceLogs,
  getInstanceLogs,
  listManagedInstances,
  startInstances,
  stopInstance
} from "./docker-manager.js";
import { serviceCatalog } from "./service-catalog.js";
import { docker, friendlyDockerError, idsFromLabel, inspectLessonContainer, portIsAvailable, repositoryRoot, waitForHealthy } from "./infrastructure/docker-client.js";
const nginxTemplate = path.join(repositoryRoot, "Lessons", "lesson-04-api-gateway", "nginx", "default.conf.template");
const nginxProxyParams = path.join(repositoryRoot, "Lessons", "lesson-04-api-gateway", "nginx", "proxy_params");
const services = Object.values(serviceCatalog);
const gatewayName = "apiGateway1";
const gatewayPort = 7412;
const gatewayImage = "nginx:1.27-alpine";
const networkName = "silicon-lanes-network";
const lessonLabel = "lesson-04-api-gateway";
const gatewayLogClearTimes = new Map();
const routePaths = Object.freeze({
  user: "/api/users",
  catalog: "/api/products",
  inventory: "/api/inventory",
  cart: "/api/carts/1",
  order: "/api/orders",
  payment: "/api/payments"
});

function backendLabel(key) {
  return `com.silicon-lanes.backend-${key}-id`;
}

async function inspectGateway({ includeStopped = false } = {}) {
  return inspectLessonContainer({ name: gatewayName, lessonLabel, includeStopped });
}

async function waitForGateway(id) {
  return waitForHealthy(id, "API Gateway");
}

async function removeGateway(container) {
  if (!container) return;
  await docker(["rm", "--force", container.Id]);
  gatewayLogClearTimes.delete(container.Id);
}

async function ensureBackends(preferredIds = {}, previouslyOwnedIds = []) {
  const available = await listManagedInstances();
  const ownedIds = new Set(previouslyOwnedIds);
  const backends = [];

  for (const service of services) {
    let backend = available.find((instance) => instance.id === preferredIds[service.key]);
    backend ??= available.find((instance) => instance.serviceKey === service.key);
    if (!backend) {
      [backend] = await startInstances(service, 1);
      ownedIds.add(backend.id);
      available.push(backend);
    }
    backends.push(backend);
  }

  return {
    backends,
    ownedIds: [...ownedIds].filter((id) => backends.some((backend) => backend.id === id))
  };
}

async function startGatewayContainer(backends, ownedIds) {
  if (!await portIsAvailable(gatewayPort)) {
    throw Object.assign(new Error(`Port ${gatewayPort} is already in use.`), { statusCode: 409 });
  }

  const args = [
    "run", "--detach",
    "--name", gatewayName,
    "--hostname", gatewayName,
    "--network", networkName,
    "--label", `com.silicon-lanes.lesson=${lessonLabel}`,
    "--label", `com.silicon-lanes.owned-backend-ids=${ownedIds.join(",")}`,
    "--publish", `127.0.0.1:${gatewayPort}:80`,
    "--mount", `type=bind,source=${nginxTemplate},target=/etc/nginx/templates/default.conf.template,readonly`,
    "--mount", `type=bind,source=${nginxProxyParams},target=/etc/nginx/proxy_params,readonly`,
    "--health-cmd", "wget -q -O - http://127.0.0.1/gateway-health >/dev/null || exit 1",
    "--health-interval", "2s",
    "--health-timeout", "3s",
    "--health-retries", "20"
  ];

  for (const backend of backends) {
    args.push("--label", `${backendLabel(backend.serviceKey)}=${backend.id}`);
    args.push("--env", `${backend.serviceKey.toUpperCase()}_UPSTREAM=${backend.name}:${backend.containerPort}`);
  }
  args.push(gatewayImage);

  const id = await docker(args, { timeout: 5 * 60 * 1000 });
  await waitForGateway(id);
  return inspectGateway();
}

async function stateFrom(container) {
  if (!container) {
    return {
      running: false,
      ready: false,
      needsRepair: false,
      gateway: null,
      routes: services.map((service) => ({
        serviceKey: service.key,
        serviceName: service.name,
        path: routePaths[service.key],
        method: "GET",
        instance: null
      })),
      services: []
    };
  }

  const instances = await listManagedInstances();
  const ownedIds = new Set(idsFromLabel(container, "com.silicon-lanes.owned-backend-ids"));
  const backends = services
    .map((service) => instances.find((instance) => instance.id === container.Config.Labels?.[backendLabel(service.key)]))
    .filter(Boolean)
    .map((instance) => ({ ...instance, ownedByLesson: ownedIds.has(instance.id) }));
  const routes = services.map((service) => {
    const instance = backends.find((backend) => backend.serviceKey === service.key) ?? null;
    return {
      serviceKey: service.key,
      serviceName: service.name,
      path: routePaths[service.key],
      method: "GET",
      instance
    };
  });

  return {
    running: Boolean(container.State.Running),
    ready: Boolean(container.State.Running && backends.length === services.length),
    needsRepair: backends.length < services.length,
    gateway: {
      id: container.Id,
      name: gatewayName,
      hostPort: gatewayPort,
      containerPort: 80,
      baseUrl: `http://127.0.0.1:${gatewayPort}`
    },
    routes,
    services: backends
  };
}

export async function getApiGatewayLessonState() {
  try {
    return stateFrom(await inspectGateway());
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function startApiGatewayLesson() {
  try {
    const current = await inspectGateway();
    const currentState = await stateFrom(current);
    if (currentState.ready) return currentState;

    const old = await inspectGateway({ includeStopped: true });
    const preferredIds = Object.fromEntries(
      services.map((service) => [service.key, old?.Config.Labels?.[backendLabel(service.key)]])
    );
    const previouslyOwnedIds = idsFromLabel(old, "com.silicon-lanes.owned-backend-ids");
    if (old) await removeGateway(old);

    const pool = await ensureBackends(preferredIds, previouslyOwnedIds);
    const gateway = await startGatewayContainer(pool.backends, pool.ownedIds);
    await Promise.all(pool.backends.map(({ id }) => clearInstanceLogs(id)));
    return stateFrom(gateway);
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function stopApiGatewayLesson() {
  try {
    const gateway = await inspectGateway({ includeStopped: true });
    if (!gateway) return;
    const ownedIds = idsFromLabel(gateway, "com.silicon-lanes.owned-backend-ids");
    await removeGateway(gateway);
    const runningIds = new Set((await listManagedInstances()).map(({ id }) => id));
    for (const id of ownedIds) {
      if (runningIds.has(id)) await stopInstance(id);
    }
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function getApiGatewayLessonLogs() {
  try {
    const gateway = await inspectGateway();
    if (!gateway) {
      return { gatewayLogs: "Start the lesson to see API Gateway routing decisions.", serviceLogs: [] };
    }

    const output = await docker(["logs", "--tail", "300", gateway.Id]);
    const clearTime = gatewayLogClearTimes.get(gateway.Id);
    const lines = output.split(/\r?\n/)
      .map((line) => line.match(/^\[gateway\]\s+(\S+)\s+([A-Z]+)\s+(\S+)\s+(\d+)\s+service=(\S+)\s+server=(\S+)$/))
      .filter(Boolean)
      .filter((match) => !clearTime || Date.parse(match[1]) > clearTime)
      .map((match) => `${match[1]}  ${match[2]}  ${match[3]}  ${match[4]}  → ${match[5]} / ${match[6]}`);
    const state = await stateFrom(gateway);
    const serviceLogs = await Promise.all(state.services.map(async (service) => ({
      id: service.id,
      name: service.name,
      serviceKey: service.serviceKey,
      logs: await getInstanceLogs(service.id)
    })));

    return {
      gatewayLogs: lines.length ? lines.slice(-50).join("\n") : "No gateway requests received yet.",
      serviceLogs
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function clearApiGatewayLessonLogs() {
  try {
    const gateway = await inspectGateway();
    if (!gateway) return;
    gatewayLogClearTimes.set(gateway.Id, Date.now());
    const state = await stateFrom(gateway);
    await Promise.all(state.services.map(({ id }) => clearInstanceLogs(id)));
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}
