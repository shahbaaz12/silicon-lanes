import { formatResponseHeaders } from "/lessons/shared/components.js";

const apiRoot = "/api/lessons/lesson-06-advanced";
const arrow = "\u2192";
const el = {
  start: document.querySelector("#start"), stop: document.querySelector("#stop"), clear: document.querySelector("#clear"),
  send: document.querySelector("#send"), runConnections: document.querySelector("#run-connections"), copy: document.querySelector("#copy-curl"),
  routes: document.querySelector("#routes"), url: document.querySelector("#url"), decision: document.querySelector("#decision"),
  infrastructureStatus: document.querySelector("#infrastructure-status"),
  edgeLog: document.querySelector("#edge-log"), gateway1Log: document.querySelector("#gateway-1-log"),
  gateway2Log: document.querySelector("#gateway-2-log"), catalogLog: document.querySelector("#catalog-log"),
  meta: document.querySelector("#response-meta"), time: document.querySelector("#response-time"), server: document.querySelector("#response-server"),
  pretty: document.querySelector("#pretty"), json: document.querySelector("#json"), headers: document.querySelector("#headers"),
  selectedGateway: document.querySelector("#selected-gateway"), selectedServer: document.querySelector("#selected-server"),
  gatewayHistory: document.querySelector("#gateway-history"), lastRoute: document.querySelector("#last-route"),
  lastRouteValue: document.querySelector("#last-route-value"), lastRouteMessage: document.querySelector("#last-route-message"),
  requestTrace: document.querySelector("#request-trace"), clientConnector: document.querySelector(".connector-client"),
  toasts: document.querySelector("#toasts")
};

let state;
let selected = "user";
let logsRefreshing = false;
let gatewaySelections = [];

