import path from "node:path";
import { clearInstanceLogs, listManagedInstances, startInstances, stopInstance } from "./docker-manager.js";
import { serviceCatalog } from "./service-catalog.js";
import { docker, friendlyDockerError, idsFromLabel, inspectLessonContainer, portIsAvailable, repositoryRoot, waitForHealthy } from "./infrastructure/docker-client.js";
import { ensureServicePool } from "./infrastructure/service-pool.js";
const nginxDirectory = path.join(repositoryRoot, "Lessons", "lesson-06-advanced", "nginx");
const edgeTemplate = path.join(nginxDirectory, "edge-load-balancer.conf.template");
const gatewayTemplate = path.join(nginxDirectory, "api-gateway.conf.template");
const catalogTemplate = path.join(nginxDirectory, "catalog-load-balancer.conf.template");
const lessonLabel = "lesson-06-advanced";
const edgeName = "advancedEdgeLoadBalancer1";
const gatewayNames = ["advancedApiGateway1", "advancedApiGateway2"];
const catalogLoadBalancerName = "advancedCatalogLoadBalancer1";
const edgePort = 7612;
const networkName = "silicon-lanes-network";
const logClearTimes = new Map();

async function inspectInfrastructure(name, { includeStopped = false } = {}) {
  return inspectLessonContainer({ name, lessonLabel, includeStopped });
}

async function removeInfrastructure(container) {
  if (!container) return;
  await docker(["rm", "--force", container.Id]);
  logClearTimes.delete(container.Id);
}

async function ensureServices(previousIds = [], previousOwnedIds = []) {
  return ensureServicePool({
    requirements: [
      { service: serviceCatalog.user, count: 1 },
      { service: serviceCatalog.order, count: 1 },
      { service: serviceCatalog.catalog, count: 2 }
    ],
    previousIds,
    previouslyOwnedIds: previousOwnedIds,
    listInstances: listManagedInstances,
    startInstances
  });
}

async function runNginx({ name, template, env = [], labels = [], healthPath, publish }) {
  const args = [
    "run", "--detach", "--name", name, "--hostname", name, "--network", networkName,
    "--label", `com.silicon-lanes.lesson=${lessonLabel}`,
    ...labels.flatMap((label) => ["--label", label]),
    ...env.flatMap((value) => ["--env", value]),
    "--mount", `type=bind,source=${template},target=/etc/nginx/templates/default.conf.template,readonly`
  ];
  if (publish) args.push("--publish", publish);
  args.push(
    "--health-cmd", `wget -q -O - http://127.0.0.1${healthPath} >/dev/null || exit 1`,
    "--health-interval", "2s", "--health-timeout", "3s", "--health-retries", "20",
    "nginx:1.27-alpine"
  );
  const id = await docker(args, { timeout: 5 * 60 * 1000 });
  await waitForHealthy(id, name);
  return inspectInfrastructure(name);
}

async function startCatalogLoadBalancer(catalogs) {
  return runNginx({
    name: catalogLoadBalancerName,
    template: catalogTemplate,
    env: [`CATALOG_1=${catalogs[0].name}:${catalogs[0].containerPort}`, `CATALOG_2=${catalogs[1].name}:${catalogs[1].containerPort}`],
    labels: [`com.silicon-lanes.backend-ids=${catalogs.map(({ id }) => id).join(",")}`],
    healthPath: "/advanced-catalog-lb-health"
  });
}

async function startGateway(name, user, order) {
  return runNginx({
    name,
    template: gatewayTemplate,
    env: [
      `GATEWAY_NAME=${name}`,
      `USER_UPSTREAM=${user.name}:${user.containerPort}`,
      `ORDER_UPSTREAM=${order.name}:${order.containerPort}`,
      `CATALOG_LB_UPSTREAM=${catalogLoadBalancerName}:80`
    ],
    healthPath: "/advanced-gateway-health"
  });
}

