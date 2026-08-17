import { formatResponseHeaders } from "/lessons/shared/components.js";

const apiRoot = "/api/lessons/lesson-03-l7-load-balancer";
const elements = {
  start: document.querySelector("#start-lesson"),
  repair: document.querySelector("#repair-pool"),
  stop: document.querySelector("#stop-lesson"),
  clear: document.querySelector("#clear-logs"),
  sendOne: document.querySelector("#send-one"),
  sendSix: document.querySelector("#send-six"),
  copyCurl: document.querySelector("#copy-curl"),
  details: document.querySelector("#details-button"),
  detailsPanel: document.querySelector("#lb-details"),
  loadBalancerStatus: document.querySelector("#load-balancer-status"),
  loadBalancerRoute: document.querySelector("#published-route"),
  poolStatus: document.querySelector("#pool-status"),
  replicaGrid: document.querySelector("#replica-grid"),
  loadBalancerLog: document.querySelector("#load-balancer-logs"),
  responseStatus: document.querySelector("#response-meta"),
  responseTime: document.querySelector("#response-time"),
  responseServer: document.querySelector("#response-server"),
  responsePretty: document.querySelector("#products"),
  responseJson: document.querySelector("#response-json"),
  responseHeaders: document.querySelector("#response-headers"),
  clientUrl: document.querySelector("#load-balancer-url"),
  upstreamConfig: document.querySelector("#config-snippet"),
  clientConnector: document.querySelector(".connector-client"),
  toast: document.querySelector("#toasts"),
  requestTrace: document.querySelector("#request-trace"),
  totalRequests: document.querySelector("#total-request-count"),
  healthyReplicas: document.querySelector("#healthy-replica-count"),
  routingHistory: document.querySelector("#routing-history"),
  lastResult: document.querySelector("#last-result"),
  lastServer: document.querySelector("#last-selected-server"),
  lastMessage: document.querySelector("#last-selection-message")
};

const defaultBackends = ["catalogService1:6212", "catalogService2:6212", "catalogService3:6212"];
const distribution = new Map();
const knownReplicas = new Map();
const routeHistory = [];
let currentState = null;
let totalRequestCount = 0;
let logTimer;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

async function api(path = "", options = {}) {
  const response = await fetch(`${apiRoot}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`);
  return payload;
}

function loadBalancerUrl() {
  return currentState?.loadBalancer?.directUrl?.replace("127.0.0.1", "localhost")
    ?? "http://localhost:7312/api/products";
}

function notify(message, tone = "info") {
  elements.toast.innerHTML = `<div class="toast ${tone === "error" ? "error" : ""}">${escapeHtml(message)}</div>`;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => elements.toast.replaceChildren(), 3200);
}

function setBusy(isBusy) {
  document.body.dataset.busy = String(isBusy);
  if (isBusy) {
    [elements.start, elements.repair, elements.stop, elements.clear].forEach((button) => {
      if (button && !button.hidden) button.disabled = true;
    });
  } else if (currentState) {
    renderState(currentState);
  }
}

function configuredBackends(state = currentState) {
  const backends = state?.configuredBackends?.length ? state.configuredBackends : defaultBackends;
  return [...backends].sort((left, right) => {
    const leftSequence = Number(backendName(left).match(/(\d+)$/)?.[1] ?? 0);
    const rightSequence = Number(backendName(right).match(/(\d+)$/)?.[1] ?? 0);
    return leftSequence - rightSequence;
  });
}

function backendName(specification) {
  return specification.split(":")[0];
}

function rememberReplicas(services) {
  for (const service of services) knownReplicas.set(service.name, service);
}

function replicaSlots(state) {
  const services = state.services ?? [];
  rememberReplicas(services);
  return configuredBackends(state).map((specification) => {
    const name = backendName(specification);
    const service = services.find((candidate) => candidate.name === name);
    return { name, specification, service, known: service ?? knownReplicas.get(name) };
  });
}

