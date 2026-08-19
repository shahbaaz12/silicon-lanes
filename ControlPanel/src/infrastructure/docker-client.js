import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

const execFileAsync = promisify(execFile);

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);

export async function docker(args, options = {}) {
  const result = await execFileAsync("docker", args, {
    cwd: repositoryRoot,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    ...options
  });
  return result.stdout.trim();
}

export function friendlyDockerError(error) {
  const message = error.stderr?.trim() || error.message;
  if (/cannot connect|pipe\/docker|daemon is not running/i.test(message)) {
    return Object.assign(new Error("Docker Desktop is not running."), { statusCode: 503 });
  }
  return Object.assign(new Error(message), { statusCode: 500 });
}

export function idsFromLabel(container, label) {
  return (container?.Config.Labels?.[label] ?? "").split(",").filter(Boolean);
}

export function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port }, () => server.close(() => resolve(true)));
  });
}

// Every destructive call is scoped by a Docker label filter. An empty or missing label would
// widen that filter, so it is rejected rather than passed to Docker.
function requireLabelFilter(label) {
  if (typeof label !== "string" || !label.trim()) {
    throw new Error("A non-empty label filter is required before removing containers.");
  }
  return label;
}

// Read-only counterpart to removeContainersByLabel, used to show exactly which containers a
// destructive action would affect before it runs.
export async function listContainersByLabel(label) {
  const output = await docker([
    "ps",
    "--all",
    "--filter",
    `label=${requireLabelFilter(label)}`,
    "--format",
    "{{.ID}}\t{{.Names}}"
  ]);
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [id, name] = line.split("\t");
    return { id, name };
  });
}

export async function removeContainersByLabel(label) {
  requireLabelFilter(label);
  const output = await docker([
    "ps",
    "--all",
    "--filter",
    `label=${label}`,
    "--format",
    "{{.ID}}"
  ]);
  const ids = output.split(/\r?\n/).filter(Boolean);
  if (ids.length > 0) await docker(["rm", "--force", ...ids]);
  return ids;
}

export async function inspectLessonContainer({
  name,
  lessonLabel,
  includeStopped = false,
  conflictMessage = `Container name ${name} is already in use.`
}) {
  try {
    const [container] = JSON.parse(await docker(["inspect", name]));
    if (container.Config.Labels?.["com.silicon-lanes.lesson"] !== lessonLabel) {
      throw Object.assign(new Error(conflictMessage), { statusCode: 409 });
    }
    if (!includeStopped && !container.State.Running) return null;
    return container;
  } catch (error) {
    if (/No such (object|container)/i.test(error.stderr ?? "")) return null;
    throw error;
  }
}

export async function waitForHealthy(id, label, { attempts = 80, intervalMs = 250 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await docker([
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      id
    ]);
    if (status === "healthy") return;
    if (["unhealthy", "exited", "dead"].includes(status)) {
      const logs = await docker(["logs", "--tail", "60", id]);
      throw new Error(`${label} failed to start.\n${logs}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`${label} did not become ready in time.`);
}

// Every lesson's Nginx access log is tagged with a `[lesson-tag]` prefix and matched with its
// own regex; this is the shared split → match → drop-anything-before-the-last-clear → format
// chain that every lesson manager otherwise reimplemented individually. `timeMs` extracts the
// comparable timestamp from a match (defaults to the first capture group as an ISO string);
// pass a custom one for logs that key clear-time off a different field (e.g. a raw `msec=`).
export function parseTaggedLogs(output, pattern, clearTime, format, timeMs = (match) => Date.parse(match[1])) {
  return output.split(/\r?\n/)
    .map((line) => line.match(pattern))
    .filter(Boolean)
    .filter((match) => !clearTime || timeMs(match) > clearTime)
    .map(format);
}

// Fetches, parses, and trims one container's tagged log stream down to its last `keep` lines,
// falling back to `emptyMessage` when nothing matched.
export async function formattedLogs(container, { tail = 200, pattern, clearTime, format, keep = 30, emptyMessage, timeMs }) {
  const output = await docker(["logs", "--tail", String(tail), container.Id]);
  const lines = parseTaggedLogs(output, pattern, clearTime, format, timeMs);
  return lines.length ? lines.slice(-keep).join("\n") : emptyMessage;
}
