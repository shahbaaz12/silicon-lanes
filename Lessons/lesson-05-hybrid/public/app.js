import { formatResponseHeaders } from "/lessons/shared/components.js";

const apiRoot = "/api/lessons/lesson-05-hybrid";
const arrow = "\u2192";
const el = {
  start: document.querySelector("#start"), stop: document.querySelector("#stop"), clear: document.querySelector("#clear"),
  send: document.querySelector("#send"), runProducts: document.querySelector("#run-products"), copy: document.querySelector("#copy-curl"),
  routes: document.querySelector("#routes"), url: document.querySelector("#url"), decision: document.querySelector("#decision"),
  gatewayStatus: document.querySelector("#gateway-status"), gatewayLog: document.querySelector("#gateway-log"), lbLog: document.querySelector("#lb-log"),
  meta: document.querySelector("#response-meta"), time: document.querySelector("#response-time"), server: document.querySelector("#response-server"),
  pretty: document.querySelector("#pretty"), json: document.querySelector("#json"), headers: document.querySelector("#headers"),
  selectedService: document.querySelector("#selected-service"), lbUsed: document.querySelector("#lb-used"), catalogHistory: document.querySelector("#catalog-history"),
  lastRoute: document.querySelector("#last-route"), lastRouteValue: document.querySelector("#last-route-value"), lastRouteMessage: document.querySelector("#last-route-message"),
  requestTrace: document.querySelector("#request-trace"), clientConnector: document.querySelector(".connector-client"), toasts: document.querySelector("#toasts")
};

let state;
let selected = "user";
let logsRefreshing = false;
let catalogSelections = [];

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
  window.setTimeout(() => item.remove(), 3400);
}

function route() {
  return state.routes.find(({ key }) => key === selected) ?? state.routes[0];
}

function serviceName(chosen = route()) {
  return ({ user: "User Service", catalog: "Catalog Service", order: "Order Service" })[chosen.key];
}

function routeUrl(chosen = route()) {
  const baseUrl = (state.gateway?.baseUrl ?? "http://localhost:7512").replace("127.0.0.1", "localhost");
  return `${baseUrl}${chosen.path}`;
}

function routeDecision(chosen = route(), server) {
  if (chosen.via === "load-balancer") return `${chosen.path} ${arrow} L7 Load Balancer ${arrow} ${server ?? "Catalog replica"}`;
  return `${chosen.path} ${arrow} ${server ?? serviceName(chosen)}`;
}

function renderRoutes() {
  el.routes.innerHTML = state.routes.map((item) => `
    <button type="button" class="${item.key === selected ? "selected" : ""}" data-route="${item.key}" aria-pressed="${item.key === selected}">
      <b>${escapeHtml(item.name)}</b><code>${escapeHtml(item.path)}</code>
    </button>
  `).join("");
  const chosen = route();
  el.url.textContent = routeUrl(chosen);
  el.decision.textContent = routeDecision(chosen);
  el.selectedService.textContent = serviceName(chosen);
  el.lbUsed.textContent = chosen.via === "load-balancer" ? "Yes - L7" : "No";
  document.querySelectorAll("[data-lane]").forEach((lane) => lane.classList.toggle("selected", lane.dataset.lane === chosen.key));
}

