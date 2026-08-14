import { api, clamp, copyText, escapeHtml, showToast } from "./shared/ui.js";

const grid = document.querySelector("#services-grid");
const workbench = document.querySelector("#service-workbench");
const errorNotice = document.querySelector("#error-notice");
const systemStatus = document.querySelector("#system-status");
const refreshButton = document.querySelector("#refresh-button");
const globalKillButton = document.querySelector("#global-kill-button");
const serviceTypeCount = document.querySelector("#service-type-count");
const runningReplicaCount = document.querySelector("#running-replica-count");
const activeServiceCount = document.querySelector("#active-service-count");
const desiredCapacities = new Map();

let services = [];
let selectedServiceKey;
let selectedInstanceId;
let selectedEndpointIndex = 0;
let lastExecution;
let responseView = "pretty";

const accents = {
  violet: "#b69cff",
  cyan: "#69d9ec",
  emerald: "#6fe0a7",
  amber: "#efc766",
  orange: "#f49a66",
  rose: "#f0809c"
};

function glyph(name) {
  return name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
}

function selectedService() {
  return services.find((service) => service.key === selectedServiceKey);
}

function selectedInstance(service = selectedService()) {
  return service?.instances.find((instance) => instance.id === selectedInstanceId);
}

function buildCurl(endpoint, instance, body = endpoint.body) {
  if (!instance) return "Start a replica to generate a curl command.";
  const parts = ["curl"];
  if (endpoint.method !== "GET") parts.push("-X", endpoint.method);
  if (body) {
    parts.push("-H", '"Content-Type: application/json"');
    parts.push("-d", `'${JSON.stringify(body)}'`);
  }
  parts.push(`http://localhost:${instance.hostPort}${endpoint.path}`);
  return parts.join(" ");
}

function renderServices() {
  const totalRunning = services.reduce((total, service) => total + service.instances.length, 0);
  serviceTypeCount.textContent = services.length;
  runningReplicaCount.textContent = totalRunning;
  activeServiceCount.textContent = services.filter((service) => service.instances.length).length;

  grid.innerHTML = services.map((service) => `
    <button
      class="service-mini-card${service.key === selectedServiceKey ? " selected" : ""}${service.instances.length ? " has-running" : ""}"
      style="--accent: ${accents[service.color]}"
      type="button"
      data-service="${escapeHtml(service.key)}"
      aria-pressed="${service.key === selectedServiceKey}"
    >
      <span class="service-glyph">${glyph(service.name)}</span>
      <span class="service-mini-copy">
        <strong>${escapeHtml(service.name)}</strong>
        <small>${escapeHtml(service.description)}</small>
      </span>
      <span class="service-mini-count"><strong>${service.instances.length}</strong><small>running</small></span>
    </button>
  `).join("");
}

function renderResponse() {
  if (!lastExecution) {
    return `
      <div class="execution-empty">
        <strong>Response will appear here.</strong>
        <span>Choose an endpoint and execute it against a running replica.</span>
      </div>
    `;
  }

  const servedFrom = lastExecution.body?.servedBy?.server ?? "Not reported";
  const responseContent = {
    original: lastExecution.rawBody ?? "",
    headers: JSON.stringify(lastExecution.headers ?? {}, null, 2),
    pretty: typeof lastExecution.body === "string"
      ? lastExecution.body
      : JSON.stringify(lastExecution.body, null, 2)
  }[responseView];
  return `
    <div class="execution-result-header">
      <span class="response-status${lastExecution.ok ? " success" : " error"}">${lastExecution.status} ${lastExecution.statusText}</span>
      <span>${lastExecution.durationMs} ms</span>
      <span>Served from <strong>${escapeHtml(servedFrom)}</strong></span>
    </div>
    <div class="response-tabs" role="tablist" aria-label="Response views">
      <button class="response-tab${responseView === "original" ? " selected" : ""}" type="button" role="tab" aria-selected="${responseView === "original"}" data-response-view="original">Original</button>
      <button class="response-tab${responseView === "headers" ? " selected" : ""}" type="button" role="tab" aria-selected="${responseView === "headers"}" data-response-view="headers">Headers</button>
      <button class="response-tab${responseView === "pretty" ? " selected" : ""}" type="button" role="tab" aria-selected="${responseView === "pretty"}" data-response-view="pretty">Pretty</button>
    </div>
    <pre class="code-block execution-response" role="tabpanel">${escapeHtml(responseContent)}</pre>
  `;
}

