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
  clientConnector: document.querySelector(".connector.horizontal"),
  serviceConnector: document.querySelector(".connector.downstream"),
  toast: document.querySelector("#toast-region"),
};

let currentState = null;
let logTimer = null;
const requestCounts = new Map();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path = "", options = {}) {
  const response = await fetch(`${apiRoot}${path}`, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

function notify(message, tone = "info") {
  elements.toast.innerHTML = `<div class="toast ${tone === "error" ? "error" : ""}">${escapeHtml(message)}</div>`;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => {
    elements.toast.replaceChildren();
  }, 3200);
}

function setBusy(isBusy) {
  document.body.dataset.busy = String(isBusy);
  [elements.start, elements.repair, elements.stop].forEach((button) => {
    if (button && !button.hidden) button.disabled = isBusy;
  });
}

function placeholderReplica(index) {
  const name = `catalogService${index}`;
  return `
    <lesson-service-card class="replica-card placeholder" data-service-name="${name}"
      icon="CS" kicker="Catalog replica" heading="${name}" status="stopped">
      <div class="replica-summary">
        <code>Waiting for Lesson 3</code>
        <span class="request-count"><strong>0</strong> answered</span>
      </div>
      <div class="replica-actions"><button class="kill-button" type="button" disabled>Kill replica</button></div>
      <div class="replica-log-heading"><span>Request log</span><span>No process</span></div>
      <div class="replica-log"><pre>Start the lesson to create this replica.</pre></div>
    </lesson-service-card>`;
}

function runningReplica(service) {
  const name = escapeHtml(service.name);
  const count = requestCounts.get(service.name) || 0;
  return `
    <lesson-service-card class="replica-card" data-service-name="${name}"
      icon="CS" kicker="Catalog replica" heading="${name}" status="running">
      <div class="replica-summary">
        <code>:${service.hostPort} &rarr; :${service.containerPort}</code>
        <span class="request-count"><strong data-count-for="${name}">${count}</strong> answered</span>
      </div>
      <div class="replica-actions">
        <button type="button" class="kill-button" data-kill-id="${escapeHtml(service.id)}">Kill replica</button>
      </div>
      <div class="replica-log-heading"><span>Request log</span><span>${name}</span></div>
      <div class="replica-log"><pre data-log-for="${name}">No requests yet.</pre></div>
    </lesson-service-card>`;
}

function renderReplicas(services) {
  const cards = services.length
    ? services.map(runningReplica)
    : [1, 2, 3].map(placeholderReplica);
  elements.replicaGrid.innerHTML = cards.join("");
}

function renderConfig(backends) {
  const targets = backends.length
    ? backends
    : ["catalogService1:6212", "catalogService2:6212", "catalogService3:6212"];

  elements.upstreamConfig.textContent = `upstream catalog_pool {
  server ${targets[0]};
  server ${targets[1]};
  server ${targets[2]};
}

server {
  listen 80;
  location /api/products {
    proxy_pass http://catalog_pool;
  }
}`;
}

function renderState(state) {
  currentState = state;
  const running = state.running;
  const services = state.services || [];
  const requestReady = running && services.length > 0;
  const directUrl = state.loadBalancer?.directUrl || "http://127.0.0.1:7312/api/products";

  elements.loadBalancerStatus.textContent = running ? "RUNNING" : "STOPPED";
  elements.loadBalancerStatus.className = `lesson-node-status ${running ? "running" : "stopped"}`;
  elements.poolStatus.textContent = `${services.length} / ${state.poolSize} replicas running`;
  elements.loadBalancerRoute.textContent = running
    ? `127.0.0.1:${state.loadBalancer.hostPort} → ${state.loadBalancer.name}:${state.loadBalancer.containerPort}`
    : "127.0.0.1:7312 → loadBalancer1:80";
  elements.clientUrl.textContent = directUrl;

  elements.start.hidden = running;
  elements.repair.hidden = !running || !state.needsRepair;
  elements.stop.disabled = !running;
  elements.clear.disabled = !running;
  elements.sendOne.disabled = !requestReady;
  elements.sendSix.disabled = !requestReady;
  elements.copyCurl.disabled = !running;

  renderConfig(state.configuredBackends || []);
  renderReplicas(services);
}

function animateConnector(element) {
  element.classList.remove("flowing");
  void element.offsetWidth;
  element.classList.add("flowing");
}

function signalNodeActivity(element) {
  element?.signalActivity?.();
}

function updateCount(serverName) {
  requestCounts.set(serverName, (requestCounts.get(serverName) || 0) + 1);
  const countElement = document.querySelector(`[data-count-for="${CSS.escape(serverName)}"]`);
  if (countElement) countElement.textContent = requestCounts.get(serverName);
}

function renderProducts(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return '<p class="empty-response">The response contained no products.</p>';
  }

  return `<div class="product-list">${products
    .map(
      (product) => `<article class="product-row">
        <div><b>${escapeHtml(product.name)}</b><span>${escapeHtml(product.description)}</span></div>
        <strong>$${(Number(product.priceCents ?? product.price_cents) / 100).toFixed(2)}</strong>
      </article>`,
    )
    .join("")}</div>`;
}

