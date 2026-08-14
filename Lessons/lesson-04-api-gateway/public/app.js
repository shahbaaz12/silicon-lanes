import { formatResponseHeaders } from "/lessons/shared/components.js";

const apiRoot = "/api/lessons/lesson-04-api-gateway";
const portByService = Object.freeze({ user: 6112, catalog: 6212, inventory: 6312, cart: 6412, order: 6512, payment: 6612 });

const elements = {
  start: document.querySelector("#start-lesson"),
  stop: document.querySelector("#stop-lesson"),
  clear: document.querySelector("#clear-logs"),
  send: document.querySelector("#send-request"),
  copy: document.querySelector("#copy-curl"),
  details: document.querySelector("#details-button"),
  detailsPanel: document.querySelector("#gateway-details"),
  routePicker: document.querySelector("#route-picker"),
  selectedUrl: document.querySelector("#selected-url"),
  routeDecision: document.querySelector("#route-decision"),
  gatewayStatus: document.querySelector("#gateway-status"),
  publishedRoute: document.querySelector("#published-route"),
  gatewayLogs: document.querySelector("#gateway-logs"),
  poolStatus: document.querySelector("#pool-status"),
  serviceGrid: document.querySelector("#service-grid"),
  responseMeta: document.querySelector("#response-meta"),
  responseTime: document.querySelector("#response-time"),
  responseServer: document.querySelector("#response-server"),
  responsePretty: document.querySelector("#response-pretty"),
  responseJson: document.querySelector("#response-json"),
  responseHeaders: document.querySelector("#response-headers"),
  clientConnector: document.querySelector(".connector.horizontal"),
  serviceConnector: document.querySelector(".connector.downstream"),
  toast: document.querySelector("#toast-region")
};

let state;
let selectedServiceKey = "user";
let logsRefreshing = false;

