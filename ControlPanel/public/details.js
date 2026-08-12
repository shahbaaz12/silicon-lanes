const serviceKey = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1));
const grid = document.querySelector("#instances-grid");
const errorNotice = document.querySelector("#error-notice");
const startButton = document.querySelector("#start-button");
const refreshButton = document.querySelector("#refresh-button");
const countInput = document.querySelector("#instance-count");
const outputs = new Map();
let currentService;
let logRefreshInProgress = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  document.querySelector("#toast-region").append(toast);
  setTimeout(() => toast.remove(), 3600);
}

async function api(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...options?.headers }
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body;
}

function updateCardOutput(id, output) {
  const card = grid.querySelector(`[data-instance="${CSS.escape(id)}"]`);
  if (!card) return;
  const responseBlock = card.querySelector("[data-response]");
  const logsBlock = card.querySelector("[data-logs]");
  if (output.body) responseBlock.textContent = JSON.stringify(output.body, null, 2);
  if (output.logs !== undefined) {
    logsBlock.textContent = output.logs;
    logsBlock.scrollTop = logsBlock.scrollHeight;
  }
}

function renderInstances(instances) {
  document.querySelector("#instance-summary").textContent = `${instances.length} ${instances.length === 1 ? "container is" : "containers are"} answering this lane.`;
  if (!instances.length) {
    grid.innerHTML = '<div class="empty-state"><strong>No instances are running.</strong>Start one above, then send a request through its lane.</div>';
    return;
  }

  grid.innerHTML = instances.map((instance) => {
    const output = outputs.get(instance.id);
    const curl = `curl http://localhost:${instance.hostPort}/health`;
    return `
      <article class="instance-card" data-instance="${escapeHtml(instance.id)}">
        <div class="instance-card-header">
          <div>
            <div class="instance-state"><span class="status-dot"></span>running</div>
            <h3>${escapeHtml(instance.name)}</h3>
          </div>
          <span class="port-route">:${instance.hostPort} -&gt; :${instance.containerPort}</span>
        </div>
        <div class="code-label">Sample GET</div>
        <pre class="code-block curl-block">${escapeHtml(curl)}</pre>
        <div class="instance-actions">
          <button class="button" type="button" data-copy data-curl="${escapeHtml(curl)}">Copy curl</button>
          <button class="button danger" type="button" data-stop>Stop</button>
        </div>
        <div class="request-output">
          <div class="code-label">Latest response</div>
          <pre class="code-block response-block" data-response>${escapeHtml(output?.body ? JSON.stringify(output.body, null, 2) : "Loading response...")}</pre>
          <div class="code-label">Request log · time / method / URL</div>
          <pre class="code-block logs-block" data-logs>${escapeHtml(output?.logs ?? "Waiting for requests...")}</pre>
        </div>
      </article>
    `;
  }).join("");
}

async function hydrateInstance(instance) {
  try {
    const output = await api(`/api/instances/${instance.id}/request`, { method: "POST" });
    outputs.set(instance.id, output);
    updateCardOutput(instance.id, output);
  } catch (error) {
    updateCardOutput(instance.id, { logs: error.message });
  }
}

async function refreshLogs() {
  if (logRefreshInProgress || !currentService) return;
  logRefreshInProgress = true;
  try {
    await Promise.all(currentService.instances.map(async (instance) => {
      try {
        const result = await api(`/api/instances/${instance.id}/logs`);
        const output = { ...(outputs.get(instance.id) ?? {}), logs: result.logs };
        outputs.set(instance.id, output);
        updateCardOutput(instance.id, output);
      } catch {
        // A container may have stopped between list and log refresh.
      }
    }));
  } finally {
    logRefreshInProgress = false;
  }
}

async function loadService() {
  refreshButton.disabled = true;
  try {
    const services = await api("/api/services");
    currentService = services.find((service) => service.key === serviceKey);
    if (!currentService) throw new Error("Service not found.");
    document.title = `${currentService.name} - Silicon Lanes`;
    document.querySelector("#breadcrumb-service").textContent = currentService.name;
    document.querySelector("#service-name").textContent = currentService.name;
    document.querySelector("#service-description").textContent = currentService.description;
    document.querySelector("#service-port").textContent = `Lane ${currentService.basePort}+`;
    renderInstances(currentService.instances);
    errorNotice.hidden = true;

    const instancesWithoutResponses = currentService.instances.filter((instance) => !outputs.has(instance.id));
    await Promise.all(instancesWithoutResponses.map(hydrateInstance));
    await refreshLogs();
  } catch (error) {
    errorNotice.textContent = error.message;
    errorNotice.hidden = false;
    grid.innerHTML = "";
  } finally {
    refreshButton.disabled = false;
  }
}

async function startInstances() {
  startButton.disabled = true;
  startButton.textContent = "Starting...";
  try {
    const count = Math.max(1, Math.min(10, Number(countInput.value)));
    await api(`/api/services/${serviceKey}/instances`, {
      method: "POST",
      body: JSON.stringify({ count })
    });
    showToast(`${count} ${count === 1 ? "instance" : "instances"} started.`);
    await loadService();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    startButton.disabled = false;
    startButton.textContent = "Start more";
  }
}

grid.addEventListener("click", async (event) => {
  const card = event.target.closest(".instance-card");
  if (!card) return;
  const id = card.dataset.instance;

  if (event.target.closest("[data-copy]")) {
    await navigator.clipboard.writeText(event.target.closest("[data-copy]").dataset.curl);
    showToast("curl command copied.");
    return;
  }

  if (event.target.closest("[data-stop]")) {
    const button = event.target.closest("[data-stop]");
    button.disabled = true;
    button.textContent = "Stopping...";
    try {
      await api(`/api/instances/${id}`, { method: "DELETE" });
      outputs.delete(id);
      showToast("Instance stopped and removed.");
      await loadService();
    } catch (error) {
      showToast(error.message, true);
      button.disabled = false;
      button.textContent = "Stop";
    }
  }
});

document.querySelector("#decrease-count").addEventListener("click", () => {
  countInput.value = Math.max(1, Number(countInput.value) - 1);
});
document.querySelector("#increase-count").addEventListener("click", () => {
  countInput.value = Math.min(10, Number(countInput.value) + 1);
});
startButton.addEventListener("click", startInstances);
refreshButton.addEventListener("click", loadService);
setInterval(refreshLogs, 2000);
loadService();

