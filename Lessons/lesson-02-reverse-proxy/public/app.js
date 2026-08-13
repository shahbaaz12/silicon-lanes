import { formatResponseHeaders } from "/lessons/shared/components.js";

const apiRoot = "/api/lessons/lesson-02-reverse-proxy";
const startButton = document.querySelector("#start-lesson");
const stopButton = document.querySelector("#stop-lesson");
const clearCacheButton = document.querySelector("#clear-cache");
const clearLogsButton = document.querySelector("#clear-logs");
const detailsButton = document.querySelector("#proxy-details-button");
const detailsPanel = document.querySelector("#proxy-details");
const requestButton = document.querySelector("#get-products");
const copyCurlButton = document.querySelector("#copy-curl");
const proxyStatus = document.querySelector("#proxy-status");
const serviceStatus = document.querySelector("#service-status");
const proxyLogs = document.querySelector("#proxy-logs");
const serviceLogs = document.querySelector("#service-logs");
const products = document.querySelector("#products");
const responseMeta = document.querySelector("#response-meta");
const responseTime = document.querySelector("#response-time");
const responseServer = document.querySelector("#response-server");
const responseJson = document.querySelector("#response-json");
const responseHeaders = document.querySelector("#response-headers");
const cacheStatus = document.querySelector("#cache-status");
const cacheMessage = document.querySelector("#cache-message");
const ttlLabel = document.querySelector("#ttl-label");
const ttlBar = document.querySelector("#ttl-bar");
let state;
let cacheExpiresAt;
let logsRefreshing = false;

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "content-type": "application/json", ...options.headers } });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body;
}

function toast(message, isError = false) {
  const item = document.createElement("div");
  item.className = `toast${isError ? " error" : ""}`;
  item.textContent = message;
  document.querySelector("#toast-region").append(item);
  setTimeout(() => item.remove(), 3500);
}