function replicaCard(slot) {
  const { name, service, known } = slot;
  const safeName = escapeHtml(name);
  const sequence = Number(name.match(/(\d+)$/)?.[1] ?? 1);
  const port = `:${known?.hostPort ?? 6211 + sequence}`;
  const count = distribution.get(name) ?? 0;

  if (!service) {
    return `
      <lesson-service-compact class="replica-card stopped" data-service-name="${safeName}" kind="catalog"
        heading="${safeName}" port="${port}" configuration="Type: Catalog Service replica&#10;State: stopped&#10;Selected by: L7 Load Balancer">
        <div class="replica-metric"><span>Requests served</span><strong data-count-for="${safeName}">${count}</strong></div>
        <div class="compact-service-controls"><span>Unavailable</span><b>STOPPED</b></div>
        <pre class="compact-service-log">This replica is outside the healthy pool.</pre>
      </lesson-service-compact>`;
  }

  return `
    <lesson-service-compact class="replica-card" data-service-name="${safeName}" kind="catalog"
      heading="${safeName}" port=":${service.hostPort}" configuration="Type: Catalog Service replica&#10;Published port: ${service.hostPort}&#10;Container port: ${service.containerPort}&#10;Selected by: L7 Load Balancer">
      <div class="replica-metric"><span>Requests served</span><strong data-count-for="${safeName}">${count}</strong></div>
      <div class="compact-service-controls">
        <span>Request log</span>
        <button type="button" class="kill-button" data-kill-id="${escapeHtml(service.id)}">Kill replica</button>
      </div>
      <pre class="compact-service-log" data-log-for="${safeName}">No requests yet.</pre>
    </lesson-service-compact>`;
}

function renderReplicas(state) {
  elements.replicaGrid.innerHTML = replicaSlots(state).map(replicaCard).join("");
}

function renderConfig(backends) {
  const targets = backends.length ? backends : defaultBackends;
  elements.upstreamConfig.textContent = `upstream catalog_pool {
  server ${targets[0]};
  server ${targets[1]};
  server ${targets[2]};
}

location /api/products {
  proxy_pass http://catalog_pool;
}`;
}

function renderExperimentStats() {
  elements.totalRequests.textContent = totalRequestCount;
  elements.healthyReplicas.textContent = `${currentState?.services?.length ?? 0} / ${currentState?.poolSize ?? 3}`;
  elements.routingHistory.textContent = routeHistory.length
    ? routeHistory.map((name) => name.replace("catalogService", "S")).join(" → ")
    : "No requests yet";
  document.querySelectorAll("[data-count-for]").forEach((element) => {
    element.textContent = distribution.get(element.dataset.countFor) ?? 0;
  });
}

function renderState(state) {
  currentState = state;
  const running = state.running;
  const services = state.services ?? [];
  const requestReady = running && services.length > 0;

  elements.loadBalancerStatus.textContent = running ? "running" : "stopped";
  elements.loadBalancerStatus.className = `lesson-node-status ${running ? "running" : "stopped"}`;
  document.querySelector("#load-balancer-name").textContent = state.loadBalancer?.name ?? "L7 Load Balancer";
  elements.poolStatus.textContent = `${services.length} / ${state.poolSize} running${state.needsRepair ? " · degraded" : ""}`;
  elements.poolStatus.dataset.tone = !running ? "waiting" : state.needsRepair ? "warning" : "healthy";
  elements.loadBalancerRoute.textContent = `localhost:${state.loadBalancer?.hostPort ?? 7312}`;
  elements.clientUrl.textContent = loadBalancerUrl();

  elements.start.hidden = running;
  elements.repair.hidden = !running || !state.needsRepair;
  elements.stop.disabled = !running;
  elements.clear.disabled = !running;
  elements.sendOne.disabled = !requestReady;
  elements.sendSix.disabled = !requestReady;
  elements.copyCurl.disabled = !running;

  renderConfig(configuredBackends(state));
  renderReplicas(state);
  renderExperimentStats();
}

function restartAnimation(element) {
  element.classList.remove("flowing");
  void element.offsetWidth;
  element.classList.add("flowing");
}

function activateReplica(serverName) {
  const names = configuredBackends().map(backendName);
  const index = names.indexOf(serverName);
  const path = document.querySelector(`[data-branch-index="${index}"]`);
  path?.classList.remove("active");
  if (path) void path.getBoundingClientRect();
  path?.classList.add("active");
  window.setTimeout(() => path?.classList.remove("active"), 900);
  document.querySelector(`[data-service-name="${CSS.escape(serverName)}"]`)?.signalActivity?.();
}

function renderProducts(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return '<p class="empty-response">The response contained no products.</p>';
  }
  return products.map((product) => `
    <article>
      <div><b>${escapeHtml(product.name)}</b><span>${escapeHtml(product.description)}</span></div>
      <strong>$${(Number(product.priceCents ?? product.price_cents) / 100).toFixed(2)}</strong>
    </article>
  `).join("");
}