function renderWorkbench() {
  const service = selectedService();
  if (!service) {
    workbench.hidden = true;
    workbench.innerHTML = "";
    return;
  }

  service.endpoints = service.endpoints?.length
    ? service.endpoints
    : [{ method: "GET", path: "/health", label: "Health" }];
  if (!service.instances.some((instance) => instance.id === selectedInstanceId)) {
    selectedInstanceId = service.instances[0]?.id;
  }
  selectedEndpointIndex = clamp(selectedEndpointIndex, 0, service.endpoints.length - 1);

  const instance = selectedInstance(service);
  const endpoint = service.endpoints[selectedEndpointIndex];
  const desired = desiredCapacities.get(service.key) ?? service.instances.length;
  const maxReplicas = service.maxReplicas ?? 3;
  const requestBody = endpoint.body ? JSON.stringify(endpoint.body, null, 2) : "";
  const curl = buildCurl(endpoint, instance);

  workbench.hidden = false;
  workbench.style.setProperty("--accent", accents[service.color]);
  workbench.innerHTML = `
    <div class="workbench-header">
      <div class="workbench-title">
        <span class="service-glyph">${glyph(service.name)}</span>
        <div>
          <div class="eyebrow">Selected service</div>
          <h2>${escapeHtml(service.name)}</h2>
          <p>${escapeHtml(service.description)}</p>
        </div>
      </div>
      <span class="workbench-running"><strong>${service.instances.length}</strong> running</span>
    </div>

    <div class="workbench-capacity">
      <div>
        <div class="code-label">Replica capacity</div>
        <p>Set how many independent ${escapeHtml(service.name)} replicas should run, up to the configured limit of ${maxReplicas}.</p>
      </div>
      <div class="capacity-actions">
        <div class="count-control" aria-label="Desired number of replicas">
          <button type="button" data-capacity-action="decrease" aria-label="Decrease desired replicas">&minus;</button>
          <input type="number" min="0" max="${maxReplicas}" value="${desired}" aria-label="Desired replicas" data-capacity-input>
          <button type="button" data-capacity-action="increase" aria-label="Increase desired replicas">+</button>
        </div>
        <button class="button primary" type="button" data-apply-capacity>Apply capacity</button>
      </div>
    </div>

    <div class="workbench-targets">
      <div class="code-label">Target replica</div>
      <div class="instance-selector">
        ${service.instances.length ? service.instances.map((item) => `
          <button class="instance-option${item.id === selectedInstanceId ? " selected" : ""}" type="button" data-instance-id="${escapeHtml(item.id)}">
            <span class="status-dot"></span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>:${item.hostPort}</small>
          </button>
        `).join("") : '<span class="no-targets">No replicas are running. Add one above to execute an API.</span>'}
      </div>
    </div>

    <div class="api-workbench">
      <div class="endpoint-catalog">
        <div class="code-label">API endpoints</div>
        <div class="endpoint-list workbench-endpoints">
          ${service.endpoints.map((item, index) => `
            <button class="endpoint-option${index === selectedEndpointIndex ? " selected" : ""}" type="button" data-endpoint-index="${index}">
              <span>${escapeHtml(item.method)}</span>
              <code>${escapeHtml(item.path)}</code>
              <small>${escapeHtml(item.label)}</small>
            </button>
          `).join("")}
        </div>
      </div>

      <div class="request-composer">
        <div class="code-label">Request</div>
        <div class="selected-endpoint"><strong>${escapeHtml(endpoint.method)}</strong><code>${escapeHtml(endpoint.path)}</code></div>
        ${endpoint.body ? `
          <label class="request-body-label" for="request-body">Sample JSON body</label>
          <textarea class="request-body" id="request-body" data-request-body spellcheck="false">${escapeHtml(requestBody)}</textarea>
        ` : ""}
        <pre class="code-block workbench-curl" data-curl>${escapeHtml(curl)}</pre>
        <div class="request-actions">
          <button class="button primary" type="button" data-execute${instance ? "" : " disabled"}>Execute request</button>
          <button class="button" type="button" data-copy-curl${instance ? "" : " disabled"}>Copy curl</button>
        </div>
      </div>
    </div>

    <div class="execution-panel">
      <div class="code-label">Response</div>
      ${renderResponse()}
    </div>
  `;
}

async function loadServices({ syncCapacity = true } = {}) {
  refreshButton.disabled = true;
  try {
    services = await api("/api/services");
    if (syncCapacity) {
      for (const service of services) desiredCapacities.set(service.key, service.instances.length);
    }
    renderServices();
    renderWorkbench();
    errorNotice.hidden = true;
    systemStatus.innerHTML = '<span class="status-dot"></span><span>Docker connected</span>';
  } catch (error) {
    grid.innerHTML = "";
    workbench.hidden = true;
    runningReplicaCount.textContent = "—";
    activeServiceCount.textContent = "—";
    errorNotice.textContent = error.message;
    errorNotice.hidden = false;
    systemStatus.innerHTML = '<span class="status-dot error"></span><span>Docker unavailable</span>';
  } finally {
    refreshButton.disabled = false;
  }
}