function renderState(nextState) {
  state = nextState;
  const running = state.running;
  for (const element of [proxyStatus, serviceStatus]) {
    element.textContent = running ? "running" : "stopped";
    element.className = `lesson-node-status ${running ? "running" : "stopped"}`;
  }
  document.querySelector("#proxy-name").textContent = state.proxy?.name ?? "Reverse Proxy";
  document.querySelector("#service-name").textContent = state.service?.name ?? "Catalog Service";
  document.querySelector("#proxy-url").textContent = state.proxy?.directUrl ?? "http://127.0.0.1:7212/api/products";
  document.querySelector("#service-route").textContent = state.service ? `${state.service.name}:${state.service.containerPort}` : "catalogService1:6212";
  const proxyName = state.proxy?.name ?? "reverseProxy1";
  const proxyHostPort = state.proxy?.hostPort ?? 7212;
  const proxyContainerPort = state.proxy?.containerPort ?? 80;
  const serviceName = state.service?.name ?? "catalogService1";
  const servicePort = state.service?.containerPort ?? 6212;
  document.querySelector("#proxy-published-route").textContent = `127.0.0.1:${proxyHostPort} \u2192 ${proxyName}:${proxyContainerPort}`;
  document.querySelector("#proxy-upstream-route").textContent = `${serviceName}:${servicePort}`;
  document.querySelector("#detail-published-address").textContent = `127.0.0.1:${proxyHostPort}`;
  document.querySelector("#detail-listen-port").textContent = `${proxyName}:${proxyContainerPort}`;
  document.querySelector("#detail-upstream-address").textContent = `${serviceName}:${servicePort}`;
  document.querySelector("#proxy-config-snippet").textContent = `listen ${proxyContainerPort};\nproxy_pass http://${serviceName}:${servicePort};\nproxy_cache_valid 200 15s;`;
  startButton.disabled = running;
  startButton.textContent = running ? "Lesson 2 running" : "Start Lesson 2";
  for (const button of [stopButton, clearCacheButton, clearLogsButton, requestButton]) button.disabled = !running;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function renderProducts(items) {
  products.innerHTML = items.length ? items.map((product) => `
    <article><div><b>${escapeHtml(product.name)}</b><span>${escapeHtml(product.description)}</span></div><strong>${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(product.price_cents / 100)}</strong></article>
  `).join("") : "<p>The proxy returned an empty product list.</p>";
}

function showCache(result) {
  const normalized = result || "UNKNOWN";
  cacheStatus.textContent = normalized;
  document.querySelector("#cache-box").dataset.status = normalized;
  if (normalized === "MISS" || normalized === "EXPIRED") {
    cacheExpiresAt = Date.now() + state.cacheTtlSeconds * 1000;
    cacheMessage.textContent = normalized === "MISS" ? "Response stored by Nginx" : "Expired entry refreshed upstream";
  } else if (normalized === "HIT") {
    cacheMessage.textContent = "Served without Catalog Service";
  } else {
    cacheMessage.textContent = "Cache result unavailable";
  }
  updateTtl();
}

function resetCacheDisplay(message = "No response stored") {
  cacheExpiresAt = undefined;
  cacheStatus.textContent = "EMPTY";
  cacheMessage.textContent = message;
  ttlLabel.textContent = `TTL ${state?.cacheTtlSeconds ?? 15}s`;
  ttlBar.style.width = "0%";
  document.querySelector("#cache-box").dataset.status = "EMPTY";
}

function updateTtl() {
  if (!cacheExpiresAt) return;
  const remainingMs = Math.max(0, cacheExpiresAt - Date.now());
  const totalMs = state.cacheTtlSeconds * 1000;
  ttlBar.style.width = `${(remainingMs / totalMs) * 100}%`;
  ttlLabel.textContent = remainingMs ? `expires in ${(remainingMs / 1000).toFixed(1)}s` : "expired · next request refreshes upstream";
  if (!remainingMs) {
    cacheStatus.textContent = "EXPIRED";
    cacheMessage.textContent = "Stored response is no longer fresh";
    document.querySelector("#cache-box").dataset.status = "EXPIRED";
    cacheExpiresAt = undefined;
  }
}

async function refreshLogs() {
  if (!state?.running || logsRefreshing) return;
  logsRefreshing = true;
  try {
    const result = await api(`${apiRoot}/logs`);
    proxyLogs.textContent = result.proxyLogs;
    serviceLogs.textContent = result.serviceLogs;
    proxyLogs.scrollTop = proxyLogs.scrollHeight;
    serviceLogs.scrollTop = serviceLogs.scrollHeight;
  } catch {
    // A lifecycle transition can briefly make a container unavailable.
  } finally {
    logsRefreshing = false;
  }
}

function animateRequest(cacheResult) {
  document.querySelectorAll(".connector").forEach((connector) => connector.classList.remove("flowing"));
  void document.querySelector(".connector").offsetWidth;
  document.querySelector(".connector").classList.add("flowing");
  if (cacheResult !== "HIT") {
    document.querySelector(".connector.upstream").classList.add("flowing");
  }
}

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  startButton.textContent = "Starting Catalog + Nginx...";
  try {
    renderState(await api(`${apiRoot}/start`, { method: "POST" }));
    resetCacheDisplay();
    responseTime.textContent = "— ms";
    responseServer.textContent = "waiting for response";
    responseJson.textContent = "Send a request to inspect the JSON response.";
    responseHeaders.textContent = "Send a request to inspect the response headers.";
    products.innerHTML = "<p>Ready. The client will call the Reverse Proxy address.</p>";
    await refreshLogs();
    toast("Reverse Proxy and Catalog Service are ready.");
  } catch (error) {
    toast(error.message, true);
    renderState(await api(`${apiRoot}/state`));
  }
});

stopButton.addEventListener("click", async () => {
  stopButton.disabled = true;
  try {
    await api(`${apiRoot}/stop`, { method: "DELETE" });
    renderState(await api(`${apiRoot}/state`));
    resetCacheDisplay();
    proxyLogs.textContent = "Start the lesson to see Reverse Proxy requests.";
    serviceLogs.textContent = "Start the lesson to see Catalog Service requests.";
    products.innerHTML = "<p>Start the lesson, then send a request through the proxy.</p>";
    responseMeta.textContent = "waiting";
    responseTime.textContent = "— ms";
    responseServer.textContent = "waiting for response";
    responseJson.textContent = "Send a request to inspect the JSON response.";
    responseHeaders.textContent = "Send a request to inspect the response headers.";
    toast("Lesson 2 stopped.");
  } catch (error) {
    toast(error.message, true);
  }
});