function traceSteps(serverName) {
  const degraded = currentState.needsRepair;
  return [
    ["Client opened a connection", "Directly to the L7 Load Balancer at localhost:7312"],
    ["Nginx received GET /api/products", "Every request reaches the Load Balancer; there is no cache"],
    ["Layer 7 rules inspected the HTTP path", "Nginx matched the /api/products location"],
    degraded
      ? [`A healthy replica was selected`, `The stopped replica was unavailable, so Nginx used ${serverName}`]
      : [`Round robin selected ${serverName}`, "The next healthy replica received its turn"],
    [`Request was forwarded to ${serverName}`, "The client did not need to know this internal destination"],
    [`${serverName} queried PostgreSQL`, "Only the selected application instance performed the work"],
    ["JSON returned through the Load Balancer", "The response travelled back through the stable client address"]
  ];
}

function renderTrace(serverName) {
  elements.requestTrace.innerHTML = traceSteps(serverName).map(([title, detail], index) => `
    <li style="--trace-delay: ${index * 60}ms">
      <span>${index + 1}</span>
      <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>
    </li>
  `).join("");
}

function resetExperiment(message = "Execute a request to begin.") {
  distribution.clear();
  routeHistory.length = 0;
  totalRequestCount = 0;
  elements.lastResult.dataset.tone = "waiting";
  elements.lastServer.textContent = "WAITING";
  elements.lastMessage.textContent = message;
  elements.requestTrace.innerHTML = `
    <li class="pending"><span>1</span><div><strong>Execute a request</strong><small>The trace will reveal how the Load Balancer selects a replica.</small></div></li>`;
  renderExperimentStats();
}

function resetResponse() {
  elements.responseStatus.textContent = "waiting";
  elements.responseTime.textContent = "— ms";
  elements.responseServer.textContent = "waiting for response";
  elements.responsePretty.innerHTML = "<p>Start the lesson, then execute a request through the Load Balancer.</p>";
  elements.responseJson.textContent = "Execute a request to inspect the original response.";
  elements.responseHeaders.textContent = "Execute a request to inspect the response headers.";
}