async function api(path = "", options = {}) {
  const response = await fetch(`${apiRoot}${path}`, options);
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed with status ${response.status}`);
  return payload;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function notify(message, isError = false) {
  const item = document.createElement("div");
  item.className = `toast${isError ? " error" : ""}`;
  item.textContent = message;
  elements.toast.append(item);
  window.setTimeout(() => item.remove(), 3500);
}

function selectedRoute() {
  return state.routes.find((route) => route.serviceKey === selectedServiceKey) ?? state.routes[0];
}

function gatewayUrl(route = selectedRoute()) {
  return `${state.gateway?.baseUrl ?? "http://127.0.0.1:7412"}${route.path}`;
}

function renderRouteSelection() {
  elements.routePicker.innerHTML = state.routes.map((route) => `
    <button type="button" class="route-choice${route.serviceKey === selectedServiceKey ? " selected" : ""}" data-route-key="${route.serviceKey}">
      <span>${escapeHtml(route.serviceName)}</span><code>${route.path}</code>
    </button>
  `).join("");
  const route = selectedRoute();
  elements.selectedUrl.textContent = gatewayUrl(route);
  elements.routeDecision.textContent = `${route.path} → ${route.serviceName}`;
  document.querySelectorAll("[data-service-key]").forEach((card) => {
    card.classList.toggle("selected-destination", card.dataset.serviceKey === selectedServiceKey);
  });
}

function serviceCard(route) {
  const instance = route.instance;
  const heading = instance?.name ?? route.serviceName;
  const port = instance?.hostPort ?? portByService[route.serviceKey];
  return `
    <lesson-service-compact class="service-card" data-service-key="${route.serviceKey}" kind="${route.serviceKey}"
      data-instance-name="${escapeHtml(instance?.name ?? "")}" heading="${escapeHtml(heading)}" port=":${port}"
      configuration="Type: ${escapeHtml(route.serviceName)}&#10;Published port: ${port}&#10;Route: ${route.path}&#10;Selected by: API Gateway path routing">
      <pre class="service-log" data-log-for="${route.serviceKey}">${instance ? "No requests yet." : "Stopped"}</pre>
    </lesson-service-compact>`;
}

function renderState(nextState) {
  state = nextState;
  if (!state.routes.some((route) => route.serviceKey === selectedServiceKey)) selectedServiceKey = state.routes[0].serviceKey;
  const running = state.running;
  elements.gatewayStatus.textContent = running ? "RUNNING" : "STOPPED";
  elements.gatewayStatus.className = `lesson-node-status ${running ? "running" : "stopped"}`;
  elements.publishedRoute.textContent = running
    ? `127.0.0.1:${state.gateway.hostPort} → ${state.gateway.name}:${state.gateway.containerPort}`
    : "127.0.0.1:7412 → apiGateway1:80";
  elements.poolStatus.textContent = `${state.services.length} / ${state.routes.length} running`;
  elements.start.hidden = state.ready;
  elements.start.textContent = running ? "Repair service routes" : "Start Lesson 4";
  elements.stop.disabled = !running;
  elements.clear.disabled = !running;
  elements.send.disabled = !state.ready;
  elements.copy.disabled = !running;
  elements.serviceGrid.innerHTML = state.routes.map(serviceCard).join("");
  renderRouteSelection();
}

function animateConnector(element) {
  element.classList.remove("flowing");
  void element.offsetWidth;
  element.classList.add("flowing");
}

function signalNode(selector) {
  document.querySelector(selector)?.signalActivity?.();
}

function resetResponse() {
  elements.responseMeta.textContent = "waiting";
  elements.responseTime.textContent = "— ms";
  elements.responseServer.textContent = "waiting for response";
  elements.responsePretty.textContent = "Start the lesson, then send a request through the API Gateway.";
  elements.responseJson.textContent = "Send a request to inspect the JSON response.";
  elements.responseHeaders.textContent = "Send a request to inspect the response headers.";
}

async function refreshLogs() {
  if (!state?.running || logsRefreshing) return;
  logsRefreshing = true;
  try {
    const result = await api("/logs");
    elements.gatewayLogs.textContent = result.gatewayLogs;
    elements.gatewayLogs.scrollTop = elements.gatewayLogs.scrollHeight;
    for (const service of result.serviceLogs) {
      const log = document.querySelector(`[data-log-for="${CSS.escape(service.serviceKey)}"]`);
      if (log) {
        log.textContent = service.logs;
        log.scrollTop = log.scrollHeight;
      }
    }
  } catch {
    // A lifecycle transition can briefly make a container unavailable.
  } finally {
    logsRefreshing = false;
  }
}

async function startLesson() {
  elements.start.disabled = true;
  elements.start.textContent = "Starting gateway + services...";
  try {
    renderState(await api("/start", { method: "POST" }));
    resetResponse();
    await refreshLogs();
    notify("API Gateway and all six services are ready.");
  } catch (error) {
    notify(error.message, true);
    renderState(await api("/state"));
  } finally {
    elements.start.disabled = false;
  }
}

async function stopLesson() {
  elements.stop.disabled = true;
  try {
    await api("/stop", { method: "DELETE" });
    renderState(await api("/state"));
    elements.gatewayLogs.textContent = "Start the lesson to see gateway routing decisions.";
    resetResponse();
    notify("Lesson 4 containers stopped.");
  } catch (error) {
    notify(error.message, true);
  }
}

async function sendRequest() {
  const route = selectedRoute();
  elements.send.disabled = true;
  elements.responseMeta.textContent = "request in flight";
  elements.responseTime.textContent = "measuring";
  signalNode("lesson-client-card");
  window.setTimeout(() => signalNode("lesson-api-gateway-card"), 100);
  animateConnector(elements.clientConnector);
  const startedAt = performance.now();

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    let response;
    try {
      response = await fetch(gatewayUrl(route), { cache: "no-store", signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || `API Gateway returned HTTP ${response.status}.`);
    const serverName = payload.servedBy?.server ?? response.headers.get("x-request-server") ?? "unknown server";
    elements.responseHeaders.textContent = formatResponseHeaders(response);
    elements.responseJson.textContent = JSON.stringify(payload, null, 2);
    elements.responsePretty.textContent = JSON.stringify(payload.data, null, 2);
    elements.responseServer.textContent = serverName;
    elements.responseTime.textContent = `${(performance.now() - startedAt).toFixed(1)} ms`;
    elements.responseMeta.textContent = `200 OK · ${route.serviceName}`;
    elements.routeDecision.textContent = `${route.path} → ${route.serviceName} → ${serverName}`;
    animateConnector(elements.serviceConnector);
    signalNode(`[data-instance-name="${CSS.escape(serverName)}"]`);
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    await refreshLogs();
  } catch (error) {
    elements.responseMeta.textContent = "request failed";
    elements.responseTime.textContent = `${(performance.now() - startedAt).toFixed(1)} ms`;
    elements.responseServer.textContent = "request failed";
    notify(error.name === "AbortError" ? "The gateway request timed out." : error.message, true);
  } finally {
    elements.send.disabled = !state.ready;
  }
}

elements.routePicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route-key]");
  if (!button) return;
  selectedServiceKey = button.dataset.routeKey;
  renderRouteSelection();
});
elements.start.addEventListener("click", startLesson);
elements.stop.addEventListener("click", stopLesson);
elements.send.addEventListener("click", sendRequest);
elements.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`curl --request GET "${gatewayUrl()}"`);
    notify("cURL copied. Paste it into a terminal or import it into Postman.");
  } catch {
    notify("Could not copy the cURL command.", true);
  }
});
elements.clear.addEventListener("click", async () => {
  try {
    await api("/logs", { method: "DELETE" });
    elements.gatewayLogs.textContent = "Logs cleared. Send another request.";
    document.querySelectorAll("[data-log-for]").forEach((log) => { log.textContent = "No requests yet."; });
    notify("Gateway and service logs cleared.");
  } catch (error) {
    notify(error.message, true);
  }
});
elements.details.addEventListener("click", () => {
  const expanded = elements.details.getAttribute("aria-expanded") === "true";
  elements.details.setAttribute("aria-expanded", String(!expanded));
  elements.details.textContent = expanded ? "Details" : "Hide details";
  elements.detailsPanel.hidden = expanded;
});

try {
  renderState(await api("/state"));
  await refreshLogs();
} catch (error) {
  notify(error.message, true);
}

window.setInterval(refreshLogs, 2200);
