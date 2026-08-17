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
const cacheBox = document.querySelector("#cache-box");
const cacheStatus = document.querySelector("#cache-status");
const cacheMessage = document.querySelector("#cache-message");
const ttlLabel = document.querySelector("#ttl-label");
const ttlBar = document.querySelector("#ttl-bar");
const requestTrace = document.querySelector("#request-trace");
const lastResult = document.querySelector("#last-result");
const lastResultValue = document.querySelector("#last-result-value");
const lastResultMessage = document.querySelector("#last-result-message");
const clientCard = document.querySelector("lesson-client-card");
const proxyCard = document.querySelector("lesson-proxy-card");
const serviceCard = document.querySelector("lesson-service-card");
const clientConnector = document.querySelector(".connector-client");
const upstreamConnector = document.querySelector(".connector-upstream");

let state;
let cacheExpiresAt;
let logsRefreshing = false;
let clientRequests = 0;
let proxyRequests = 0;
let catalogRequests = 0;
let avoidedRequests = 0;

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers }
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body;
}

function proxyRequestUrl() {
  return state?.proxy?.directUrl?.replace("127.0.0.1", "localhost") ?? "http://localhost:7212/api/products";
}

function toast(message, isError = false) {
  const item = document.createElement("div");
  item.className = `toast${isError ? " error" : ""}`;
  item.textContent = message;
  document.querySelector("#toasts").append(item);
  setTimeout(() => item.remove(), 3500);
}