async function makeRequest() {
  if (!currentState?.running) throw new Error("Start Lesson 3 first.");

  const startedAt = performance.now();
  signalNodeActivity(document.querySelector("lesson-client-card"));
  signalNodeActivity(document.querySelector("lesson-load-balancer-card"));
  animateConnector(elements.clientConnector);
  const requestController = new AbortController();
  const requestTimeout = window.setTimeout(() => requestController.abort(), 5000);
  let response;
  try {
    response = await fetch(currentState.loadBalancer.directUrl, {
      cache: "no-store",
      signal: requestController.signal,
    });
  } finally {
    window.clearTimeout(requestTimeout);
  }
  const elapsed = performance.now() - startedAt;
  const payload = await response.json();
  const serverName = payload.servedBy?.server || response.headers.get("x-request-server") || "unknown server";

  animateConnector(elements.serviceConnector);
  signalNodeActivity(document.querySelector(`[data-service-name="${CSS.escape(serverName)}"]`));
  updateCount(serverName);
  elements.responseStatus.textContent = `${response.status} ${response.statusText || "OK"}`;
  elements.responseStatus.dataset.tone = response.ok ? "success" : "warning";
  elements.responseTime.textContent = `${elapsed.toFixed(1)} ms`;
  elements.responseServer.textContent = serverName;
  elements.responsePretty.innerHTML = renderProducts(payload.data);
  elements.responseJson.textContent = JSON.stringify(payload, null, 2);
  elements.responseHeaders.textContent = formatResponseHeaders(response);

  if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`);
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
      if (count > 1) await new Promise((resolve) => window.setTimeout(resolve, 120));
    }

    if (count > 1) {
      const total = performance.now() - startedAt;
      elements.responseStatus.textContent = `${count} requests completed`;
      elements.responseTime.textContent = `${total.toFixed(1)} ms total`;
      elements.responseServer.textContent = `${lastServer} (last response)`;
    }
    await refreshLogs();
  } catch (error) {
    notify(error.message, "error");
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
  const state = await api("/state");
  renderState(state);
  if (state.running) await refreshLogs();
}

async function startLesson() {
  setBusy(true);
  try {
    const state = await api("/start", { method: "POST" });
    const repaired = currentState?.needsRepair;
    renderState(state);
    await refreshLogs();
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
    requestCounts.clear();
    await refreshState();
    resetResponse();
    elements.loadBalancerLog.textContent = "Start the lesson to see load balancer requests.";
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
    const stoppedName = currentState.services.find((service) => service.id === id)?.name || "Replica";
    const state = await api(`/services/${encodeURIComponent(id)}`, { method: "DELETE" });
    renderState(state);
    await refreshLogs();
    notify(`${stoppedName} stopped. The load balancer continues with the remaining replicas.`, "success");
  } catch (error) {
    notify(error.message, "error");
    await refreshState().catch(() => {});
  }
}

function resetResponse() {
  elements.responseStatus.textContent = "WAITING";
  elements.responseStatus.dataset.tone = "muted";
  elements.responseTime.textContent = "—";
  elements.responseServer.textContent = "—";
  elements.responsePretty.innerHTML = "<p>Start the lesson, then send a request through the load balancer.</p>";
  elements.responseJson.textContent = "No response yet.";
  elements.responseHeaders.textContent = "No response headers yet.";
}

elements.start.addEventListener("click", startLesson);
elements.repair.addEventListener("click", startLesson);
elements.stop.addEventListener("click", stopLesson);
elements.sendOne.addEventListener("click", () => sendRequests(1));
elements.sendSix.addEventListener("click", () => sendRequests(6));
elements.clear.addEventListener("click", async () => {
  try {
    await api("/logs", { method: "DELETE" });
    requestCounts.clear();
    renderState(currentState);
    elements.loadBalancerLog.textContent = "Logs cleared. Send another request.";
    document.querySelectorAll("[data-log-for]").forEach((log) => {
      log.textContent = "Logs cleared. Send another request.";
    });
    notify("Visible request logs cleared.", "success");
  } catch (error) {
    notify(error.message, "error");
  }
});
elements.copyCurl.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`curl ${elements.clientUrl.textContent}`);
    notify("curl command copied.", "success");
  } catch {
    notify("Clipboard access was unavailable. Select the command and copy it manually.", "error");
  }
});
elements.details.addEventListener("click", () => {
  const isHidden = elements.detailsPanel.hidden;
  elements.detailsPanel.hidden = !isHidden;
  elements.details.textContent = isHidden ? "Hide details" : "Details";
  elements.details.setAttribute("aria-expanded", String(isHidden));
});
elements.replicaGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-kill-id]");
  if (button) killReplica(button.dataset.killId);
});

refreshState().catch((error) => notify(error.message, "error"));
logTimer = window.setInterval(refreshLogs, 3000);
window.addEventListener("beforeunload", () => window.clearInterval(logTimer));
