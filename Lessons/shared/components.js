let responsePanelSequence = 0;

class LessonNodeCard extends HTMLElement {
  connectedCallback() {
    if (this.dataset.componentReady === "true") return;
    this.dataset.componentReady = "true";
    this.setAttribute("role", "article");

    const kind = this.localName.replace("lesson-", "").replace("-card", "");
    const heading = document.createElement("div");
    heading.className = "lesson-node-heading";

    const icon = document.createElement("span");
    icon.className = `lesson-node-icon lesson-node-icon-${kind}`;
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = this.getAttribute("icon") ?? ({ client: "C", service: "S", proxy: "RP" })[kind];

    const identity = document.createElement("div");
    identity.className = "lesson-node-identity";
    const kicker = document.createElement("small");
    kicker.className = "lesson-node-kicker";
    kicker.textContent = this.getAttribute("kicker") ?? "";
    const title = document.createElement("h2");
    if (this.hasAttribute("title-id")) title.id = this.getAttribute("title-id");
    title.textContent = this.getAttribute("heading") ?? "Service";
    identity.append(kicker, title);

    const status = document.createElement("span");
    const initialStatus = this.getAttribute("status") ?? "stopped";
    status.className = `lesson-node-status ${initialStatus}`;
    if (this.hasAttribute("status-id")) status.id = this.getAttribute("status-id");
    status.textContent = initialStatus;

    heading.append(icon, identity, status);
    this.prepend(heading);
  }

  signalActivity(duration = 850) {
    window.clearTimeout(this.activityTimer);
    this.classList.remove("lesson-node-active");
    void this.offsetWidth;
    this.classList.add("lesson-node-active");
    this.activityTimer = window.setTimeout(() => {
      this.classList.remove("lesson-node-active");
    }, duration);
  }

  disconnectedCallback() {
    window.clearTimeout(this.activityTimer);
  }
}

class LessonResponsePanel extends HTMLElement {
  connectedCallback() {
    if (this.dataset.componentReady === "true") return;
    this.dataset.componentReady = "true";
    this.classList.add("lesson-response-panel");

    const body = this.querySelector("[data-response-body]");
    const json = this.querySelector("[data-response-json]");
    const headers = this.querySelector("[data-response-headers]");
    if (!body || !json || !headers) {
      throw new Error("lesson-response-panel requires pretty, JSON, and headers content.");
    }

    const panelId = `lesson-response-${++responsePanelSequence}`;
    const pretty = document.createElement("div");
    pretty.id = `${panelId}-pretty`;
    pretty.className = "lesson-response-view lesson-response-pretty";
    const servedBy = document.createElement("div");
    servedBy.className = "lesson-served-by";
    const servedByLabel = document.createElement("span");
    servedByLabel.textContent = "Served from";
    const servedByValue = document.createElement("strong");
    servedByValue.id = this.getAttribute("server-id") ?? `${panelId}-server`;
    servedByValue.textContent = "waiting for response";
    servedBy.append(servedByLabel, servedByValue);
    pretty.append(servedBy, body);

    json.id ||= `${panelId}-json`;
    headers.id ||= `${panelId}-headers`;
    json.classList.add("lesson-response-view", "lesson-response-code");
    headers.classList.add("lesson-response-view", "lesson-response-code");

    const panels = [
      { label: "Pretty", element: pretty },
      { label: "JSON", element: json },
      { label: "Headers", element: headers }
    ];
    panels.forEach(({ element }, index) => {
      element.setAttribute("role", "tabpanel");
      element.hidden = index !== 0;
    });

    const heading = document.createElement("div");
    heading.className = "lesson-response-heading";
    const label = document.createElement("span");
    label.textContent = this.getAttribute("heading") ?? "Response at client";
    const summary = document.createElement("span");
    summary.className = "lesson-response-summary";
    if (this.hasAttribute("time-id")) {
      const time = document.createElement("small");
      time.id = this.getAttribute("time-id");
      time.textContent = "— ms";
      summary.append(time);
    }
    const meta = document.createElement("b");
    meta.id = this.getAttribute("meta-id") ?? `${panelId}-meta`;
    meta.textContent = "waiting";
    summary.append(meta);
    heading.append(label, summary);

    const tabs = document.createElement("div");
    tabs.className = "lesson-response-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Client response view");
    const tabButtons = panels.map(({ label, element }, index) => {
      const tab = this.createTab(label, element.id, index === 0);
      element.setAttribute("aria-labelledby", tab.id);
      tabs.append(tab);
      return tab;
    });

    const selectTab = (selectedIndex) => {
      tabButtons.forEach((tab, index) => {
        const selected = index === selectedIndex;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[index].element.hidden = !selected;
      });
    };
    tabButtons.forEach((tab, index) => tab.addEventListener("click", () => selectTab(index)));
    tabs.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = tabButtons.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + direction + tabButtons.length) % tabButtons.length;
      selectTab(nextIndex);
      tabButtons[nextIndex].focus();
    });

    this.replaceChildren(heading, tabs, ...panels.map(({ element }) => element));
  }

  createTab(label, controls, selected) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lesson-response-tab";
    button.setAttribute("role", "tab");
    button.id = `${controls}-tab`;
    button.setAttribute("aria-controls", controls);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    button.textContent = label;
    return button;
  }
}

for (const tagName of ["lesson-client-card", "lesson-service-card", "lesson-proxy-card", "lesson-load-balancer-card"]) {
  if (!customElements.get(tagName)) customElements.define(tagName, class extends LessonNodeCard {});
}
if (!customElements.get("lesson-response-panel")) customElements.define("lesson-response-panel", LessonResponsePanel);

export function formatResponseHeaders(response) {
  const statusLine = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
  const headers = [...response.headers.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}: ${value}`);
  return [statusLine, ...headers].join("\n");
}
