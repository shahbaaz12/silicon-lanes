// Replaces the Control Panel's home.js, which pinged /api/services to report
// whether Docker was reachable. There is no Docker here, so the indicator states
// what this build actually is.
//
// This file is NOT overwritten by tools/sync.mjs -- see the exclusion note there.
const systemStatus = document.querySelector("#system-status");

if (systemStatus) {
  systemStatus.innerHTML = '<span class="status-dot"></span><span>Simulated &middot; no Docker</span>';
  systemStatus.title = "Containers, requests, and logs are generated in your browser.";
}