async function startEdgeLoadBalancer(gateways, services, ownedIds) {
  if (!await portIsAvailable(edgePort)) {
    throw Object.assign(new Error(`Port ${edgePort} is already in use.`), { statusCode: 409 });
  }
  const id = await docker([
    "run", "--detach", "--name", edgeName, "--hostname", edgeName, "--network", networkName,
    "--label", `com.silicon-lanes.lesson=${lessonLabel}`,
    "--label", `com.silicon-lanes.backend-ids=${services.map(({ id }) => id).join(",")}`,
    "--label", `com.silicon-lanes.owned-backend-ids=${ownedIds.join(",")}`,
    "--label", `com.silicon-lanes.gateway-ids=${gateways.map(({ Id }) => Id).join(",")}`,
    "--env", `GATEWAY_1=${gatewayNames[0]}:80`, "--env", `GATEWAY_2=${gatewayNames[1]}:80`,
    "--env", "NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx",
    "--mount", `type=bind,source=${edgeTemplate},target=/etc/nginx/templates/nginx.conf.template,readonly`,
    "--publish", `127.0.0.1:${edgePort}:80`,
    "--health-cmd", "kill -0 $(cat /run/nginx.pid) || exit 1",
    "--health-interval", "2s", "--health-timeout", "3s", "--health-retries", "20",
    "nginx:1.27-alpine"
  ], { timeout: 5 * 60 * 1000 });
  await waitForHealthy(id, edgeName);
  return inspectInfrastructure(edgeName);
}

function advancedRoutes(services) {
  return [
    { key: "user", name: "Users", path: "/api/users", via: "direct", instances: services.filter(({ serviceKey }) => serviceKey === "user") },
    { key: "catalog", name: "Products", path: "/api/products", via: "load-balancer", instances: services.filter(({ serviceKey }) => serviceKey === "catalog") },
    { key: "order", name: "Orders", path: "/api/orders", via: "direct", instances: services.filter(({ serviceKey }) => serviceKey === "order") }
  ];
}

async function stateFrom(edge, gateways, catalogLoadBalancer) {
  if (!edge || gateways.some((gateway) => !gateway) || !catalogLoadBalancer) {
    return { running: false, ready: false, edge: null, gateways: [], catalogLoadBalancer: null, services: [], routes: advancedRoutes([]) };
  }
  const instances = await listManagedInstances();
  const backendIds = idsFromLabel(edge, "com.silicon-lanes.backend-ids");
  const ownedIds = new Set(idsFromLabel(edge, "com.silicon-lanes.owned-backend-ids"));
  const services = backendIds.map((id) => instances.find((instance) => instance.id === id)).filter(Boolean)
    .map((instance) => ({ ...instance, ownedByLesson: ownedIds.has(instance.id) }));
  const ready = services.filter(({ serviceKey }) => serviceKey === "catalog").length === 2
    && services.some(({ serviceKey }) => serviceKey === "user")
    && services.some(({ serviceKey }) => serviceKey === "order");
  return {
    running: Boolean(edge.State.Running && gateways.every((gateway) => gateway.State.Running) && catalogLoadBalancer.State.Running),
    ready,
    edge: { name: edgeName, hostPort: edgePort, containerPort: 80, baseUrl: `http://localhost:${edgePort}` },
    gateways: gatewayNames.map((name) => ({ name, containerPort: 80 })),
    catalogLoadBalancer: { name: catalogLoadBalancerName, containerPort: 80 },
    services,
    routes: advancedRoutes(services)
  };
}

async function inspectAll({ includeStopped = false } = {}) {
  const [edge, gateway1, gateway2, catalogLoadBalancer] = await Promise.all([
    inspectInfrastructure(edgeName, { includeStopped }),
    inspectInfrastructure(gatewayNames[0], { includeStopped }),
    inspectInfrastructure(gatewayNames[1], { includeStopped }),
    inspectInfrastructure(catalogLoadBalancerName, { includeStopped })
  ]);
  return { edge, gateways: [gateway1, gateway2], catalogLoadBalancer };
}