async function api(path = "", options = {}) {
  const response = await fetch(`${apiRoot}${path}`, options);
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function toast(message, error = false) {
  const item = document.createElement("div");
  item.className = `toast${error ? " error" : ""}`;
  item.textContent = message;
  el.toasts.append(item);
  window.setTimeout(() => item.remove(), 3600);
}

function route() {
  return state.routes.find(({ key }) => key === selected) ?? state.routes[0];
}

function serviceName(chosen = route()) {
  return ({ user: "User Service", catalog: "Catalog Service", order: "Order Service" })[chosen.key];
}

function routeUrl(chosen = route()) {
  const baseUrl = (state.edge?.baseUrl ?? "http://localhost:7612").replace("127.0.0.1", "localhost");
  return `${baseUrl}${chosen.path}`;
}

function journey(chosen, gateway, server) {
  const gatewayName = gateway ?? "API Gateway";
  if (chosen.via === "load-balancer") return `Edge L4 ${arrow} ${gatewayName} ${arrow} Catalog L7 ${arrow} ${server ?? "replica"}`;
  return `Edge L4 ${arrow} ${gatewayName} ${arrow} ${server ?? serviceName(chosen)}`;
}

function renderRoutes() {
  el.routes.innerHTML = state.routes.map((item) => `
    <button type="button" class="${item.key === selected ? "selected" : ""}" data-route="${item.key}" aria-pressed="${item.key === selected}">
      <b>${escapeHtml(item.name)}</b><code>${escapeHtml(item.path)}</code>
    </button>
  `).join("");
  const chosen = route();
  el.url.textContent = routeUrl(chosen);
  el.decision.textContent = journey(chosen);
  document.querySelectorAll("[data-service-path]").forEach((path) => path.classList.toggle("selected", path.dataset.servicePath === chosen.key));
}

function updateComponentConfigurations() {
  const user = state.services.find(({ serviceKey }) => serviceKey === "user");
  const order = state.services.find(({ serviceKey }) => serviceKey === "order");
  const catalogs = state.services.filter(({ serviceKey }) => serviceKey === "catalog");
  const assignments = [
    ["user", user, "/api/users", "Selected directly by either API Gateway"],
    ["order", order, "/api/orders", "Selected directly by either API Gateway"],
    ["catalog-1", catalogs[0], "/api/products", "Member of the Catalog replica pool"],
    ["catalog-2", catalogs[1], "/api/products", "Member of the Catalog replica pool"]
  ];
  for (const [key, service, path, role] of assignments) {
    const card = document.querySelector(`[data-key="${key}"]`);
    card.dataset.instanceName = service?.name ?? "";
    card.classList.toggle("stopped", !service);
    card.setAttribute("configuration", [
      `Target: ${service ? `${service.name}:${service.containerPort}` : "started with the lesson"}`,
      `Route: GET ${path}`,
      role
    ].join("\n"));
  }
  document.querySelector("#catalog-lb-node").setAttribute("configuration", [
    "Layer: L7",
    "Private listener: advancedCatalogLoadBalancer1:80",
    "Decision input: HTTP Product request",
    "Algorithm: round robin",
    `Pool: ${catalogs.length ? catalogs.map(({ name }) => name).join(", ") : "two Catalog replicas"}`
  ].join("\n"));
}

function render(next) {
  state = next;
  if (!state.routes.some(({ key }) => key === selected)) selected = "user";
  el.start.hidden = state.ready;
  el.start.textContent = state.running ? "Repair Infrastructure" : "Start Lesson";
  el.stop.disabled = !state.running;
  el.clear.disabled = !state.running;
  el.send.disabled = !state.ready;
  el.runConnections.disabled = !state.ready;
  el.copy.disabled = !state.running;
  el.infrastructureStatus.textContent = state.ready ? "READY" : state.running ? "STARTING" : "STOPPED";
  el.infrastructureStatus.dataset.tone = state.ready ? "ready" : state.running ? "warning" : "stopped";
  renderRoutes();
  updateComponentConfigurations();
}

function resetResponse() {
  gatewaySelections = [];
  el.gatewayHistory.textContent = "No connections yet";
  el.meta.textContent = "waiting";
  el.time.textContent = "\u2014 ms";
  el.server.textContent = "waiting for response";
  el.pretty.textContent = "Start the lesson, then execute a request.";
  el.json.textContent = "Execute a request to inspect the original response.";
  el.headers.textContent = "Execute a request to inspect the response headers.";
  el.selectedGateway.textContent = "Waiting";
  el.selectedServer.textContent = "Waiting";
  el.lastRoute.dataset.tone = "waiting";
  el.lastRouteValue.textContent = "WAITING";
  el.lastRouteMessage.textContent = "Execute a request to reveal every selected component.";
  el.requestTrace.innerHTML = '<li class="pending"><span>1</span><div><strong>Start the lesson</strong><small>The trace will separate connection distribution from API and service routing.</small></div></li>';
}

function animate(element, className = "flowing") {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function signal(selector, delay = 0) {
  window.setTimeout(() => document.querySelector(selector)?.signalActivity?.(), delay);
}

function traceItem(number, title, detail, delay) {
  return `<li style="--trace-delay:${delay}ms"><span>${number}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div></li>`;
}

function renderTrace(chosen, gateway, server) {
  const steps = [
    [1, "Client opened a public connection", `The destination was localhost:7612.`],
    [2, `Edge/L4 selected ${gateway}`, "The Edge Load Balancer used transport information, not the HTTP path."],
    [3, `${gateway} inspected GET ${chosen.path}`, `The API Gateway selected ${serviceName(chosen)}.`]
  ];
  if (chosen.via === "load-balancer") {
    steps.push(
      [4, "Gateway forwarded to the Catalog L7 Load Balancer", "Only the Product path enters this internal Load Balancer."],
      [5, `Catalog L7 selected ${server}`, "Round robin chose one healthy Catalog replica."],
      [6, `${server} returned the response`, "The response travelled back through the gateway and edge connection."]
    );
  } else {
    steps.push(
      [4, `Gateway forwarded directly to ${server}`, "This service has one instance in the current design."],
      [5, `${server} returned the response`, "The response travelled back through the gateway and edge connection."]
    );
  }
  el.requestTrace.innerHTML = steps.map(([number, title, detail], index) => traceItem(number, title, detail, index * 90)).join("");
}

function prettyPayload(payload) {
  const data = payload?.data;
  if (Array.isArray(data)) return data.length ? data.map((item) => JSON.stringify(item, null, 2)).join("\n\n") : "No records returned.";
  return JSON.stringify(data ?? payload, null, 2);
}

function rememberGateway(gateway) {
  if (!gateway) return;
  gatewaySelections.push(gateway);
  gatewaySelections = gatewaySelections.slice(-10);
  el.gatewayHistory.textContent = gatewaySelections.join(` ${arrow} `);
}

function showSelectedGateway(gateway) {
  document.querySelectorAll("[data-gateway-slot]").forEach((slot) => slot.classList.toggle("selected", slot.dataset.gatewaySlot === gateway));
}

async function refreshLogs() {
  if (!state?.running || logsRefreshing) return;
  logsRefreshing = true;
  try {
    const logs = await api("/logs");
    el.edgeLog.textContent = logs.edgeLogs;
    el.gateway1Log.textContent = logs.gatewayLogs.find(({ name }) => name === "advancedApiGateway1")?.logs ?? "No requests yet.";
    el.gateway2Log.textContent = logs.gatewayLogs.find(({ name }) => name === "advancedApiGateway2")?.logs ?? "No requests yet.";
    el.catalogLog.textContent = logs.catalogLogs;
    for (const log of [el.edgeLog, el.gateway1Log, el.gateway2Log, el.catalogLog]) log.scrollTop = log.scrollHeight;
  } catch {
    // A lifecycle transition can briefly make infrastructure unavailable.
  } finally {
    logsRefreshing = false;
  }
}

async function startLesson() {
  el.start.disabled = true;
  el.start.textContent = "Starting Advanced Architecture...";
  try {
    render(await api("/start", { method: "POST" }));
    resetResponse();
    await refreshLogs();
    toast("Edge, two Gateways, Catalog Load Balancer, and services are ready.");
  } catch (error) {
    toast(error.message, true);
    render(await api("/state"));
  } finally {
    el.start.disabled = false;
  }
}

async function stopLesson() {
  el.stop.disabled = true;
  try {
    await api("/stop", { method: "DELETE" });
    render(await api("/state"));
    resetResponse();
    el.edgeLog.textContent = "Start Lesson 6.";
    el.gateway1Log.textContent = "Start Lesson 6.";
    el.gateway2Log.textContent = "Start Lesson 6.";
    el.catalogLog.textContent = "Only Product requests enter this node.";
    toast("Lesson 6 infrastructure stopped.");
  } catch (error) {
    toast(error.message, true);
  }
}

async function fetchRoute(chosen, suffix = "") {
  const separator = chosen.path.includes("?") ? "&" : "?";
  const url = suffix ? `${routeUrl(chosen)}${separator}connectionExperiment=${encodeURIComponent(suffix)}` : routeUrl(chosen);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);
  return {
    response,
    payload,
    gateway: response.headers.get("x-api-gateway") ?? "unknown gateway",
    server: payload.servedBy?.server ?? response.headers.get("x-request-server") ?? "unknown server"
  };
}

function applyResult(chosen, result, elapsedMs) {
  const { response, payload, gateway, server } = result;
  rememberGateway(gateway);
  showSelectedGateway(gateway);
  el.meta.textContent = `200 OK \u00b7 ${chosen.name}`;
  el.time.textContent = `${elapsedMs.toFixed(1)} ms`;
  el.server.textContent = server;
  el.pretty.textContent = prettyPayload(payload);
  el.json.textContent = JSON.stringify(payload, null, 2);
  el.headers.textContent = formatResponseHeaders(response);
  el.selectedGateway.textContent = gateway;
  el.selectedServer.textContent = server;
  el.decision.textContent = journey(chosen, gateway, server);
  el.lastRoute.dataset.tone = "success";
  el.lastRouteValue.textContent = journey(chosen, gateway, server);
  el.lastRouteMessage.textContent = chosen.via === "load-balancer"
    ? "Three infrastructure decisions: connection to gateway, path to Catalog, then replica selection."
    : "Two infrastructure decisions: connection to gateway, then direct service routing.";
  renderTrace(chosen, gateway, server);
}

function animateJourney(chosen, gateway, server) {
  document.querySelector("lesson-client-card")?.signalActivity?.();
  animate(el.clientConnector);
  signal("#edge-node", 120);
  signal(`[data-gateway="${CSS.escape(gateway)}"]`, 260);
  const servicePath = document.querySelector(`[data-service-path="${chosen.key}"]`);
  window.setTimeout(() => animate(servicePath, "active"), 340);
  if (chosen.via === "load-balancer") signal("#catalog-lb-node", 430);
  signal(`[data-instance-name="${CSS.escape(server)}"]`, chosen.via === "load-balancer" ? 610 : 480);
}

async function performRequest() {
  const chosen = route();
  el.send.disabled = true;
  el.runConnections.disabled = true;
  el.meta.textContent = "request in flight";
  el.time.textContent = "measuring";
  const started = performance.now();
  try {
    const result = await fetchRoute(chosen);
    applyResult(chosen, result, performance.now() - started);
    animateJourney(chosen, result.gateway, result.server);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    await refreshLogs();
  } catch (error) {
    el.meta.textContent = "request failed";
    el.time.textContent = `${(performance.now() - started).toFixed(1)} ms`;
    el.server.textContent = "request failed";
    el.lastRoute.dataset.tone = "warning";
    el.lastRouteValue.textContent = "REQUEST FAILED";
    el.lastRouteMessage.textContent = error.message;
    toast(error.message, true);
  } finally {
    el.send.disabled = !state.ready;
    el.runConnections.disabled = !state.ready;
  }
}

async function runConnectionExperiment() {
  const chosen = route();
  el.send.disabled = true;
  el.runConnections.disabled = true;
  el.runConnections.textContent = "Opening connections...";
  el.meta.textContent = "6 concurrent requests";
  const started = performance.now();
  try {
    const batchId = Date.now();
    const previousSelections = [...gatewaySelections];
    const results = await Promise.all(Array.from({ length: 6 }, (_, index) => fetchRoute(chosen, `${batchId}-${index}`)));
    const gateways = results.map(({ gateway }) => gateway);
    const uniqueGateways = [...new Set(gateways)];
    uniqueGateways.forEach((gateway, index) => signal(`[data-gateway="${CSS.escape(gateway)}"]`, 160 + index * 100));
    signal("#edge-node", 80);
    const finalResult = results.at(-1);
    applyResult(chosen, finalResult, performance.now() - started);
    gatewaySelections = [...previousSelections, ...gateways].slice(-10);
    el.gatewayHistory.textContent = gatewaySelections.join(` ${arrow} `);
    el.lastRouteMessage.textContent = `${gateways.length} requests used ${uniqueGateways.length} gateway instance${uniqueGateways.length === 1 ? "" : "s"}: ${uniqueGateways.join(", ")}.`;
    if (chosen.via === "load-balancer") signal("#catalog-lb-node", 420);
    signal(`[data-instance-name="${CSS.escape(finalResult.server)}"]`, 540);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    await refreshLogs();
    toast(`Gateway distribution: ${gateways.join(` ${arrow} `)}`);
  } catch (error) {
    el.meta.textContent = "experiment failed";
    toast(error.message, true);
  } finally {
    el.runConnections.textContent = "Open 6 connections";
    el.send.disabled = !state.ready;
    el.runConnections.disabled = !state.ready;
  }
}

el.routes.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route]");
  if (!button) return;
  selected = button.dataset.route;
  renderRoutes();
});
el.start.addEventListener("click", startLesson);
el.stop.addEventListener("click", stopLesson);
el.send.addEventListener("click", performRequest);
el.runConnections.addEventListener("click", runConnectionExperiment);
el.clear.addEventListener("click", async () => {
  try {
    await api("/logs", { method: "DELETE" });
    el.edgeLog.textContent = "Logs cleared. Open another connection.";
    el.gateway1Log.textContent = "Logs cleared. Execute another request.";
    el.gateway2Log.textContent = "Logs cleared. Execute another request.";
    el.catalogLog.textContent = "Logs cleared. Product requests will appear here.";
    toast("Infrastructure logs cleared.");
  } catch (error) {
    toast(error.message, true);
  }
});
el.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`curl --request GET "${routeUrl()}"`);
    toast("cURL copied. Paste it into a terminal or import it into Postman.");
  } catch {
    toast("Could not copy the cURL command.", true);
  }
});

try {
  render(await api("/state"));
  await refreshLogs();
} catch (error) {
  toast(error.message, true);
}

window.setInterval(refreshLogs, 2400);
