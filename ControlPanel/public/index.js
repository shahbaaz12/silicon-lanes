const grid = document.querySelector("#services-grid");
const errorNotice = document.querySelector("#error-notice");
const systemStatus = document.querySelector("#system-status");
const refreshButton = document.querySelector("#refresh-button");
let selectedService;

const accents = {
  violet: "#b69cff",
  cyan: "#69d9ec",
  emerald: "#6fe0a7",
  amber: "#efc766",
  orange: "#f49a66",
  rose: "#f0809c"
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function glyph(name) {
  return name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
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

function renderServices(services) {
  grid.innerHTML = services.map((service) => `
    <article
      class="service-card${selectedService === service.key ? " selected" : ""}"
      style="--accent: ${accents[service.color]}"
      data-service="${escapeHtml(service.key)}"
      tabindex="0"
      aria-label="Select ${escapeHtml(service.name)}"
    >
      <div class="card-topline">
        <span class="service-glyph">${glyph(service.name)}</span>
        <span class="instance-count"><strong>${service.instances.length}</strong> running</span>
      </div>
      <h3>${escapeHtml(service.name)}</h3>
      <p>${escapeHtml(service.description)}</p>
      <div class="card-actions">
        <div class="count-control" aria-label="Number of instances">
          <button type="button" data-count-action="decrease" aria-label="Decrease instances">−</button>
          <input type="number" min="1" max="10" value="1" aria-label="Instances to start">
          <button type="button" data-count-action="increase" aria-label="Increase instances">+</button>
        </div>
        <button class="button primary" type="button" data-start>Start</button>
        <a class="button" href="/services/${encodeURIComponent(service.key)}" data-details>Details</a>
      </div>
    </article>
  `).join("");
}

async function loadServices() {
  refreshButton.disabled = true;
  try {
    const services = await api("/api/services");
    renderServices(services);
    errorNotice.hidden = true;
    systemStatus.innerHTML = '<span class="status-dot"></span><span>Docker connected</span>';
  } catch (error) {
    grid.innerHTML = "";
    errorNotice.textContent = error.message;
    errorNotice.hidden = false;
    systemStatus.innerHTML = '<span class="status-dot error"></span><span>Docker unavailable</span>';
  } finally {
    refreshButton.disabled = false;
  }
}

grid.addEventListener("click", async (event) => {
  const card = event.target.closest(".service-card");
  if (!card) return;
  selectedService = card.dataset.service;
  document.querySelectorAll(".service-card").forEach((item) => item.classList.toggle("selected", item === card));

  const countInput = card.querySelector("input");
  const countAction = event.target.closest("[data-count-action]");
  if (countAction) {
    const change = countAction.dataset.countAction === "increase" ? 1 : -1;
    countInput.value = Math.max(1, Math.min(10, Number(countInput.value) + change));
    return;
  }

  const startButton = event.target.closest("[data-start]");
  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = "Starting…";
    try {
      const count = Math.max(1, Math.min(10, Number(countInput.value)));
      await api(`/api/services/${selectedService}/instances`, {
        method: "POST",
        body: JSON.stringify({ count })
      });
      showToast(`${count} ${count === 1 ? "instance" : "instances"} started.`);
      await loadServices();
    } catch (error) {
      showToast(error.message, true);
      startButton.disabled = false;
      startButton.textContent = "Start";
    }
  }
});

grid.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".service-card")) {
    event.preventDefault();
    event.target.click();
  }
});

refreshButton.addEventListener("click", loadServices);
loadServices();

