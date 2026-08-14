import { api } from "./shared/ui.js";

const systemStatus = document.querySelector("#system-status");

try {
  await api("/api/services");
  systemStatus.innerHTML = '<span class="status-dot"></span><span>Docker connected</span>';
} catch {
  systemStatus.innerHTML = '<span class="status-dot error"></span><span>Docker unavailable</span>';
}
