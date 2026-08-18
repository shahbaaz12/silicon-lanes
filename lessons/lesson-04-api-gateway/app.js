import { formatResponseHeaders } from "../../lessons/shared/components.js";

const apiRoot = "/api/lessons/lesson-04-api-gateway";
const fallbackPortByService = Object.freeze({ user: 6112, catalog: 6212, inventory: 6312, cart: 6412, order: 6512, payment: 6612 });
const arrow = "\u2192";

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
  selectedPath: document.querySelector("#selected-path"),
  selectedService: document.querySelector("#selected-service"),
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
  clientConnector: document.querySelector(".connector-client"),
  serviceConnector: document.querySelector(".connector-services"),
  lastRoute: document.querySelector("#last-route"),
  lastRouteValue: document.querySelector("#last-route-value"),
  lastRouteMessage: document.querySelector("#last-route-message"),
  requestTrace: document.querySelector("#request-trace"),
  toast: document.querySelector("#toasts")
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

function gatewayBaseUrl() {
  return (state.gateway?.baseUrl ?? "http://localhost:7412").replace("127.0.0.1", "localhost");
}

function gatewayUrl(route = selectedRoute()) {
  return `${gatewayBaseUrl()}${route.path}`;
}

function renderRouteSelection() {
  elements.routePicker.innerHTML = state.routes.map((route) => `
    <button type="button" class="route-choice${route.serviceKey === selectedServiceKey ? " selected" : ""}" data-route-key="${route.serviceKey}" aria-pressed="${route.serviceKey === selectedServiceKey}">
      <span>${escapeHtml(route.serviceName.replace(" Service", ""))}</span><code>${escapeHtml(route.path)}</code>
    </button>
  `).join("");

  const route = selectedRoute();
  elements.selectedUrl.textContent = gatewayUrl(route);
  elements.selectedPath.textContent = route.path;
  elements.selectedService.textContent = route.serviceName;
  elements.routeDecision.textContent = `${route.path} ${arrow} ${route.serviceName}`;
  document.querySelectorAll("[data-service-key]").forEach((card) => {
    card.classList.toggle("selected-destination", card.dataset.serviceKey === selectedServiceKey);
  });
}

function serviceCard(route) {
  const instance = route.instance;
  const port = instance?.hostPort ?? fallbackPortByService[route.serviceKey];
  const configuration = [
    `Service: ${route.serviceName}`,
    `Instance: ${instance?.name ?? "started with the lesson"}`,
    `Port: ${port}`,
    `Gateway route: ${route.path}`,
    "Selection: Nginx path matching"
  ].join("&#10;");

  return `
    <lesson-service-compact class="service-card${instance ? " running" : " stopped"}" data-service-key="${route.serviceKey}" kind="${route.serviceKey}"
      data-instance-name="${escapeHtml(instance?.name ?? "")}" heading="${escapeHtml(route.serviceName)}" port=":${port}"
      configuration="${configuration}">
      <div class="service-route-label"><span>Receives</span><code>${escapeHtml(route.path)}</code></div>
      <pre class="service-log" data-log-for="${route.serviceKey}">${instance ? "No requests yet." : "Stopped"}</pre>
    </lesson-service-compact>`;
}

function renderState(nextState) {
  state = nextState;
  if (!state.routes.some((route) => route.serviceKey === selectedServiceKey)) selectedServiceKey = state.routes[0].serviceKey;

  elements.gatewayStatus.textContent = state.running ? "RUNNING" : "STOPPED";
  elements.gatewayStatus.className = `lesson-node-status ${state.running ? "running" : "stopped"}`;
  elements.publishedRoute.textContent = "localhost:7412";
  elements.poolStatus.textContent = `${state.services.length} / ${state.routes.length} running`;
  elements.poolStatus.dataset.tone = state.ready ? "ready" : state.running ? "warning" : "waiting";
  elements.start.hidden = state.ready;
  elements.start.textContent = state.running ? "Repair Routes" : "Start Lesson";
  elements.stop.disabled = !state.running;
  elements.clear.disabled = !state.running;
  elements.send.disabled = !state.ready;
  elements.copy.disabled = !state.running;
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
  elements.responseTime.textContent = "\u2014 ms";
  elements.responseServer.textContent = "waiting for response";
  elements.responsePretty.textContent = "Start the lesson, then execute a request through the API Gateway.";
  elements.responseJson.textContent = "Execute a request to inspect the original response.";
  elements.responseHeaders.textContent = "Execute a request to inspect the response headers.";
  elements.lastRoute.dataset.tone = "waiting";
  elements.lastRouteValue.textContent = "WAITING";
  elements.lastRouteMessage.textContent = "Execute a request to reveal the path decision.";
  elements.requestTrace.innerHTML = '<li class="pending"><span>1</span><div><strong>Start the lesson</strong><small>The trace will show how a path becomes a service decision.</small></div></li>';
}

