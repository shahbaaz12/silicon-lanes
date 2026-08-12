import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseDirectory = path.join(rootDirectory, "Database");

const services = [
  { name: "user-service", port: 6112 },
  { name: "catalog-service", port: 6113 },
  { name: "inventory-service", port: 6114 },
  { name: "cart-service", port: 6115 },
  { name: "order-service", port: 6116 },
  { name: "payment-service", port: 6117 }
];

const children = new Set();
let stopping = false;

for (const service of services) {
  const entryPoint = path.join(
    rootDirectory,
    "Application",
    "services",
    service.name,
    "src",
    "server.js"
  );

  const child = spawn(process.execPath, [entryPoint], {
    cwd: rootDirectory,
    env: {
      ...process.env,
      PORT: String(service.port),
      DATABASE_DIR: databaseDirectory
    },
    stdio: "inherit"
  });

  children.add(child);
  console.log(`[launcher] Starting ${service.name} on port ${service.port}`);

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (!stopping && code !== 0) {
      console.error(
        `[launcher] ${service.name} stopped unexpectedly (${signal ?? `exit ${code}`})`
      );
      stopAll("SIGTERM");
      process.exitCode = code ?? 1;
    }
  });
}

function stopAll(signal) {
  if (stopping) return;
  stopping = true;
  console.log("\n[launcher] Stopping all services...");

  for (const child of children) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));

