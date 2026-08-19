// Global progress indicator for container lifecycle operations.
//
// Mounted the same way as theme.js and kill-all.js: served from the Control Panel's public
// root, pulled in with a plain script tag, and mounting itself into <body>, so no page needs
// its own markup.
//
// It works by wrapping window.fetch rather than by each page calling start/stop helpers.
// That keeps the eight lesson pages and the Service Lab untouched, and means the indicator
// cannot drift out of sync with their own logic. The wrapper is deliberately narrow:
//
//   * Only requests on the allowlist below are watched. Everything else — including the
//     log polling every lesson runs on a timer, clearing logs, clearing the CDN cache, and
//     executing a sample request — passes through untouched.
//   * Nothing appears for the first SHOW_AFTER_MS. Quick calls therefore never flash a bar.
//   * Progress is indeterminate, because Docker gives us no completion percentage. Showing
//     a filling bar would be inventing a number. An elapsed counter is shown instead, which
//     is true and answers the real question: is this still doing something?

const SHOW_AFTER_MS = 400;
const SLOW_HINT_AFTER_MS = 20000;

// Container lifecycle only. Anything creating, destroying or rebuilding containers is slow
// enough to deserve feedback; nothing else is listed.
const WATCHED = [
  { method: "POST", pattern: /\/api\/lessons\/[^/]+\/start$/, label: "Starting containers" },
  { method: "DELETE", pattern: /\/api\/lessons\/[^/]+\/stop$/, label: "Stopping containers" },
  { method: "DELETE", pattern: /\/api\/lessons\/[^/]+\/services\/[^/]+$/, label: "Stopping a replica" },
  { method: "POST", pattern: /\/api\/services\/[^/]+\/instances$/, label: "Starting replicas" },
  { method: "DELETE", pattern: /\/api\/services\/[^/]+\/instances$/, label: "Stopping replicas" },
  { method: "DELETE", pattern: /\/api\/instances\/[^/]+$/, label: "Stopping a replica" },
  { method: "DELETE", pattern: /\/api\/system$/, label: "Removing every container" }
];

function match(method, url) {
  const path = (() => {
    try { return new URL(url, window.location.origin).pathname; } catch { return String(url); }
  })();
  return WATCHED.find((entry) => entry.method === method && entry.pattern.test(path));
}

let active = 0;
let label = "Working";
let startedAt = 0;
let showTimer;
let tickTimer;
let elements;

function build() {
  if (elements) return elements;
  const bar = document.createElement("div");
  bar.className = "op-progress-bar";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Container operation in progress");
  bar.innerHTML = '<i></i>';

  const badge = document.createElement("div");
  badge.className = "op-progress-badge";
  badge.setAttribute("aria-live", "polite");
  badge.innerHTML = '<span class="op-progress-spinner" aria-hidden="true"></span><span class="op-progress-text"></span>';

  document.body.append(bar, badge);
  elements = { bar, badge, text: badge.querySelector(".op-progress-text") };
  return elements;
}

function render() {
  const { text } = build();
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const hint = Date.now() - startedAt > SLOW_HINT_AFTER_MS
    ? " · first run builds images, this can take a few minutes"
    : "";
  text.textContent = `${label}… ${seconds}s${hint}`;
}

function show() {
  const { bar, badge } = build();
  render();
  bar.classList.add("visible");
  badge.classList.add("visible");
  window.clearInterval(tickTimer);
  tickTimer = window.setInterval(render, 1000);
}

function hide() {
  window.clearTimeout(showTimer);
  window.clearInterval(tickTimer);
  if (!elements) return;
  elements.bar.classList.remove("visible");
  elements.badge.classList.remove("visible");
}

function begin(entry) {
  label = entry.label;
  if (active === 0) {
    startedAt = Date.now();
    window.clearTimeout(showTimer);
    showTimer = window.setTimeout(show, SHOW_AFTER_MS);
  }
  active += 1;
}

function end() {
  active = Math.max(0, active - 1);
  if (active === 0) hide();
}

const originalFetch = window.fetch.bind(window);

window.fetch = function trackedFetch(input, init = {}) {
  const url = typeof input === "string" ? input : input?.url ?? "";
  const method = String(init.method ?? (typeof input === "object" ? input?.method : "") ?? "GET").toUpperCase();
  const entry = match(method, url);
  if (!entry) return originalFetch(input, init);

  begin(entry);
  return originalFetch(input, init).finally(end);
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
else build();