function traceItem(number, title, detail, delay) {
  return `<li style="--trace-delay:${delay}ms"><span>${number}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div></li>`;
}

function renderRequestTrace(route, serverName) {
  elements.requestTrace.innerHTML = [
    traceItem(1, "Client opened one gateway connection", `The destination remained ${gatewayBaseUrl()}.`, 0),
    traceItem(2, `GET ${route.path} was sent`, "The path describes the resource the client wants.", 90),
    traceItem(3, "API Gateway inspected the HTTP path", "Nginx compared it with the configured location rules.", 180),
    traceItem(4, `${route.serviceName} route matched`, `The gateway selected the ${route.serviceKey} upstream.`, 270),
    traceItem(5, `Request forwarded to ${serverName}`, "Only the selected backend service received this request.", 360),
    traceItem(6, "Response returned through the gateway", "The client received JSON without learning the private service address.", 450)
  ].join("");
}

function prettyPayload(payload) {
  const data = payload?.data;
  if (Array.isArray(data)) return data.length ? data.map((item) => JSON.stringify(item, null, 2)).join("\n\n") : "No records returned.";
  return JSON.stringify(data ?? payload, null, 2);
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
    // Containers can briefly disappear during a lesson lifecycle transition.
  } finally {
    logsRefreshing = false;
  }
}

async function startLesson() {
  elements.start.disabled = true;
  elements.start.textContent = "Starting Gateway + Services...";
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
    elements.gatewayLogs.textContent = "Start the lesson to see routing decisions.";
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
  animateConnector(elements.clientConnector);
  window.setTimeout(() => signalNode("lesson-api-gateway-card"), 160);
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
    elements.responsePretty.textContent = prettyPayload(payload);
    elements.responseServer.textContent = serverName;
    elements.responseTime.textContent = `${(performance.now() - startedAt).toFixed(1)} ms`;
    elements.responseMeta.textContent = `200 OK \u00b7 ${route.serviceName}`;
    elements.routeDecision.textContent = `${route.path} ${arrow} ${route.serviceName}`;
    elements.lastRoute.dataset.tone = "success";
    elements.lastRouteValue.textContent = `${route.path} ${arrow} ${serverName}`;
    elements.lastRouteMessage.textContent = `${route.serviceName} was the only backend selected by this path.`;
    renderRequestTrace(route, serverName);

    animateConnector(elements.serviceConnector);
    window.setTimeout(() => signalNode(`[data-instance-name="${CSS.escape(serverName)}"]`), 260);
    await new Promise((resolve) => window.setTimeout(resolve, 360));
    await refreshLogs();
  } catch (error) {
    elements.responseMeta.textContent = "request failed";
    elements.responseTime.textContent = `${(performance.now() - startedAt).toFixed(1)} ms`;
    elements.responseServer.textContent = "request failed";
    elements.lastRoute.dataset.tone = "warning";
    elements.lastRouteValue.textContent = "REQUEST FAILED";
    elements.lastRouteMessage.textContent = error.name === "AbortError" ? "The gateway request timed out." : error.message;
    notify(elements.lastRouteMessage.textContent, true);
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
    elements.gatewayLogs.textContent = "Logs cleared. Execute another request.";
    document.querySelectorAll("[data-log-for]").forEach((log) => { log.textContent = "No requests yet."; });
    notify("Gateway and service logs cleared.");
  } catch (error) {
    notify(error.message, true);
  }
});
elements.details.addEventListener("click", () => {
  const expanded = elements.details.getAttribute("aria-expanded") === "true";
  elements.details.setAttribute("aria-expanded", String(!expanded));
  elements.details.textContent = expanded ? "Configuration" : "Hide Configuration";
  elements.detailsPanel.hidden = expanded;
});

try {
  renderState(await api("/state"));
  await refreshLogs();
} catch (error) {
  notify(error.message, true);
}

window.setInterval(refreshLogs, 2200);
