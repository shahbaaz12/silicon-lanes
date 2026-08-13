import { formatResponseHeaders } from "/lessons/shared/components.js";

const startButton = document.querySelector("#start-service");
const stopButton = document.querySelector("#stop-service");
const requestButton = document.querySelector("#get-products");
const clearButton = document.querySelector("#clear-logs");
const status = document.querySelector("#service-status");
const instanceName = document.querySelector("#instance-name");
const directUrl = document.querySelector("#direct-url");
const formulaAddress = document.querySelector("#formula-address");
const addressLabel = document.querySelector("#address-label");
const portRoute = document.querySelector("#port-route");
const products = document.querySelector("#products");
const responseMeta = document.querySelector("#response-meta");
const responseTime = document.querySelector("#response-time");
const responseServer = document.querySelector("#response-server");
const responseJson = document.querySelector("#response-json");
const responseHeaders = document.querySelector("#response-headers");
const logs = document.querySelector("#logs");
const clientCard = document.querySelector("lesson-client-card");
const serviceCard = document.querySelector("lesson-service-card");
let state;
let logRefreshInProgress = false;
const lessonApi = "/api/lessons/lesson-01-direct-service";

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers }
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body;
}

function toast(message, isError = false) {
  const item = document.createElement("div");
  item.className = `toast${isError ? " error" : ""}`;
  item.textContent = message;
  document.querySelector("#toast-region").append(item);
  setTimeout(() => item.remove(), 3600);
}

function renderState(nextState) {
  state = nextState;
  const running = state.running;
  const instance = state.instance;
  status.textContent = running ? "running" : "stopped";
  status.className = `lesson-node-status ${running ? "running" : "stopped"}`;
  instanceName.textContent = instance?.name ?? "Catalog Service";
  directUrl.textContent = instance?.directUrl ?? "http://127.0.0.1:6212/api/products";
  formulaAddress.textContent = instance ? `127.0.0.1:${instance.hostPort}` : "127.0.0.1:6212";
  addressLabel.textContent = `:${instance?.hostPort ?? 6212}`;
  portRoute.textContent = `:${instance?.hostPort ?? 6212} → :${instance?.containerPort ?? 6212}`;
  startButton.disabled = running;
  startButton.textContent = running ? "Catalog Service running" : "Start Catalog Service";
  stopButton.disabled = !running || !state.ownedByLesson;
  stopButton.title = running && !state.ownedByLesson ? "This instance was started outside the lesson." : "";
  requestButton.disabled = !running;
  clearButton.disabled = !running;
}

function formatMoney(priceCents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(priceCents / 100);
}

function renderProducts(items) {
  if (!items.length) {
    products.innerHTML = '<p class="empty-copy">The Catalog Service returned an empty product list.</p>';
    return;
  }
  products.innerHTML = items.map((product) => `
    <article class="product">
      <div><b>${escapeHtml(product.name)}</b><span>${escapeHtml(product.description)}</span></div>
      <strong>${formatMoney(product.price_cents)}</strong>
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

async function refreshLogs() {
  if (!state?.running || logRefreshInProgress) return;
  logRefreshInProgress = true;
  try {
    const result = await api(`${lessonApi}/catalog/logs`);
    logs.textContent = result.logs;
    logs.scrollTop = logs.scrollHeight;
  } catch {
    // The instance may be transitioning while the next state refresh catches up.
  } finally {
    logRefreshInProgress = false;
  }
}

function animateRequest() {
  document.querySelector(".connection").classList.remove("flowing");
  void document.querySelector(".connection").offsetWidth;
  document.querySelector(".connection").classList.add("flowing");
}

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  startButton.textContent = "Starting Docker service...";
  try {
    renderState(await api(`${lessonApi}/catalog/start`, { method: "POST" }));
    products.innerHTML = '<p class="empty-copy">Service ready. Send the request directly from this client.</p>';
    responseMeta.textContent = "waiting";
    responseTime.textContent = "— ms";
    responseServer.textContent = "waiting for response";
    responseJson.textContent = "Send a request to inspect the JSON response.";
    responseHeaders.textContent = "Send a request to inspect the response headers.";
    await refreshLogs();
    toast(`${state.instance.name} is ready on port ${state.instance.hostPort}.`);
  } catch (error) {
    toast(error.message, true);
    renderState(await api(`${lessonApi}/state`));
  }
});

stopButton.addEventListener("click", async () => {
  stopButton.disabled = true;
  stopButton.textContent = "Stopping...";
  try {
    await api(`${lessonApi}/catalog/stop`, { method: "DELETE" });
    renderState(await api(`${lessonApi}/state`));
    logs.textContent = "Start the service to see its request log.";
    products.innerHTML = '<p class="empty-copy">Start the service, then send the direct request.</p>';
    responseMeta.textContent = "waiting";
    responseTime.textContent = "— ms";
    responseServer.textContent = "waiting for response";
    responseJson.textContent = "Send a request to inspect the JSON response.";
    responseHeaders.textContent = "Send a request to inspect the response headers.";
    toast("Lesson Catalog Service stopped.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    stopButton.textContent = "Stop";
  }
});

requestButton.addEventListener("click", async () => {
  requestButton.disabled = true;
  requestButton.classList.add("sending");
  responseMeta.textContent = "request in flight";
  responseTime.textContent = "measuring";
  const startedAt = performance.now();
  clientCard.signalActivity();
  animateRequest();
  try {
    const response = await fetch(state.instance.directUrl);
    if (!response.ok) throw new Error(`Catalog Service returned HTTP ${response.status}.`);
    responseHeaders.textContent = formatResponseHeaders(response);
    const payload = await response.json();
    responseJson.textContent = JSON.stringify(payload, null, 2);
    const answeredBy = payload.servedBy?.server ?? response.headers.get("x-request-server") ?? state.instance.name;
    serviceCard.signalActivity();
    responseServer.textContent = answeredBy;
    renderProducts(payload.data ?? []);
    responseTime.textContent = `${(performance.now() - startedAt).toFixed(1)} ms`;
    responseMeta.textContent = `200 OK · ${answeredBy}`;
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

clearButton.addEventListener("click", async () => {
  clearButton.disabled = true;
  try {
    await api(`${lessonApi}/catalog/logs`, { method: "DELETE" });
    logs.textContent = "No requests received yet.";
  } catch (error) {
    toast(error.message, true);
  } finally {
    clearButton.disabled = !state.running;
  }
});

try {
  renderState(await api(`${lessonApi}/state`));
  await refreshLogs();
} catch (error) {
  toast(error.message, true);
}

setInterval(refreshLogs, 1800);