function updateLiteCards() {
  const user = state.services.find(({ serviceKey }) => serviceKey === "user");
  const order = state.services.find(({ serviceKey }) => serviceKey === "order");
  const catalogs = state.services.filter(({ serviceKey }) => serviceKey === "catalog");
  const assignments = [
    ["user", user, "/api/users", "Selected directly by the API Gateway"],
    ["order", order, "/api/orders", "Selected directly by the API Gateway"],
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
  document.querySelector("#gateway-node").setAttribute("configuration", [
    "Layer: L7",
    "Published address: localhost:7512",
    `User route: direct to ${user?.name ?? "User Service"}`,
    "Product route: through hybridLoadBalancer1",
    `Order route: direct to ${order?.name ?? "Order Service"}`
  ].join("\n"));
  document.querySelector("#lb-node").setAttribute("configuration", [
    "Layer: L7",
    "Private listener: hybridLoadBalancer1:80",
    "Algorithm: round robin",
    `Pool: ${catalogs.length ? catalogs.map(({ name }) => name).join(", ") : "two Catalog replicas"}`,
    "Receives only /api/products"
  ].join("\n"));
}

function render(next) {
  state = next;
  if (!state.routes.some(({ key }) => key === selected)) selected = "user";
  el.start.hidden = state.ready;
  el.start.textContent = state.running ? "Repair Architecture" : "Start Lesson";
  el.stop.disabled = !state.running;
  el.clear.disabled = !state.running;
  el.send.disabled = !state.ready;
  el.runProducts.disabled = !state.ready;
  el.copy.disabled = !state.running;
  el.gatewayStatus.textContent = state.ready ? "READY" : state.running ? "STARTING" : "STOPPED";
  el.gatewayStatus.dataset.tone = state.ready ? "ready" : state.running ? "warning" : "stopped";
  renderRoutes();
  updateLiteCards();
}

function resetResponse() {
  catalogSelections = [];
  el.catalogHistory.textContent = "No requests yet";
  el.meta.textContent = "waiting";
  el.time.textContent = "\u2014 ms";
  el.server.textContent = "waiting for response";
  el.pretty.textContent = "Start the lesson, then execute a request.";
  el.json.textContent = "Execute a request to inspect the original response.";
  el.headers.textContent = "Execute a request to inspect the response headers.";
  el.lastRoute.dataset.tone = "waiting";
  el.lastRouteValue.textContent = "WAITING";
  el.lastRouteMessage.textContent = "Execute a request to compare the paths.";
  el.requestTrace.innerHTML = '<li class="pending"><span>1</span><div><strong>Start the lesson</strong><small>The trace will reveal whether the request needs one routing decision or two.</small></div></li>';
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

function renderTrace(chosen, server) {
  const common = [
    [1, "Client sent one gateway request", `GET ${chosen.path} was sent to localhost:7512.`],
    [2, "API Gateway inspected the path", `The gateway selected ${serviceName(chosen)}.`]
  ];
  const routeSpecific = chosen.via === "load-balancer"
    ? [
        [3, "Gateway forwarded to the Catalog Load Balancer", "The Product path needs horizontally scaled capacity."],
        [4, "L7 Load Balancer selected a replica", `Round robin selected ${server}.`],
        [5, `${server} handled the request`, "Only one Catalog replica performed the application work."],
        [6, "Response returned through both infrastructure layers", "The client still knows only the gateway address."]
      ]
    : [
        [3, `Gateway forwarded directly to ${server}`, "This service has one instance, so no Load Balancer is needed."],
        [4, `${server} handled the request`, "The application service performed its business work."],
        [5, "Response returned through the API Gateway", "The client still knows only the gateway address."]
      ];
  el.requestTrace.innerHTML = [...common, ...routeSpecific]
    .map(([number, title, detail], index) => traceItem(number, title, detail, index * 90))
    .join("");
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
    const logs = await api("/logs");
    el.gatewayLog.textContent = logs.gatewayLogs;
    el.lbLog.textContent = logs.loadBalancerLogs;
    el.gatewayLog.scrollTop = el.gatewayLog.scrollHeight;
    el.lbLog.scrollTop = el.lbLog.scrollHeight;
  } catch {
    // A lifecycle transition can briefly make infrastructure unavailable.
  } finally {
    logsRefreshing = false;
  }
}

async function startLesson() {
  el.start.disabled = true;
  el.start.textContent = "Starting Hybrid Architecture...";
  try {
    render(await api("/start", { method: "POST" }));
    resetResponse();
    await refreshLogs();
    toast("Gateway, Load Balancer, and four services are ready.");
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
    el.gatewayLog.textContent = "Start Lesson 5.";
    el.lbLog.textContent = "Only Catalog requests enter this node.";
    toast("Lesson 5 containers stopped.");
  } catch (error) {
    toast(error.message, true);
  }
}

async function performRequest({ keepControlsDisabled = false } = {}) {
  const chosen = route();
  el.send.disabled = true;
  el.runProducts.disabled = true;
  el.meta.textContent = "request in flight";
  el.time.textContent = "measuring";
  document.querySelector("lesson-client-card")?.signalActivity?.();
  animate(el.clientConnector);
  signal("#gateway-node", 150);
  const lane = document.querySelector(`[data-lane="${chosen.key}"]`);
  window.setTimeout(() => animate(lane, "active"), 210);
  const started = performance.now();

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    let response;
    try {
      response = await fetch(routeUrl(chosen), { cache: "no-store", signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);

    const server = payload.servedBy?.server ?? response.headers.get("x-request-server") ?? "unknown server";
    if (chosen.via === "load-balancer") {
      signal("#lb-node", 260);
      signal(`[data-instance-name="${CSS.escape(server)}"]`, 440);
      catalogSelections.push(server);
      catalogSelections = catalogSelections.slice(-8);
      el.catalogHistory.textContent = catalogSelections.join(` ${arrow} `);
    } else {
      signal(`[data-instance-name="${CSS.escape(server)}"]`, 300);
    }

    el.meta.textContent = `200 OK \u00b7 ${chosen.name}`;
    el.time.textContent = `${(performance.now() - started).toFixed(1)} ms`;
    el.server.textContent = server;
    el.pretty.textContent = prettyPayload(payload);
    el.json.textContent = JSON.stringify(payload, null, 2);
    el.headers.textContent = formatResponseHeaders(response);
    el.decision.textContent = routeDecision(chosen, server);
    el.lastRoute.dataset.tone = "success";
    el.lastRouteValue.textContent = routeDecision(chosen, server);
    el.lastRouteMessage.textContent = chosen.via === "load-balancer"
      ? "Two decisions: the gateway chose Catalog, then the Load Balancer chose a replica."
      : `One routing decision: the gateway forwarded directly to ${server}.`;
    renderTrace(chosen, server);
    await new Promise((resolve) => window.setTimeout(resolve, 520));
    await refreshLogs();
    return server;
  } catch (error) {
    el.meta.textContent = "request failed";
    el.time.textContent = `${(performance.now() - started).toFixed(1)} ms`;
    el.server.textContent = "request failed";
    el.lastRoute.dataset.tone = "warning";
    el.lastRouteValue.textContent = "REQUEST FAILED";
    el.lastRouteMessage.textContent = error.name === "AbortError" ? "The gateway request timed out." : error.message;
    toast(el.lastRouteMessage.textContent, true);
    return null;
  } finally {
    if (!keepControlsDisabled) {
      el.send.disabled = !state.ready;
      el.runProducts.disabled = !state.ready;
    }
  }
}

async function runProductExperiment() {
  selected = "catalog";
  renderRoutes();
  el.send.disabled = true;
  el.runProducts.disabled = true;
  el.runProducts.textContent = "Running 4 requests...";
  const selections = [];
  try {
    for (let index = 0; index < 4; index += 1) {
      const server = await performRequest({ keepControlsDisabled: true });
      if (!server) break;
      selections.push(server);
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
    if (selections.length === 4) toast(`Catalog distribution: ${selections.join(` ${arrow} `)}`);
  } finally {
    el.runProducts.textContent = "Run 4 Product requests";
    el.send.disabled = !state.ready;
    el.runProducts.disabled = !state.ready;
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
el.clear.addEventListener("click", async () => {
  try {
    await api("/logs", { method: "DELETE" });
    el.gatewayLog.textContent = "Logs cleared. Execute another request.";
    el.lbLog.textContent = "Logs cleared. Product requests will appear here.";
    toast("Infrastructure logs cleared.");
  } catch (error) {
    toast(error.message, true);
  }
});
el.send.addEventListener("click", () => performRequest());
el.runProducts.addEventListener("click", runProductExperiment);
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