async function makeRequest() {
  if (!currentState?.running) throw new Error("Start Lesson 3 first.");

  const startedAt = performance.now();
  document.querySelector("lesson-client-card")?.signalActivity?.();
  document.querySelector("lesson-load-balancer-card")?.signalActivity?.();
  restartAnimation(elements.clientConnector);

  const requestController = new AbortController();
  const requestTimeout = window.setTimeout(() => requestController.abort(), 5000);
  let response;
  try {
    response = await fetch(loadBalancerUrl(), { cache: "no-store", signal: requestController.signal });
  } finally {
    window.clearTimeout(requestTimeout);
  }

  const elapsed = performance.now() - startedAt;
  const payload = await response.json();
  const serverName = payload.servedBy?.server ?? response.headers.get("x-request-server") ?? "unknown server";

  if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`);

  totalRequestCount += 1;
  distribution.set(serverName, (distribution.get(serverName) ?? 0) + 1);
  routeHistory.push(serverName);
  if (routeHistory.length > 12) routeHistory.shift();

  activateReplica(serverName);
  renderExperimentStats();
  renderTrace(serverName);
  elements.lastResult.dataset.tone = currentState.needsRepair ? "warning" : "success";
  elements.lastServer.textContent = serverName;
  elements.lastMessage.textContent = currentState.needsRepair
    ? "The degraded pool still returned a successful response from a healthy replica."
    : "Round robin selected this healthy replica for the latest request.";

  elements.responseStatus.textContent = `${response.status} ${response.statusText || "OK"}`;
  elements.responseTime.textContent = `${elapsed.toFixed(1)} ms`;
  elements.responseServer.textContent = serverName;
  elements.responsePretty.innerHTML = renderProducts(payload.data);
  elements.responseJson.textContent = JSON.stringify(payload, null, 2);
  elements.responseHeaders.textContent = formatResponseHeaders(response);
  return serverName;
}

async function sendRequests(count) {
  elements.sendOne.disabled = true;
  elements.sendSix.disabled = true;
  const startedAt = performance.now();
  let lastServer = "";

  try {
    for (let index = 0; index < count; index += 1) {
      lastServer = await makeRequest();
      if (count > 1) await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
    if (count > 1) {
      elements.responseStatus.textContent = `${count} requests completed`;
      elements.responseTime.textContent = `${(performance.now() - startedAt).toFixed(1)} ms total`;
      elements.responseServer.textContent = `${lastServer} · last response`;
    }
    await refreshLogs();
  } catch (error) {
    notify(error.name === "AbortError" ? "The Load Balancer request timed out." : error.message, "error");
  } finally {
    const ready = currentState?.running && currentState.services.length > 0;
    elements.sendOne.disabled = !ready;
    elements.sendSix.disabled = !ready;
  }
}

async function refreshLogs() {
  if (!currentState?.running) return;
  try {
    const logs = await api("/logs");
    elements.loadBalancerLog.textContent = logs.loadBalancerLogs;
    elements.loadBalancerLog.scrollTop = elements.loadBalancerLog.scrollHeight;
    for (const serviceLog of logs.serviceLogs) {
      const target = document.querySelector(`[data-log-for="${CSS.escape(serviceLog.name)}"]`);
      if (target) {
        target.textContent = serviceLog.logs;
        target.scrollTop = target.scrollHeight;
      }
    }
  } catch (error) {
    elements.loadBalancerLog.textContent = error.message;
  }
}

async function refreshState() {
  renderState(await api("/state"));
  if (currentState.running) await refreshLogs();
}

async function startLesson() {
  setBusy(true);
  const repaired = currentState?.needsRepair;
  try {
    const state = await api("/start", { method: "POST" });
    if (!repaired) resetExperiment();
    renderState(state);
    await refreshLogs();
    if (repaired) elements.loadBalancerLog.textContent = "Pool restored. The rebuilt Load Balancer log starts with the next request.";
    elements.lastResult.dataset.tone = "success";
    elements.lastServer.textContent = repaired ? "POOL RESTORED" : "READY";
    elements.lastMessage.textContent = repaired
      ? "Three healthy replicas are available again."
      : "Run six requests to observe round-robin distribution.";
    notify(repaired ? "Replica pool restored to three." : "Lesson 3 is ready.", "success");
  } catch (error) {
    notify(error.message, "error");
    await refreshState().catch(() => {});
  } finally {
    setBusy(false);
  }
}

async function stopLesson() {
  setBusy(true);
  try {
    await api("/stop", { method: "DELETE" });
    await refreshState();
    resetExperiment();
    resetResponse();
    elements.loadBalancerLog.textContent = "Start the lesson to see distributed requests.";
    notify("Lesson 3 containers stopped.", "success");
  } catch (error) {
    notify(error.message, "error");
  } finally {
    setBusy(false);
  }
}

async function killReplica(id) {
  const button = document.querySelector(`[data-kill-id="${CSS.escape(id)}"]`);
  if (button) button.disabled = true;
  try {
    const stoppedName = currentState.services.find((service) => service.id === id)?.name ?? "Replica";
    const state = await api(`/services/${encodeURIComponent(id)}`, { method: "DELETE" });
    renderState(state);
    await refreshLogs();
    elements.lastResult.dataset.tone = "warning";
    elements.lastServer.textContent = "POOL DEGRADED";
    elements.lastMessage.textContent = `${stoppedName} stopped. Send another request to verify failover.`;
    notify(`${stoppedName} stopped. Healthy replicas remain available.`, "success");
  } catch (error) {
    notify(error.message, "error");
    await refreshState().catch(() => {});
  }
}

elements.start.addEventListener("click", startLesson);
elements.repair.addEventListener("click", startLesson);
elements.stop.addEventListener("click", stopLesson);
elements.sendOne.addEventListener("click", () => sendRequests(1));
elements.sendSix.addEventListener("click", () => sendRequests(6));
elements.clear.addEventListener("click", async () => {
  try {
    await api("/logs", { method: "DELETE" });
    resetExperiment("Logs and distribution counters were cleared.");
    renderState(currentState);
    elements.loadBalancerLog.textContent = "Logs cleared. Send another request.";
    document.querySelectorAll("[data-log-for]").forEach((log) => { log.textContent = "Logs cleared. Send another request."; });
    notify("Visible request logs and counters cleared.", "success");
  } catch (error) {
    notify(error.message, "error");
  }
});
elements.copyCurl.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`curl --request GET "${loadBalancerUrl()}"`);
    notify("cURL copied. Paste it into a terminal or import it into Postman.", "success");
  } catch {
    notify("Clipboard access was unavailable.", "error");
  }
});
elements.details.addEventListener("click", () => {
  const isHidden = elements.detailsPanel.hidden;
  elements.detailsPanel.hidden = !isHidden;
  elements.details.textContent = isHidden ? "Hide configuration" : "Configuration";
  elements.details.setAttribute("aria-expanded", String(isHidden));
});
elements.replicaGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-kill-id]");
  if (button) killReplica(button.dataset.killId);
});

refreshState().then(() => resetExperiment(currentState.running
  ? "Run six requests to observe round-robin distribution."
  : "Start the lesson to create the replica pool."))
  .catch((error) => notify(error.message, "error"));
logTimer = window.setInterval(refreshLogs, 3000);
window.addEventListener("beforeunload", () => window.clearInterval(logTimer));
