// A global cleanup control, mounted on the home page and every lesson.
//
// It mirrors theme.js: one file served from the Control Panel's public root, loaded with a
// plain <script src="/kill-all.js"> tag, mounting itself into <body> so no page needs its own
// markup. It deliberately renders its own toasts rather than reusing a page's toast region —
// those are inconsistent across the site (#toast-region on the Service Lab, #toasts on the
// lessons, and none at all on the home page or Lesson 8).
//
// The Service Lab is the one page that does NOT load this, because it already has its own
// "Kill all" button in its toolbar.

const CONFIRM_MESSAGE =
  "Stop and remove every Silicon Lanes service and lesson container?\n\n" +
  "PostgreSQL and its stored data are kept.";

function mountToast(message, isError = false) {
  let region = document.querySelector("#kill-all-toasts");
  if (!region) {
    region = document.createElement("div");
    region.id = "kill-all-toasts";
    region.className = "kill-all-toasts";
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  const toast = document.createElement("div");
  toast.className = `kill-all-toast${isError ? " error" : ""}`;
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function mountKillAll() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "kill-all-button";
  button.id = "global-kill-all";
  button.title = "Stop and remove every managed service and lesson container";
  button.innerHTML = '<span class="kill-all-dot" aria-hidden="true"></span><span>Kill all containers</span>';

  const label = button.querySelector("span:last-child");
  const setBusy = (busy, text) => {
    button.disabled = busy;
    label.textContent = text;
  };

  button.addEventListener("click", async () => {
    if (!window.confirm(CONFIRM_MESSAGE)) return;
    setBusy(true, "Stopping everything...");
    try {
      const response = await fetch("/api/system", {
        method: "DELETE",
        headers: { "content-type": "application/json" }
      });
      const body = response.status === 204 ? null : await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);

      const count = Array.isArray(body?.stopped) ? body.stopped.length : 0;
      mountToast(count
        ? `Removed ${count} container${count === 1 ? "" : "s"}. PostgreSQL and its data were kept.`
        : "Nothing was running.");

      // Lesson pages poll their own state, but refreshing gives an immediate, honest view
      // rather than leaving stale "running" controls on screen.
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      mountToast(error.message, true);
      setBusy(false, "Kill all containers");
    }
  });

  document.body.append(button);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountKillAll);
else mountKillAll();
