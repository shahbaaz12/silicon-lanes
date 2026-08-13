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
}

class LessonResponsePanel extends HTMLElement {
  connectedCallback() {
    if (this.dataset.componentReady === "true") return;
    this.dataset.componentReady = "true";
    this.classList.add("lesson-response-panel");

    const body = this.querySelector("[data-response-body]");
    const headers = this.querySelector("[data-response-headers]");
    if (!body || !headers) throw new Error("lesson-response-panel requires body and headers content.");

    const panelId = `lesson-response-${++responsePanelSequence}`;
    const bodyId = `${panelId}-body`;
    const headersId = `${panelId}-headers`;
    body.id ||= bodyId;
    headers.id ||= headersId;
    body.classList.add("lesson-response-view");
    headers.classList.add("lesson-response-view", "lesson-response-headers");
    body.setAttribute("role", "tabpanel");
    headers.setAttribute("role", "tabpanel");
    headers.hidden = true;

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
    const bodyTab = this.createTab("Body", body.id, true);
    const headersTab = this.createTab("Headers", headers.id, false);
    body.setAttribute("aria-labelledby", bodyTab.id);
    headers.setAttribute("aria-labelledby", headersTab.id);
    tabs.append(bodyTab, headersTab);

    const selectTab = (selectedTab, selectedPanel, otherTab, otherPanel) => {
      selectedTab.setAttribute("aria-selected", "true");
      selectedTab.tabIndex = 0;
      selectedPanel.hidden = false;
      otherTab.setAttribute("aria-selected", "false");
      otherTab.tabIndex = -1;
      otherPanel.hidden = true;
    };
    bodyTab.addEventListener("click", () => selectTab(bodyTab, body, headersTab, headers));
    headersTab.addEventListener("click", () => selectTab(headersTab, headers, bodyTab, body));
    tabs.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const target = bodyTab.getAttribute("aria-selected") === "true" ? headersTab : bodyTab;
      target.click();
      target.focus();
    });

    this.replaceChildren(heading, tabs, body, headers);
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

for (const tagName of ["lesson-client-card", "lesson-service-card", "lesson-proxy-card"]) {
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