async function applyCapacity(button) {
  const service = selectedService();
  const desired = clamp(workbench.querySelector("[data-capacity-input]").value, 0, service.maxReplicas ?? 3);
  const difference = desired - service.instances.length;
  desiredCapacities.set(service.key, desired);

  if (difference === 0) {
    showToast(`${desired} ${desired === 1 ? "replica is" : "replicas are"} already running.`);
    return;
  }

  button.disabled = true;
  button.textContent = "Scaling...";
  try {
    if (difference > 0) {
      await api(`/api/services/${service.key}/instances`, {
        method: "POST",
        body: JSON.stringify({ count: difference })
      });
    } else {
      const instancesToStop = service.instances.slice(desired);
      await Promise.all(instancesToStop.map((instance) => api(`/api/instances/${instance.id}`, { method: "DELETE" })));
    }
    lastExecution = undefined;
    responseView = "pretty";
    showToast(`Scaled ${service.name} to ${desired} ${desired === 1 ? "replica" : "replicas"}.`);
    await loadServices();
  } catch (error) {
    showToast(error.message, true);
    button.disabled = false;
    button.textContent = "Apply capacity";
  }
}

async function executeRequest(button) {
  const service = selectedService();
  const instance = selectedInstance(service);
  const endpoint = service.endpoints[selectedEndpointIndex];
  let body = endpoint.body;

  if (endpoint.body) {
    try {
      body = JSON.parse(workbench.querySelector("[data-request-body]").value);
    } catch {
      showToast("The request body must be valid JSON.", true);
      return;
    }
  }

  button.disabled = true;
  button.textContent = "Executing...";
  try {
    lastExecution = await api(`/api/instances/${instance.id}/execute`, {
      method: "POST",
      body: JSON.stringify({ endpointIndex: selectedEndpointIndex, body })
    });
    responseView = "pretty";
    renderWorkbench();
  } catch (error) {
    showToast(error.message, true);
    button.disabled = false;
    button.textContent = "Execute request";
  }
}

grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-service]");
  if (!card) return;
  selectedServiceKey = card.dataset.service;
  selectedEndpointIndex = 0;
  selectedInstanceId = selectedService().instances[0]?.id;
  lastExecution = undefined;
  responseView = "pretty";
  renderServices();
  renderWorkbench();
  workbench.scrollIntoView({ behavior: "smooth", block: "start" });
});

workbench.addEventListener("click", async (event) => {
  const capacityAction = event.target.closest("[data-capacity-action]");
  if (capacityAction) {
    const input = workbench.querySelector("[data-capacity-input]");
    const change = capacityAction.dataset.capacityAction === "increase" ? 1 : -1;
    input.value = clamp(Number(input.value) + change, 0, selectedService().maxReplicas ?? 3);
    desiredCapacities.set(selectedServiceKey, Number(input.value));
    return;
  }

  const applyButton = event.target.closest("[data-apply-capacity]");
  if (applyButton) {
    await applyCapacity(applyButton);
    return;
  }

  const instanceOption = event.target.closest("[data-instance-id]");
  if (instanceOption) {
    selectedInstanceId = instanceOption.dataset.instanceId;
    lastExecution = undefined;
    responseView = "pretty";
    renderWorkbench();
    return;
  }

  const endpointOption = event.target.closest("[data-endpoint-index]");
  if (endpointOption) {
    selectedEndpointIndex = Number(endpointOption.dataset.endpointIndex);
    lastExecution = undefined;
    responseView = "pretty";
    renderWorkbench();
    return;
  }

  if (event.target.closest("[data-copy-curl]")) {
    await copyText(workbench.querySelector("[data-curl]").textContent);
    showToast("curl command copied.");
    return;
  }

  const responseTab = event.target.closest("[data-response-view]");
  if (responseTab) {
    responseView = responseTab.dataset.responseView;
    renderWorkbench();
    return;
  }

  const executeButton = event.target.closest("[data-execute]");
  if (executeButton) await executeRequest(executeButton);
});

refreshButton.addEventListener("click", () => loadServices());
globalKillButton.addEventListener("click", async () => {
  if (!window.confirm("Stop and remove every Silicon Lanes service and lesson container? PostgreSQL data will be kept.")) return;

  globalKillButton.disabled = true;
  globalKillButton.textContent = "Killing all...";
  try {
    await api("/api/system", { method: "DELETE" });
    selectedInstanceId = undefined;
    lastExecution = undefined;
    responseView = "pretty";
    showToast("All service and lesson containers were removed.");
    await loadServices();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    globalKillButton.disabled = false;
    globalKillButton.textContent = "Kill all";
  }
});

loadServices();
