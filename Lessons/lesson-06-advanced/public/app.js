import { formatResponseHeaders } from "/lessons/shared/components.js";

const apiRoot = "/api/lessons/lesson-06-advanced";
const el = {
  start: document.querySelector("#start"), stop: document.querySelector("#stop"), clear: document.querySelector("#clear"), send: document.querySelector("#send"),
  routes: document.querySelector("#routes"), url: document.querySelector("#url"), decision: document.querySelector("#decision"),
  edgeLog: document.querySelector("#edge-log"), gateway1Log: document.querySelector("#gateway-1-log"), gateway2Log: document.querySelector("#gateway-2-log"), catalogLog: document.querySelector("#catalog-log"),
  meta: document.querySelector("#response-meta"), time: document.querySelector("#response-time"), server: document.querySelector("#response-server"),
  pretty: document.querySelector("#pretty"), json: document.querySelector("#json"), headers: document.querySelector("#headers"), toasts: document.querySelector("#toasts")
};
let state;
let selected = "user";

async function api(path = "", options = {}) {
  const response = await fetch(`${apiRoot}${path}`, options);
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

function toast(message, error = false) {
  const item = document.createElement("div"); item.className = `toast${error ? " error" : ""}`; item.textContent = message; el.toasts.append(item);
  window.setTimeout(() => item.remove(), 3200);
}

function route() { return state.routes.find(({ key }) => key === selected) ?? state.routes[0]; }
function routeUrl() { return `${state.edge?.baseUrl ?? "http://127.0.0.1:7612"}${route().path}`; }

function renderRoutes() {
  el.routes.innerHTML = state.routes.map((item) => `<button class="${item.key === selected ? "selected" : ""}" data-route="${item.key}"><b>${item.name}</b><code>${item.path}</code></button>`).join("");
  el.url.textContent = routeUrl();
  el.decision.textContent = `Edge LB → Gateway → ${route().via === "load-balancer" ? "Catalog LB → replica" : `${route().name} Service`}`;
}

function updateServiceCards() {
  const user = state.services.find(({ serviceKey }) => serviceKey === "user");
  const order = state.services.find(({ serviceKey }) => serviceKey === "order");
  const catalogs = state.services.filter(({ serviceKey }) => serviceKey === "catalog");
  for (const [key, service] of [["user", user], ["order", order], ["catalog-1", catalogs[0]], ["catalog-2", catalogs[1]]]) {
    document.querySelector(`[data-key="${key}"]`).dataset.instanceName = service?.name ?? "";
  }
}

function render(next) {
  state = next;
  el.start.hidden = state.ready; el.stop.disabled = !state.running; el.clear.disabled = !state.running; el.send.disabled = !state.ready;
  renderRoutes(); updateServiceCards();
}

function resetResponse() {
  el.meta.textContent = "waiting"; el.time.textContent = "— ms"; el.server.textContent = "waiting for response";
  el.pretty.textContent = "Start the lesson, then send a request."; el.json.textContent = "No JSON response yet."; el.headers.textContent = "No response headers yet.";
}

async function refreshLogs() {
  if (!state?.running) return;
  try {
    const logs = await api("/logs");
    el.edgeLog.textContent = logs.edgeLogs;
    el.gateway1Log.textContent = logs.gatewayLogs.find(({ name }) => name === "advancedApiGateway1")?.logs ?? "No requests yet.";
    el.gateway2Log.textContent = logs.gatewayLogs.find(({ name }) => name === "advancedApiGateway2")?.logs ?? "No requests yet.";
    el.catalogLog.textContent = logs.catalogLogs;
    for (const log of [el.edgeLog, el.gateway1Log, el.gateway2Log, el.catalogLog]) log.scrollTop = log.scrollHeight;
  } catch { /* lifecycle transition */ }
}

function signal(selector, delay) { window.setTimeout(() => document.querySelector(selector)?.signalActivity(), delay); }

el.routes.addEventListener("click", (event) => { const button = event.target.closest("[data-route]"); if (button) { selected = button.dataset.route; renderRoutes(); } });
el.start.addEventListener("click", async () => { el.start.disabled = true; try { render(await api("/start", { method: "POST" })); resetResponse(); await refreshLogs(); toast("Advanced architecture ready."); } catch (error) { toast(error.message, true); } finally { el.start.disabled = false; } });
el.stop.addEventListener("click", async () => { el.stop.disabled = true; try { await api("/stop", { method: "DELETE" }); render(await api("/state")); resetResponse(); el.edgeLog.textContent = "Start Lesson 6."; el.gateway1Log.textContent = "Start Lesson 6."; el.gateway2Log.textContent = "Start Lesson 6."; el.catalogLog.textContent = "Only Product requests enter this node."; toast("Lesson 6 stopped."); } catch (error) { toast(error.message, true); } });
el.clear.addEventListener("click", async () => { try { await api("/logs", { method: "DELETE" }); await refreshLogs(); toast("Logs cleared."); } catch (error) { toast(error.message, true); } });
el.send.addEventListener("click", async () => {
  el.send.disabled = true; const chosen = route(); const started = performance.now();
  document.querySelector("lesson-client-card").signalActivity(); signal("#edge-node", 70);
  try {
    const response = await fetch(routeUrl(), { cache: "no-store" }); const payload = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const gateway = response.headers.get("x-api-gateway");
    const server = payload.servedBy?.server ?? response.headers.get("x-request-server");
    signal(`[data-gateway="${CSS.escape(gateway)}"]`, 150);
    if (chosen.via === "load-balancer") signal("#catalog-lb-node", 250);
    signal(`[data-instance-name="${CSS.escape(server)}"]`, chosen.via === "load-balancer" ? 350 : 250);
    el.meta.textContent = `200 OK · ${chosen.name}`; el.time.textContent = `${(performance.now() - started).toFixed(1)} ms`; el.server.textContent = `${gateway} → ${server}`;
    el.pretty.textContent = JSON.stringify(payload.data, null, 2); el.json.textContent = JSON.stringify(payload, null, 2); el.headers.textContent = formatResponseHeaders(response);
    el.decision.textContent = chosen.via === "load-balancer" ? `Edge LB → ${gateway} → Catalog LB → ${server}` : `Edge LB → ${gateway} → ${server}`;
    await new Promise((resolve) => window.setTimeout(resolve, 420)); await refreshLogs();
  } catch (error) { el.meta.textContent = "request failed"; toast(error.message, true); }
  finally { el.send.disabled = !state.ready; }
});

try { render(await api("/state")); await refreshLogs(); } catch (error) { toast(error.message, true); }
window.setInterval(refreshLogs, 2400);
