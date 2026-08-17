import { formatResponseHeaders } from "/lessons/shared/components.js";

const apiRoot = "/api/lessons/lesson-07-local-cdn";
const arrow = "→";
const el = {
  start: document.querySelector("#start"), stop: document.querySelector("#stop"), clear: document.querySelector("#clear"),
  clearCache: document.querySelector("#clear-cache"), send: document.querySelector("#send"), cacheDemo: document.querySelector("#cache-demo"),
  copy: document.querySelector("#copy-curl"), routes: document.querySelector("#routes"), url: document.querySelector("#url"),
  decision: document.querySelector("#decision"), infrastructureStatus: document.querySelector("#infrastructure-status"),
  cacheResult: document.querySelector("#cache-result"),
  cdnLog: document.querySelector("#cdn-log"), edgeLog: document.querySelector("#edge-log"), gateway1Log: document.querySelector("#gateway-1-log"),
  gateway2Log: document.querySelector("#gateway-2-log"), catalogLog: document.querySelector("#catalog-log"),
  meta: document.querySelector("#response-meta"), time: document.querySelector("#response-time"), server: document.querySelector("#response-server"),
  pretty: document.querySelector("#pretty"), json: document.querySelector("#json"), headers: document.querySelector("#headers"),
  summaryRoute: document.querySelector("#summary-route"), summaryCache: document.querySelector("#summary-cache"), summaryServer: document.querySelector("#summary-server"),
  lastRoute: document.querySelector("#last-route"), lastRouteValue: document.querySelector("#last-route-value"), lastRouteMessage: document.querySelector("#last-route-message"),
  requestTrace: document.querySelector("#request-trace"), clientConnector: document.querySelector(".connector-client"), cdnDescend: document.querySelector(".cdn-descend"),
  toasts: document.querySelector("#toasts")
};

let state;
let selected = "catalog";
let logsRefreshing = false;

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
  return `${state.cdn?.baseUrl ?? "http://127.0.0.1:7712"}${chosen.path}`;
}

function journeyHint(chosen) {
  return chosen.key === "catalog" ? `CDN ${arrow} HIT, or full origin on MISS` : `CDN BYPASS ${arrow} full origin, always`;
}

function journeyText(chosen, cacheStatus, gateway, server) {
  if (cacheStatus === "HIT") return `CDN HIT ${arrow} response (origin skipped)`;
  const originPath = chosen.via === "load-balancer"
    ? `Edge L4 ${arrow} ${gateway ?? "API Gateway"} ${arrow} Catalog L7 ${arrow} ${server ?? "replica"}`
    : `Edge L4 ${arrow} ${gateway ?? "API Gateway"} ${arrow} ${server ?? serviceName(chosen)}`;
  return `CDN ${cacheStatus} ${arrow} ${originPath}`;
}

function updateCacheDemoAvailability() {
  el.cacheDemo.disabled = !state.ready || route().key !== "catalog";
}

function renderRoutes() {
  el.routes.innerHTML = state.routes.map((item) => `
    <button type="button" class="${item.key === selected ? "selected" : ""}" data-route="${item.key}" aria-pressed="${item.key === selected}">
      <b>${escapeHtml(item.name)}</b><code>${escapeHtml(item.path)}</code>
    </button>
  `).join("");
  const chosen = route();
  el.url.textContent = routeUrl(chosen);
  el.decision.textContent = journeyHint(chosen);
  document.querySelectorAll("[data-service-path]").forEach((path) => path.classList.toggle("selected", path.dataset.servicePath === chosen.key));
  updateCacheDemoAvailability();
}

function updateComponentConfigurations() {
  const user = state.services.find(({ serviceKey }) => serviceKey === "user");
  const order = state.services.find(({ serviceKey }) => serviceKey === "order");
  const catalogs = state.services.filter(({ serviceKey }) => serviceKey === "catalog");
  const assignments = [
    ["user", user, "/api/users", "CDN policy: BYPASS"],
    ["order", order, "/api/orders", "CDN policy: BYPASS"],
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
    "Reached only on a cache MISS",
    "Algorithm: round robin",
    `Pool: ${catalogs.length ? catalogs.map(({ name }) => name).join(", ") : "two Catalog replicas"}`
  ].join("\n"));
}