requestButton.addEventListener("click", async () => {
  requestButton.disabled = true;
  responseMeta.textContent = "request in flight";
  responseTime.textContent = "measuring";
  const startedAt = performance.now();
  try {
    const response = await fetch(state.proxy.directUrl);
    if (!response.ok) throw new Error(`Reverse Proxy returned HTTP ${response.status}.`);
    responseHeaders.textContent = formatResponseHeaders(response);
    const cacheResult = response.headers.get("x-cache-status") ?? "UNKNOWN";
    const payload = await response.json();
    responseJson.textContent = JSON.stringify(payload, null, 2);
    const answeredBy = payload.servedBy?.server ?? response.headers.get("x-request-server") ?? "unknown server";
    responseServer.textContent = answeredBy;
    renderProducts(payload.data ?? []);
    responseTime.textContent = `${(performance.now() - startedAt).toFixed(1)} ms`;
    showCache(cacheResult);
    animateRequest(cacheResult);
    responseMeta.textContent = `200 OK · cache ${cacheResult}`;
    document.querySelector("#upstream-label").textContent = cacheResult === "HIT" ? "cache HIT · service bypassed" : `cache ${cacheResult} · forwarded upstream`;
    await new Promise((resolve) => setTimeout(resolve, 350));
    await refreshLogs();
  } catch (error) {
    responseMeta.textContent = "request failed";
    responseTime.textContent = `${(performance.now() - startedAt).toFixed(1)} ms`;
    responseServer.textContent = "request failed";
    responseJson.textContent = "No JSON response was received.";
    responseHeaders.textContent = "No response headers were received.";
    toast(error.message, true);
  } finally {
    requestButton.disabled = !state.running;
  }
});

copyCurlButton.addEventListener("click", async () => {
  const url = state?.proxy?.directUrl ?? "http://127.0.0.1:7212/api/products";
  try {
    await navigator.clipboard.writeText(`curl --request GET "${url}"`);
    copyCurlButton.textContent = "Copied";
    toast("cURL copied. Paste it into a terminal or import it into Postman.");
    setTimeout(() => { copyCurlButton.textContent = "Copy cURL"; }, 1600);
  } catch {
    toast("Could not copy the cURL command.", true);
  }
});

clearCacheButton.addEventListener("click", async () => {
  clearCacheButton.disabled = true;
  clearCacheButton.textContent = "Clearing...";
  try {
    renderState(await api(`${apiRoot}/cache`, { method: "DELETE" }));
    resetCacheDisplay("Proxy cache cleared");
    proxyLogs.textContent = "No proxy requests received yet.";
    toast("Nginx response cache cleared.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    clearCacheButton.textContent = "Clear cache";
    clearCacheButton.disabled = !state.running;
  }
});

clearLogsButton.addEventListener("click", async () => {
  clearLogsButton.disabled = true;
  try {
    await api(`${apiRoot}/logs`, { method: "DELETE" });
    proxyLogs.textContent = "No proxy requests received yet.";
    serviceLogs.textContent = "No requests received yet.";
  } catch (error) {
    toast(error.message, true);
  } finally {
    clearLogsButton.disabled = !state.running;
  }
});

detailsButton.addEventListener("click", () => {
  const expanded = detailsButton.getAttribute("aria-expanded") === "true";
  detailsButton.setAttribute("aria-expanded", String(!expanded));
  detailsButton.textContent = expanded ? "Details" : "Hide details";
  detailsPanel.hidden = expanded;
});

try {
  renderState(await api(`${apiRoot}/state`));
  if (state.running) products.innerHTML = "<p>Ready. The client will call the Reverse Proxy address.</p>";
  await refreshLogs();
} catch (error) {
  toast(error.message, true);
}

setInterval(refreshLogs, 1800);
setInterval(updateTtl, 100);
