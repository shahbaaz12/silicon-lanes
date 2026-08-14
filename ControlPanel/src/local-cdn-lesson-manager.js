import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import {
  clearAdvancedLessonLogs,
  getAdvancedLessonLogs,
  getAdvancedLessonState,
  startAdvancedLesson,
  stopAdvancedLesson
} from "./advanced-lesson-manager.js";

const execFileAsync = promisify(execFile);
const controlPanelDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(controlPanelDirectory, "..");
const cdnTemplate = path.join(repositoryRoot, "Lessons", "lesson-07-local-cdn", "nginx", "cdn.conf.template");
const lessonLabel = "lesson-07-local-cdn";
const cdnName = "localCdn1";
const cdnPort = 7712;
const networkName = "silicon-lanes-network";
let logClearTime = 0;

async function docker(args, options = {}) {
  const result = await execFileAsync("docker", args, { cwd: repositoryRoot, windowsHide: true, maxBuffer: 10 * 1024 * 1024, ...options });
  return result.stdout.trim();
}

function friendlyDockerError(error) {
  const message = error.stderr?.trim() || error.message;
  if (/cannot connect|pipe\/docker|daemon is not running/i.test(message)) {
    return Object.assign(new Error("Docker Desktop is not running."), { statusCode: 503 });
  }
  return Object.assign(new Error(message), { statusCode: 500 });
}

async function inspectCdn({ includeStopped = false } = {}) {
  try {
    const [container] = JSON.parse(await docker(["inspect", cdnName]));
    if (container.Config.Labels?.["com.silicon-lanes.lesson"] !== lessonLabel) {
      throw Object.assign(new Error(`Container name ${cdnName} is already in use.`), { statusCode: 409 });
    }
    if (!includeStopped && !container.State.Running) return null;
    return container;
  } catch (error) {
    if (/No such (object|container)/i.test(error.stderr ?? "")) return null;
    throw error;
  }
}

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer(); server.unref(); server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port }, () => server.close(() => resolve(true)));
  });
}

async function waitForHealthy(id) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const status = await docker(["inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", id]);
    if (status === "healthy") return;
    if (["unhealthy", "exited", "dead"].includes(status)) throw new Error(`Local CDN failed to start.\n${await docker(["logs", "--tail", "60", id])}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local CDN did not become ready in time.");
}

async function removeCdn(container) {
  if (container) await docker(["rm", "--force", container.Id]);
  logClearTime = 0;
}

function stateFrom(cdn, origin) {
  const running = Boolean(cdn?.State.Running && origin.running);
  return {
    ...origin,
    running,
    ready: Boolean(running && origin.ready),
    cdn: cdn ? { name: cdnName, hostPort: cdnPort, containerPort: 80, baseUrl: `http://127.0.0.1:${cdnPort}`, cacheTtlSeconds: 15 } : null
  };
}

export async function getLocalCdnLessonState() {
  try { return stateFrom(await inspectCdn(), await getAdvancedLessonState()); }
  catch (error) { if (error.statusCode) throw error; throw friendlyDockerError(error); }
}

export async function startLocalCdnLesson() {
  try {
    const existing = await inspectCdn();
    const existingOrigin = await getAdvancedLessonState();
    if (existing && existingOrigin.ready) return stateFrom(existing, existingOrigin);

    const stopped = await inspectCdn({ includeStopped: true });
    const originWasReady = existingOrigin.ready;
    await removeCdn(stopped);
    const origin = await startAdvancedLesson();
    if (!await portIsAvailable(cdnPort)) throw Object.assign(new Error(`Port ${cdnPort} is already in use.`), { statusCode: 409 });

    const id = await docker([
      "run", "--detach", "--name", cdnName, "--hostname", cdnName, "--network", networkName,
      "--label", `com.silicon-lanes.lesson=${lessonLabel}`,
      "--label", `com.silicon-lanes.owns-origin=${String(!originWasReady)}`,
      "--env", "ORIGIN_UPSTREAM=advancedEdgeLoadBalancer1:80",
      "--mount", `type=bind,source=${cdnTemplate},target=/etc/nginx/templates/default.conf.template,readonly`,
      "--publish", `127.0.0.1:${cdnPort}:80`,
      "--health-cmd", "wget -q -O - http://127.0.0.1/cdn-health >/dev/null || exit 1",
      "--health-interval", "2s", "--health-timeout", "3s", "--health-retries", "20",
      "nginx:1.27-alpine"
    ], { timeout: 5 * 60 * 1000 });
    await waitForHealthy(id);
    await clearAdvancedLessonLogs();
    logClearTime = Date.now();
    return stateFrom(await inspectCdn(), origin);
  } catch (error) { if (error.statusCode) throw error; throw friendlyDockerError(error); }
}

export async function stopLocalCdnLesson() {
  try {
    const cdn = await inspectCdn({ includeStopped: true });
    const ownsOrigin = cdn?.Config.Labels?.["com.silicon-lanes.owns-origin"] === "true";
    await removeCdn(cdn);
    if (ownsOrigin) await stopAdvancedLesson();
  } catch (error) { if (error.statusCode) throw error; throw friendlyDockerError(error); }
}

function parseCdnLogs(output) {
  return output.split(/\r?\n/).map((line) => line.match(/^\[local-cdn\]\s+(\S+)\s+msec=(\S+)\s+([A-Z]+)\s+(\S+)\s+(\d+)\s+cache=(\S+)$/)).filter(Boolean)
    .filter((match) => !logClearTime || Number(match[2]) * 1000 > logClearTime)
    .map((match) => `${match[1]}  ${match[3]}  ${match[4]}  ${match[6] === "-" ? "BYPASS" : match[6]}`);
}

export async function getLocalCdnLessonLogs() {
  try {
    const cdn = await inspectCdn();
    const downstream = await getAdvancedLessonLogs();
    if (!cdn) return { cdnLogs: "Start Lesson 7.", ...downstream };
    const lines = parseCdnLogs(await docker(["logs", "--tail", "200", cdn.Id]));
    return { cdnLogs: lines.length ? lines.slice(-30).join("\n") : "No CDN requests yet.", ...downstream };
  } catch (error) { if (error.statusCode) throw error; throw friendlyDockerError(error); }
}

export async function clearLocalCdnLessonLogs() {
  try { logClearTime = Date.now(); await clearAdvancedLessonLogs(); }
  catch (error) { if (error.statusCode) throw error; throw friendlyDockerError(error); }
}

export async function clearLocalCdnCache() {
  try {
    const cdn = await inspectCdn();
    if (!cdn) throw Object.assign(new Error("Start Lesson 7 before clearing its cache."), { statusCode: 409 });
    await docker(["exec", cdn.Id, "sh", "-c", "if [ -d /var/cache/nginx/products ]; then find /var/cache/nginx/products -type f -delete; fi"]);
  } catch (error) { if (error.statusCode) throw error; throw friendlyDockerError(error); }
}