function render(next) {
  state = next;
  if (!state.routes.some(({ key }) => key === selected)) selected = "catalog";
  el.start.hidden = state.ready;
  el.start.textContent = state.running ? "Repair Infrastructure" : "Start Lesson";
  el.stop.disabled = !state.running;
  el.clear.disabled = !state.running;
  el.clearCache.disabled = !state.running;
  el.send.disabled = !state.ready;
  el.copy.disabled = !state.running;
  el.infrastructureStatus.textContent = state.ready ? "READY" : state.running ? "STARTING" : "STOPPED";
  el.infrastructureStatus.dataset.tone = state.ready ? "ready" : state.running ? "warning" : "stopped";
  renderRoutes();
  updateComponentConfigurations();
}

function resetResponse() {
  el.meta.textContent = "waiting";
  el.time.textContent = "— ms";
  el.server.textContent = "waiting for response";
  el.pretty.textContent = "Start the lesson, then request Products twice.";
  el.json.textContent = "Execute a request to inspect the original response.";
  el.headers.textContent = "Execute a request to inspect the response headers, including X-Cache-Status.";
  el.cacheResult.textContent = "WAITING";
  el.cacheResult.dataset.tone = "waiting";
  el.summaryRoute.textContent = "Waiting";
  el.summaryCache.textContent = "Waiting";
  el.summaryServer.textContent = "Waiting";
  el.lastRoute.dataset.tone = "waiting";
  el.lastRouteValue.textContent = "WAITING";
  el.lastRouteMessage.textContent = "Execute a request to reveal every component it touched.";
  el.requestTrace.innerHTML = '<li class="pending"><span>1</span><div><strong>Start the lesson</strong><small>The trace will separate a cache answer from a full origin round trip.</small></div></li>';
}

function animate(element, className = "flowing") {
  if (!element) return;
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

function renderTrace(chosen, cacheStatus, gateway, server) {
  const steps = [[1, "Client requested the CDN", `The destination was ${routeUrl(chosen)}.`]];
  if (cacheStatus === "HIT") {
    steps.push([2, "CDN returned the cached response", "A fresh entry existed from a previous request. The origin was never contacted."]);
  } else {
    steps.push([2, `CDN evaluated its cache policy: ${cacheStatus}`, cacheStatus === "MISS"
      ? "No fresh entry existed, so the CDN forwarded the request to the origin."
      : "This route is outside the cache policy by design."]);
    steps.push([3, `Edge/L4 selected ${gateway ?? "a gateway"}`, "The Edge Load Balancer used transport information, not the HTTP path."]);
    steps.push([4, `${gateway ?? "The gateway"} inspected GET ${chosen.path}`, `The API Gateway selected ${serviceName(chosen)}.`]);
    if (chosen.via === "load-balancer") {
      steps.push([5, "Gateway forwarded to the Catalog L7 Load Balancer", "Only the Product path enters this internal Load Balancer."]);
      steps.push([6, `Catalog L7 selected ${server}`, "Round robin chose one healthy Catalog replica."]);
      steps.push([7, `${server} returned the response`, cacheStatus === "MISS" ? "The CDN stored this response for 15 seconds before returning it." : "Product responses on other cache states are not stored."]);
    } else {
      steps.push([5, `Gateway forwarded directly to ${server}`, "This service has one instance in the current design."]);
      steps.push([6, `${server} returned the response`, "User and Order routes are outside the cache policy, so this step always runs."]);
    }
  }
  el.requestTrace.innerHTML = steps.map(([number, title, detail], index) => traceItem(number, title, detail, index * 90)).join("");
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
    el.cdnLog.textContent = logs.cdnLogs;
    el.edgeLog.textContent = logs.edgeLogs;
    el.gateway1Log.textContent = logs.gatewayLogs.find(({ name }) => name === "advancedApiGateway1")?.logs ?? "No requests yet.";
    el.gateway2Log.textContent = logs.gatewayLogs.find(({ name }) => name === "advancedApiGateway2")?.logs ?? "No requests yet.";
    el.catalogLog.textContent = logs.catalogLogs;
    for (const log of [el.cdnLog, el.edgeLog, el.gateway1Log, el.gateway2Log, el.catalogLog]) log.scrollTop = log.scrollHeight;
  } catch {
    // A lifecycle transition can briefly make infrastructure unavailable.
  } finally {
    logsRefreshing = false;
  }
}

