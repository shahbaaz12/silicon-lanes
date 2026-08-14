import { formatResponseHeaders } from "/lessons/shared/components.js";

const apiRoot = "/api/lessons/lesson-07-local-cdn";
const el = {
  start: document.querySelector("#start"), stop: document.querySelector("#stop"), clear: document.querySelector("#clear"), clearCache: document.querySelector("#clear-cache"), send: document.querySelector("#send"),
  routes: document.querySelector("#routes"), url: document.querySelector("#url"), decision: document.querySelector("#decision"), cacheResult: document.querySelector("#cache-result"),
  cdnLog: document.querySelector("#cdn-log"), edgeLog: document.querySelector("#edge-log"), gateway1Log: document.querySelector("#gateway-1-log"), gateway2Log: document.querySelector("#gateway-2-log"), catalogLog: document.querySelector("#catalog-log"),
  meta: document.querySelector("#response-meta"), time: document.querySelector("#response-time"), server: document.querySelector("#response-server"), pretty: document.querySelector("#pretty"), json: document.querySelector("#json"), headers: document.querySelector("#headers"), toasts: document.querySelector("#toasts")
};
let state;
let selected = "catalog";

async function api(path = "", options = {}) { const response = await fetch(`${apiRoot}${path}`, options); const body = response.status === 204 ? null : await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`); return body; }
function toast(message, error = false) { const item = document.createElement("div"); item.className = `toast${error ? " error" : ""}`; item.textContent = message; el.toasts.append(item); window.setTimeout(() => item.remove(), 3200); }
function route() { return state.routes.find(({ key }) => key === selected) ?? state.routes[0]; }
function routeUrl() { return `${state.cdn?.baseUrl ?? "http://127.0.0.1:7712"}${route().path}`; }
function signal(selector, delay) { window.setTimeout(() => document.querySelector(selector)?.signalActivity(), delay); }

function renderRoutes() {
  el.routes.innerHTML = state.routes.map((item) => `<button class="${item.key === selected ? "selected" : ""}" data-route="${item.key}"><b>${item.name}</b><code>${item.path}</code></button>`).join("");
  el.url.textContent = routeUrl();
  el.decision.textContent = selected === "catalog" ? "CDN → HIT or origin on MISS" : `CDN BYPASS → origin → ${route().name}`;
}

function updateServiceCards() {
  const user = state.services.find(({ serviceKey }) => serviceKey === "user"), order = state.services.find(({ serviceKey }) => serviceKey === "order"), catalogs = state.services.filter(({ serviceKey }) => serviceKey === "catalog");
  for (const [key, service] of [["user", user], ["order", order], ["catalog-1", catalogs[0]], ["catalog-2", catalogs[1]]]) document.querySelector(`[data-key="${key}"]`).dataset.instanceName = service?.name ?? "";
}

function render(next) { state = next; el.start.hidden = state.ready; el.stop.disabled = !state.running; el.clear.disabled = !state.running; el.clearCache.disabled = !state.running; el.send.disabled = !state.ready; renderRoutes(); updateServiceCards(); }
function resetResponse() { el.meta.textContent = "waiting"; el.time.textContent = "— ms"; el.server.textContent = "waiting for response"; el.cacheResult.textContent = "WAITING"; el.cacheResult.className = ""; el.pretty.textContent = "Start the lesson, then request Products twice."; el.json.textContent = "No JSON response yet."; el.headers.textContent = "No response headers yet."; }

async function refreshLogs() {
  if (!state?.running) return;
  try {
    const logs = await api("/logs");
    el.cdnLog.textContent = logs.cdnLogs; el.edgeLog.textContent = logs.edgeLogs;
    el.gateway1Log.textContent = logs.gatewayLogs.find(({ name }) => name === "advancedApiGateway1")?.logs ?? "No requests yet.";
    el.gateway2Log.textContent = logs.gatewayLogs.find(({ name }) => name === "advancedApiGateway2")?.logs ?? "No requests yet.";
    el.catalogLog.textContent = logs.catalogLogs;
    for (const log of [el.cdnLog, el.edgeLog, el.gateway1Log, el.gateway2Log, el.catalogLog]) log.scrollTop = log.scrollHeight;
  } catch { /* lifecycle transition */ }
}

el.routes.addEventListener("click", (event) => { const button = event.target.closest("[data-route]"); if (button) { selected = button.dataset.route; renderRoutes(); } });
el.start.addEventListener("click", async () => { el.start.disabled = true; try { render(await api("/start", { method:"POST" })); resetResponse(); await refreshLogs(); toast("Local CDN ready. Request Products twice."); } catch (error) { toast(error.message, true); } finally { el.start.disabled = false; } });
el.stop.addEventListener("click", async () => { el.stop.disabled = true; try { await api("/stop", { method:"DELETE" }); render(await api("/state")); resetResponse(); toast("Lesson 7 stopped."); } catch (error) { toast(error.message, true); } });
el.clear.addEventListener("click", async () => { try { await api("/logs", { method:"DELETE" }); await refreshLogs(); toast("Logs cleared."); } catch (error) { toast(error.message, true); } });
el.clearCache.addEventListener("click", async () => { try { await api("/cache", { method:"DELETE" }); el.cacheResult.textContent = "CLEARED"; el.cacheResult.className = "miss"; toast("CDN cache cleared. Next Product request will miss."); } catch (error) { toast(error.message, true); } });
el.send.addEventListener("click", async () => {
  el.send.disabled = true; const chosen = route(); const started = performance.now(); document.querySelector("lesson-client-card").signalActivity(); signal("#cdn-node", 70);
  try {
    const response = await fetch(routeUrl(), { cache:"no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const cacheStatus = response.headers.get("x-cache-status") ?? "BYPASS";
    const gateway = response.headers.get("x-api-gateway"), server = payload.servedBy?.server ?? response.headers.get("x-request-server");
    el.cacheResult.textContent = cacheStatus; el.cacheResult.className = cacheStatus.toLowerCase();
    if (cacheStatus !== "HIT") {
      signal("#edge-node", 140); if (gateway) signal(`[data-gateway="${CSS.escape(gateway)}"]`, 220);
      if (chosen.via === "load-balancer") signal("#catalog-lb-node", 300);
      if (server) signal(`[data-instance-name="${CSS.escape(server)}"]`, chosen.via === "load-balancer" ? 390 : 300);
    }
    el.meta.textContent = `200 OK · ${cacheStatus}`; el.time.textContent = `${(performance.now() - started).toFixed(1)} ms`;
    el.server.textContent = cacheStatus === "HIT" ? "Local CDN cache" : `${gateway} → ${server}`;
    el.pretty.textContent = JSON.stringify(payload.data, null, 2); el.json.textContent = JSON.stringify(payload, null, 2); el.headers.textContent = formatResponseHeaders(response);
    el.decision.textContent = cacheStatus === "HIT" ? "CDN HIT → response · origin skipped" : chosen.via === "load-balancer" ? `CDN ${cacheStatus} → ${gateway} → Catalog LB → ${server}` : `CDN ${cacheStatus} → ${gateway} → ${server}`;
    await new Promise((resolve) => window.setTimeout(resolve, 460)); await refreshLogs();
  } catch (error) { el.meta.textContent = "request failed"; toast(error.message, true); }
  finally { el.send.disabled = !state.ready; }
});

try { render(await api("/state")); await refreshLogs(); } catch (error) { toast(error.message, true); }
window.setInterval(refreshLogs, 2400);
