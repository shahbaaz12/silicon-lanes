import path from "node:path";
import {
  clearInstanceLogs,
  getInstanceLogs,
  listManagedInstances,
  startInstances,
  stopInstance
} from "./docker-manager.js";
import { serviceCatalog } from "./service-catalog.js";
import { docker, friendlyDockerError, inspectLessonContainer, portIsAvailable, repositoryRoot, waitForHealthy } from "./infrastructure/docker-client.js";
const nginxTemplate = path.join(repositoryRoot, "Lessons", "lesson-02-reverse-proxy", "nginx", "default.conf.template");
const catalog = serviceCatalog.catalog;
const proxyName = "reverseProxy1";
const proxyImage = "nginx:1.27-alpine";
const proxyPort = 7212;
const networkName = "silicon-lanes-network";
const lessonLabel = "lesson-02-reverse-proxy";
const proxyLogClearTimes = new Map();

async function inspectProxy({ includeStopped = false } = {}) {
  return inspectLessonContainer({
    name: proxyName,
    lessonLabel,
    includeStopped,
    conflictMessage: `Container name ${proxyName} is already used outside Lesson 2.`
  });
}

async function waitForProxy(id) {
  return waitForHealthy(id, "Reverse Proxy", { attempts: 60 });
}

async function startProxyContainer(backend, backendOwned) {
  if (!await portIsAvailable(proxyPort)) {
    throw Object.assign(new Error(`Port ${proxyPort} is already in use.`), { statusCode: 409 });
  }
  const id = await docker([
    "run", "--detach",
    "--name", proxyName,
    "--hostname", proxyName,
    "--network", networkName,
    "--label", `com.silicon-lanes.lesson=${lessonLabel}`,
    "--label", `com.silicon-lanes.backend-id=${backend.id}`,
    "--label", `com.silicon-lanes.backend-owned=${backendOwned}`,
    "--publish", `127.0.0.1:${proxyPort}:80`,
    "--env", `CATALOG_UPSTREAM=${backend.name}:${backend.containerPort}`,
    "--mount", `type=bind,source=${nginxTemplate},target=/etc/nginx/templates/default.conf.template,readonly`,
    "--health-cmd", "wget -q -O - http://127.0.0.1/proxy-health >/dev/null || exit 1",
    "--health-interval", "2s",
    "--health-timeout", "3s",
    "--health-retries", "20",
    proxyImage
  ], { timeout: 5 * 60 * 1000 });
  await waitForProxy(id);
  return inspectProxy();
}

async function removeProxy(container) {
  if (!container) return;
  await docker(["rm", "--force", container.Id]);
  proxyLogClearTimes.delete(container.Id);
}

async function stateFrom(container) {
  if (!container) return {
    running: false,
    cacheTtlSeconds: 15,
    proxy: null,
    service: null
  };
  const labels = container.Config.Labels ?? {};
  const backendId = labels["com.silicon-lanes.backend-id"];
  const backend = (await listManagedInstances()).find((instance) => instance.id === backendId);
  return {
    running: Boolean(container.State.Running && backend),
    cacheTtlSeconds: 15,
    proxy: {
      id: container.Id,
      name: proxyName,
      hostPort: proxyPort,
      containerPort: 80,
      directUrl: `http://localhost:${proxyPort}/api/products`
    },
    service: backend ? {
      id: backend.id,
      name: backend.name,
      hostPort: backend.hostPort,
      containerPort: backend.containerPort,
      ownedByLesson: labels["com.silicon-lanes.backend-owned"] === "true"
    } : null
  };
}

export async function getReverseProxyLessonState() {
  try {
    return stateFrom(await inspectProxy());
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function startReverseProxyLesson() {
  try {
    const runningProxy = await inspectProxy();
    const runningState = await stateFrom(runningProxy);
    if (runningState.running) return runningState;

    const oldProxy = await inspectProxy({ includeStopped: true });
    if (oldProxy) await removeProxy(oldProxy);
    const existingCatalogs = (await listManagedInstances()).filter((instance) => instance.serviceKey === catalog.key);
    let backend = existingCatalogs[0];
    let backendOwned = false;
    if (!backend) {
      [backend] = await startInstances(catalog, 1);
      backendOwned = true;
    }
    const proxy = await startProxyContainer(backend, backendOwned);
    await clearInstanceLogs(backend.id);
    return stateFrom(proxy);
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function stopReverseProxyLesson() {
  try {
    const proxy = await inspectProxy({ includeStopped: true });
    if (!proxy) return;
    const labels = proxy.Config.Labels ?? {};
    const backendId = labels["com.silicon-lanes.backend-id"];
    const backendOwned = labels["com.silicon-lanes.backend-owned"] === "true";
    await removeProxy(proxy);
    if (backendOwned) {
      const backend = (await listManagedInstances()).find((instance) => instance.id === backendId);
      if (backend) await stopInstance(backend.id);
    }
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function clearReverseProxyLessonCache() {
  try {
    const proxy = await inspectProxy();
    if (!proxy) throw Object.assign(new Error("Start Lesson 2 before clearing its cache."), { statusCode: 409 });
    const labels = proxy.Config.Labels ?? {};
    const backendId = labels["com.silicon-lanes.backend-id"];
    const backendOwned = labels["com.silicon-lanes.backend-owned"] === "true";
    const backend = (await listManagedInstances()).find((instance) => instance.id === backendId);
    if (!backend) throw Object.assign(new Error("The Catalog Service is not running."), { statusCode: 409 });
    await removeProxy(proxy);
    return stateFrom(await startProxyContainer(backend, backendOwned));
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function getReverseProxyLessonLogs() {
  try {
    const proxy = await inspectProxy();
    if (!proxy) return {
      proxyLogs: "Start the lesson to see Reverse Proxy requests.",
      serviceLogs: "Start the lesson to see Catalog Service requests."
    };
    const output = await docker(["logs", "--tail", "200", proxy.Id]);
    const clearTime = proxyLogClearTimes.get(proxy.Id);
    const proxyLines = output.split(/\r?\n/)
      .map((line) => line.match(/^\[proxy\]\s+(\S+)\s+([A-Z]+)\s+(\S+)\s+(\d+)\s+cache=(\S+)\s+upstream=(\S+)$/))
      .filter(Boolean)
      .filter((match) => !clearTime || Date.parse(match[1]) > clearTime)
      .map((match) => `${match[1]}  ${match[2]}  ${match[3]}  ${match[4]}  cache=${match[5]}`);
    const backendId = proxy.Config.Labels?.["com.silicon-lanes.backend-id"];
    return {
      proxyLogs: proxyLines.length ? proxyLines.slice(-30).join("\n") : "No proxy requests received yet.",
      serviceLogs: backendId ? await getInstanceLogs(backendId) : "Catalog Service is unavailable."
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}

export async function clearReverseProxyLessonLogs() {
  try {
    const proxy = await inspectProxy();
    if (!proxy) return;
    proxyLogClearTimes.set(proxy.Id, Date.now());
    const backendId = proxy.Config.Labels?.["com.silicon-lanes.backend-id"];
    if (backendId) await clearInstanceLogs(backendId);
  } catch (error) {
    if (error.statusCode) throw error;
    throw friendlyDockerError(error);
  }
}