export async function getAdvancedLessonState() {
  try {
    const infrastructure = await inspectAll();
    return stateFrom(infrastructure.edge, infrastructure.gateways, infrastructure.catalogLoadBalancer);
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function startAdvancedLesson() {
  try {
    const current = await inspectAll();
    const currentState = await stateFrom(current.edge, current.gateways, current.catalogLoadBalancer);
    if (currentState.ready) return currentState;

    const old = await inspectAll({ includeStopped: true });
    const previousIds = idsFromLabel(old.edge, "com.silicon-lanes.backend-ids");
    const previousOwnedIds = idsFromLabel(old.edge, "com.silicon-lanes.owned-backend-ids");
    await Promise.all([old.edge, ...old.gateways, old.catalogLoadBalancer].map(removeInfrastructure));

    const pool = await ensureServices(previousIds, previousOwnedIds);
    const user = pool.services.find(({ serviceKey }) => serviceKey === "user");
    const order = pool.services.find(({ serviceKey }) => serviceKey === "order");
    const catalogs = pool.services.filter(({ serviceKey }) => serviceKey === "catalog");
    const catalogLoadBalancer = await startCatalogLoadBalancer(catalogs);
    const gateways = await Promise.all(gatewayNames.map((name) => startGateway(name, user, order)));
    const edge = await startEdgeLoadBalancer(gateways, pool.services, pool.ownedIds);
    await Promise.all(pool.services.map(({ id }) => clearInstanceLogs(id)));
    return stateFrom(edge, gateways, catalogLoadBalancer);
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function stopAdvancedLesson() {
  try {
    const infrastructure = await inspectAll({ includeStopped: true });
    const ownedIds = idsFromLabel(infrastructure.edge, "com.silicon-lanes.owned-backend-ids");
    await Promise.all([infrastructure.edge, ...infrastructure.gateways, infrastructure.catalogLoadBalancer].map(removeInfrastructure));
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

async function formattedLogs(container, pattern, emptyMessage, format) {
  const output = await docker(["logs", "--tail", "200", container.Id]);
  const lines = parseLogs(output, pattern, logClearTimes.get(container.Id), format);
  return lines.length ? lines.slice(-30).join("\n") : emptyMessage;
}

export async function getAdvancedLessonLogs() {
  try {
    const infrastructure = await inspectAll();
    if (!infrastructure.edge || infrastructure.gateways.some((gateway) => !gateway) || !infrastructure.catalogLoadBalancer) {
      return { edgeLogs: "Start Lesson 6.", gatewayLogs: gatewayNames.map((name) => ({ name, logs: "Start Lesson 6." })), catalogLogs: "Start Lesson 6." };
    }
    const gatewayIpNames = new Map(infrastructure.gateways.map((gateway, index) => [
      gateway.NetworkSettings.Networks?.[networkName]?.IPAddress,
      gatewayNames[index]
    ]));
    const edgeLogs = await formattedLogs(infrastructure.edge,
      /^\[advanced-edge-l4\]\s+(\S+)\s+client=(\S+)\s+gateway=(\S+):(\d+)\s+status=(\d+)$/,
      "No edge connections yet.", (match) => `${match[1]}  TCP  connection  → ${gatewayIpNames.get(match[3]) ?? match[3]}`);
    const gatewayLogs = await Promise.all(infrastructure.gateways.map(async (gateway, index) => ({
      name: gatewayNames[index],
      logs: await formattedLogs(gateway,
        /^\[advanced-gw\]\s+(\S+)\s+([A-Z]+)\s+(\S+)\s+(\d+)\s+gateway=(\S+)\s+service=(\S+)\s+server=(\S+)$/,
        "No gateway requests yet.", (match) => `${match[1]}  ${match[2]}  ${match[3]}  → ${match[6]} / ${match[7]}`)
    })));
    const catalogLogs = await formattedLogs(infrastructure.catalogLoadBalancer,
      /^\[advanced-catalog-lb\]\s+(\S+)\s+([A-Z]+)\s+(\S+)\s+(\d+)\s+server=(\S+)$/,
      "No Catalog requests yet.", (match) => `${match[1]}  ${match[2]}  ${match[3]}  → ${match[5]}`);
    return { edgeLogs, gatewayLogs, catalogLogs };
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function clearAdvancedLessonLogs() {
  try {
    const infrastructure = await inspectAll();
    const containers = [infrastructure.edge, ...infrastructure.gateways, infrastructure.catalogLoadBalancer].filter(Boolean);
    containers.forEach((container) => logClearTimes.set(container.Id, Date.now()));
    const state = await stateFrom(infrastructure.edge, infrastructure.gateways, infrastructure.catalogLoadBalancer);
    await Promise.all(state.services.map(({ id }) => clearInstanceLogs(id)));
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}