async function startLesson() {
  el.start.disabled = true;
  el.start.textContent = "Starting Local CDN...";
  try {
    render(await api("/start", { method: "POST" }));
    resetResponse();
    await refreshLogs();
    toast("Local CDN and the Lesson 6 origin are ready. Request Products twice.");
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
    el.cdnLog.textContent = "Start Lesson 7.";
    el.edgeLog.textContent = "Origin is skipped on HIT.";
    el.gateway1Log.textContent = "Origin is skipped on HIT.";
    el.gateway2Log.textContent = "Origin is skipped on HIT.";
    el.catalogLog.textContent = "Origin is skipped on HIT.";
    toast("Lesson 7 infrastructure stopped.");
  } catch (error) {
    toast(error.message, true);
  }
}

async function fetchRoute(chosen) {
  const response = await fetch(routeUrl(chosen), { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);
  return {
    response,
    payload,
    cacheStatus: response.headers.get("x-cache-status") ?? "BYPASS",
    gateway: response.headers.get("x-api-gateway"),
    server: payload.servedBy?.server ?? response.headers.get("x-request-server") ?? null
  };
}

function applyResult(chosen, result, elapsedMs) {
  const { response, payload, cacheStatus, gateway, server } = result;
  const tone = { HIT: "hit", MISS: "miss", BYPASS: "bypass" }[cacheStatus] ?? "waiting";
  el.cacheResult.textContent = cacheStatus;
  el.cacheResult.dataset.tone = tone;
  el.meta.textContent = `200 OK · ${cacheStatus}`;
  el.time.textContent = `${elapsedMs.toFixed(1)} ms`;
  el.server.textContent = cacheStatus === "HIT" ? "Local CDN cache" : server ? `${gateway ?? "gateway"} ${arrow} ${server}` : "unknown server";
  el.pretty.textContent = prettyPayload(payload);
  el.json.textContent = JSON.stringify(payload, null, 2);
  el.headers.textContent = formatResponseHeaders(response);
  el.summaryRoute.textContent = chosen.name;
  el.summaryCache.textContent = cacheStatus;
  el.summaryServer.textContent = cacheStatus === "HIT" ? "Local CDN cache" : server ?? "waiting";
  const journey = journeyText(chosen, cacheStatus, gateway, server);
  el.decision.textContent = journey;
  el.lastRoute.dataset.tone = cacheStatus === "HIT" ? "success" : "info";
  el.lastRouteValue.textContent = journey;
  el.lastRouteMessage.textContent = cacheStatus === "HIT"
    ? "The CDN answered from its own cache. Nothing downstream was contacted."
    : cacheStatus === "MISS"
      ? "No fresh entry existed, so the CDN crossed the entire origin chain and stored the response."
      : "This route is outside the cache policy by design, so it always crosses the full origin chain.";
  renderTrace(chosen, cacheStatus, gateway, server);
}

function animateJourney(chosen, cacheStatus, gateway, server) {
  document.querySelector("lesson-client-card")?.signalActivity?.();
  animate(el.clientConnector);
  signal("#cdn-node", 120);
  if (cacheStatus === "HIT") return;
  animate(el.cdnDescend);
  signal("#edge-node", 260);
  if (gateway) signal(`[data-gateway="${CSS.escape(gateway)}"]`, 380);
  const servicePath = document.querySelector(`[data-service-path="${chosen.key}"]`);
  window.setTimeout(() => animate(servicePath, "active"), 460);
  if (chosen.via === "load-balancer") signal("#catalog-lb-node", 540);
  if (server) signal(`[data-instance-name="${CSS.escape(server)}"]`, chosen.via === "load-balancer" ? 700 : 560);
}

async function performRequest() {
  const chosen = route();
  el.send.disabled = true;
  el.cacheDemo.disabled = true;
  el.meta.textContent = "request in flight";
  el.time.textContent = "measuring";
  const started = performance.now();
  try {
    const result = await fetchRoute(chosen);
    applyResult(chosen, result, performance.now() - started);
    animateJourney(chosen, result.cacheStatus, result.gateway, result.server);
    await new Promise((resolve) => window.setTimeout(resolve, result.cacheStatus === "HIT" ? 350 : 700));
    await refreshLogs();
  } catch (error) {
    el.meta.textContent = "request failed";
    el.time.textContent = `${(performance.now() - started).toFixed(1)} ms`;
    el.server.textContent = "request failed";
    el.cacheResult.textContent = "FAILED";
    el.cacheResult.dataset.tone = "warning";
    el.lastRoute.dataset.tone = "warning";
    el.lastRouteValue.textContent = "REQUEST FAILED";
    el.lastRouteMessage.textContent = error.message;
    toast(error.message, true);
  } finally {
    el.send.disabled = !state.ready;
    updateCacheDemoAvailability();
  }
}

async function runCacheDemo() {
  const chosen = route();
  if (chosen.key !== "catalog") return;
  el.send.disabled = true;
  el.cacheDemo.disabled = true;
  const originalLabel = el.cacheDemo.textContent;
  try {
    el.cacheDemo.textContent = "Clearing cache...";
    await api("/cache", { method: "DELETE" });
    el.cacheDemo.textContent = "Requesting (expect MISS)...";
    const firstStart = performance.now();
    const first = await fetchRoute(chosen);
    applyResult(chosen, first, performance.now() - firstStart);
    animateJourney(chosen, first.cacheStatus, first.gateway, first.server);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    await refreshLogs();

    el.cacheDemo.textContent = "Requesting again (expect HIT)...";
    const secondStart = performance.now();
    const second = await fetchRoute(chosen);
    applyResult(chosen, second, performance.now() - secondStart);
    animateJourney(chosen, second.cacheStatus, second.gateway, second.server);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    await refreshLogs();

    toast(`First request: ${first.cacheStatus}. Second request: ${second.cacheStatus}.`);
  } catch (error) {
    toast(error.message, true);
  } finally {
    el.cacheDemo.textContent = originalLabel;
    el.send.disabled = !state.ready;
    updateCacheDemoAvailability();
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
el.cacheDemo.addEventListener("click", runCacheDemo);
el.clear.addEventListener("click", async () => {
  try {
    await api("/logs", { method: "DELETE" });
    el.cdnLog.textContent = "Logs cleared. Send another request.";
    el.edgeLog.textContent = "Logs cleared. Origin is skipped on HIT.";
    el.gateway1Log.textContent = "Logs cleared. Origin is skipped on HIT.";
    el.gateway2Log.textContent = "Logs cleared. Origin is skipped on HIT.";
    el.catalogLog.textContent = "Logs cleared. Origin is skipped on HIT.";
    toast("Infrastructure logs cleared.");
  } catch (error) {
    toast(error.message, true);
  }
});
el.clearCache.addEventListener("click", async () => {
  try {
    await api("/cache", { method: "DELETE" });
    el.cacheResult.textContent = "CLEARED";
    el.cacheResult.dataset.tone = "miss";
    toast("CDN cache cleared. The next Product request will MISS.");
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