function renderState(nextState) {
  state = nextState;
  const running = state.running;

  for (const element of [proxyStatus, serviceStatus]) {
    element.textContent = running ? "running" : "stopped";
    element.className = `lesson-node-status ${running ? "running" : "stopped"}`;
  }

  const proxyName = state.proxy?.name ?? "reverseProxy1";
  const proxyHostPort = state.proxy?.hostPort ?? 7212;
  const proxyContainerPort = state.proxy?.containerPort ?? 80;
  const serviceName = state.service?.name ?? "catalogService1";
  const serviceHostPort = state.service?.hostPort ?? 6212;
  const serviceContainerPort = state.service?.containerPort ?? 6212;

  document.querySelector("#proxy-name").textContent = state.proxy?.name ?? "Reverse Proxy";
  document.querySelector("#service-name").textContent = state.service?.name ?? "Catalog Service";
  document.querySelector("#proxy-url").textContent = proxyRequestUrl();
  document.querySelector("#service-route").textContent = `:${serviceHostPort}`;
  document.querySelector("#proxy-published-route").textContent = `localhost:${proxyHostPort}`;
  document.querySelector("#proxy-upstream-route").textContent = `${serviceName}:${serviceContainerPort}`;
  document.querySelector("#detail-published-address").textContent = `localhost:${proxyHostPort}`;
  document.querySelector("#detail-listen-port").textContent = `${proxyName}:${proxyContainerPort}`;
  document.querySelector("#detail-upstream-address").textContent = `${serviceName}:${serviceContainerPort}`;
  document.querySelector("#proxy-config-snippet").textContent = `listen ${proxyContainerPort};\nproxy_pass http://${serviceName}:${serviceContainerPort};\nproxy_cache_valid 200 15s;`;

  startButton.disabled = running;
  startButton.textContent = running ? "Lesson running" : "Start Lesson";
  for (const button of [stopButton, clearCacheButton, clearLogsButton, requestButton]) {
    button.disabled = !running;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function renderProducts(items) {
  if (!items.length) {
    products.innerHTML = "<p>The Reverse Proxy returned an empty product list.</p>";
    return;
  }
  products.innerHTML = items.map((product) => `
    <article>
      <div><b>${escapeHtml(product.name)}</b><span>${escapeHtml(product.description)}</span></div>
      <strong>${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(product.price_cents / 100)}</strong>
    </article>
  `).join("");
}

function renderCounters() {
  document.querySelector("#client-request-count").textContent = clientRequests;
  document.querySelector("#proxy-request-count").textContent = proxyRequests;
  document.querySelector("#catalog-request-count").textContent = catalogRequests;
  document.querySelector("#avoided-request-count").textContent = avoidedRequests;
}

function setRequestButton(label) {
  requestButton.innerHTML = `<span>GET</span> ${label}`;
}

function resetExperiment(message = "Execute the first request to begin.") {
  clientRequests = 0;
  proxyRequests = 0;
  catalogRequests = 0;
  avoidedRequests = 0;
  renderCounters();
  lastResult.dataset.result = "waiting";
  lastResultValue.textContent = "WAITING";
  lastResultMessage.textContent = message;
  requestTrace.innerHTML = `
    <li class="pending"><span>1</span><div><strong>Execute a request</strong><small>The trace will show whether Nginx forwards it or answers from cache.</small></div></li>
  `;
  document.querySelector("#upstream-label").textContent = "Only on cache miss";
}

function traceSteps(cacheResult, serviceName) {
  if (cacheResult === "HIT") {
    return [
      ["Client opened a connection", "Directly to the Reverse Proxy at localhost:7212"],
      ["Nginx received GET /api/products", "The Catalog Service address remained hidden"],
      ["Nginx checked its response cache", "The request key matched a stored response"],
      ["Cache result was HIT", "The stored response was still inside its 15-second TTL"],
      ["Nginx returned the cached response", "The response stopped at the Reverse Proxy"],
      ["Catalog Service was not contacted", "No database query or application work was needed"]
    ];
  }

  const cacheDescription = cacheResult === "EXPIRED"
    ? "The stored response was stale and had to be refreshed"
    : "No fresh response existed for this request";
  return [
    ["Client opened a connection", "Directly to the Reverse Proxy at localhost:7212"],
    ["Nginx received GET /api/products", "The Catalog Service address remained hidden"],
    ["Nginx checked its response cache", "Only this products endpoint is cache-enabled in the lesson"],
    [`Cache result was ${cacheResult}`, cacheDescription],
    [`Nginx forwarded to ${serviceName}`, "The request continued through the hidden internal address"],
    ["Catalog Service queried PostgreSQL", "The application performed its business and data-access work"],
    ["Nginx cached the response for 15 seconds", "A repeat request can now avoid the backend"],
    ["Response returned to the client", "The client still saw only the Reverse Proxy address"]
  ];
}

function renderTrace(cacheResult, serviceName) {
  requestTrace.innerHTML = traceSteps(cacheResult, serviceName).map(([title, detail], index) => `
    <li style="--trace-delay: ${index * 65}ms">
      <span>${index + 1}</span>
      <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>
    </li>
  `).join("");
}

function showCache(cacheResult) {
  const normalized = cacheResult || "UNKNOWN";
  cacheStatus.textContent = normalized;
  cacheBox.dataset.status = normalized;

  if (normalized === "MISS" || normalized === "EXPIRED") {
    cacheExpiresAt = Date.now() + state.cacheTtlSeconds * 1000;
    cacheMessage.textContent = normalized === "MISS"
      ? "Response stored by Nginx"
      : "Expired response refreshed upstream";
  } else if (normalized === "HIT") {
    cacheMessage.textContent = "Served without Catalog Service";
  } else {
    cacheMessage.textContent = "Cache result unavailable";
  }
  updateTtl();
}

function showResult(cacheResult) {
  const hit = cacheResult === "HIT";
  lastResult.dataset.result = cacheResult;
  lastResultValue.textContent = cacheResult;
  lastResultMessage.textContent = hit
    ? "Nginx answered from cache. The Catalog Service log did not change."
    : `Nginx forwarded this ${cacheResult.toLowerCase()} request to the Catalog Service.`;
}

function resetCacheDisplay(message = "No response stored") {
  cacheExpiresAt = undefined;
  cacheStatus.textContent = "EMPTY";
  cacheMessage.textContent = message;
  ttlLabel.textContent = `TTL ${state?.cacheTtlSeconds ?? 15}s`;
  ttlBar.style.width = "0%";
  cacheBox.dataset.status = "EMPTY";
}

function updateTtl() {
  if (!cacheExpiresAt) return;
  const remainingMs = Math.max(0, cacheExpiresAt - Date.now());
  const totalMs = state.cacheTtlSeconds * 1000;
  ttlBar.style.width = `${(remainingMs / totalMs) * 100}%`;
  ttlLabel.textContent = remainingMs
    ? `expires in ${(remainingMs / 1000).toFixed(1)}s`
    : "expired · next request refreshes upstream";

  if (!remainingMs) {
    cacheStatus.textContent = "EXPIRED";
    cacheMessage.textContent = "Stored response is no longer fresh";
    cacheBox.dataset.status = "EXPIRED";
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

function restartAnimation(element) {
  element.classList.remove("flowing");
  void element.offsetWidth;
  element.classList.add("flowing");
}

function resetResponse() {
  responseMeta.textContent = "waiting";
  responseTime.textContent = "— ms";
  responseServer.textContent = "waiting for response";
  responseJson.textContent = "Execute a request to inspect the original response.";
  responseHeaders.textContent = "Execute a request to inspect the response headers.";
}

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  startButton.textContent = "Starting Catalog + Nginx...";
  try {
    renderState(await api(`${apiRoot}/start`, { method: "POST" }));
    resetCacheDisplay();
    resetExperiment();
    resetResponse();
    setRequestButton("Execute request");
    products.innerHTML = "<p>Ready. The client will call only the Reverse Proxy address.</p>";
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
    resetExperiment();
    resetResponse();
    proxyLogs.textContent = "Start the lesson to see Reverse Proxy requests.";
    serviceLogs.textContent = "Start the lesson to see Catalog Service requests.";
    products.innerHTML = "<p>Start the lesson, then execute a request through the proxy.</p>";
    toast("Lesson 2 stopped.");
  } catch (error) {
    toast(error.message, true);
  }
});

requestButton.addEventListener("click", async () => {
  requestButton.disabled = true;
  requestButton.classList.add("sending");
  responseMeta.textContent = "request in flight";
  responseTime.textContent = "measuring";
  const startedAt = performance.now();

  clientCard.signalActivity();
  restartAnimation(clientConnector);
  window.setTimeout(() => proxyCard.signalActivity(), 120);

  try {
    const response = await fetch(proxyRequestUrl());
    const elapsed = performance.now() - startedAt;
    if (!response.ok) throw new Error(`Reverse Proxy returned HTTP ${response.status}.`);

    responseHeaders.textContent = formatResponseHeaders(response);
    const cacheResult = response.headers.get("x-cache-status") ?? "UNKNOWN";
    const payload = await response.json();
    responseJson.textContent = JSON.stringify(payload, null, 2);

    const serviceName = payload.servedBy?.server ?? response.headers.get("x-request-server") ?? state.service?.name ?? "Catalog Service";
    const servedFrom = cacheResult === "HIT" ? `${state.proxy?.name ?? "reverseProxy1"} cache` : serviceName;
    const reachedCatalog = cacheResult !== "HIT";

    clientRequests += 1;
    proxyRequests += 1;
    if (reachedCatalog) catalogRequests += 1;
    else avoidedRequests += 1;
    renderCounters();

    if (reachedCatalog) {
      restartAnimation(upstreamConnector);
      serviceCard.signalActivity();
    }

    responseServer.textContent = servedFrom;
    renderProducts(payload.data ?? []);
    responseTime.textContent = `${elapsed.toFixed(1)} ms`;
    responseMeta.textContent = `200 OK · cache ${cacheResult}`;
    showCache(cacheResult);
    showResult(cacheResult);
    renderTrace(cacheResult, serviceName);
    document.querySelector("#upstream-label").textContent = reachedCatalog
      ? `Cache ${cacheResult} · forwarded upstream`
      : "Cache HIT · service bypassed";
    setRequestButton("Repeat request");

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
    requestButton.classList.remove("sending");
  }
});

copyCurlButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`curl --request GET "${proxyRequestUrl()}"`);
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
    lastResult.dataset.result = "waiting";
    lastResultValue.textContent = "CACHE CLEARED";
    lastResultMessage.textContent = "The next request must reach the Catalog Service again.";
    document.querySelector("#upstream-label").textContent = "Next request will be a MISS";
    proxyLogs.textContent = "No proxy requests received yet.";
    setRequestButton("Execute after clear");
    toast("Nginx response cache cleared.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    clearCacheButton.textContent = "Clear Cache";
    clearCacheButton.disabled = !state.running;
  }
});

clearLogsButton.addEventListener("click", async () => {
  clearLogsButton.disabled = true;
  try {
    await api(`${apiRoot}/logs`, { method: "DELETE" });
    proxyLogs.textContent = "No proxy requests received yet.";
    serviceLogs.textContent = "No requests received yet.";
    resetExperiment("Logs and experiment counters were cleared.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    clearLogsButton.disabled = !state.running;
  }
});

detailsButton.addEventListener("click", () => {
  const expanded = detailsButton.getAttribute("aria-expanded") === "true";
  detailsButton.setAttribute("aria-expanded", String(!expanded));
  detailsButton.textContent = expanded ? "Configuration" : "Hide configuration";
  detailsPanel.hidden = expanded;
});

try {
  renderState(await api(`${apiRoot}/state`));
  resetExperiment(state.running ? "Execute a request to inspect the current cache path." : undefined);
  if (state.running) products.innerHTML = "<p>Ready. The client will call only the Reverse Proxy address.</p>";
  await refreshLogs();
} catch (error) {
  toast(error.message, true);
}

setInterval(refreshLogs, 1800);
setInterval(updateTtl, 100);
