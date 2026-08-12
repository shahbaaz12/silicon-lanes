import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const services = [
  { name: "user-service", port: 6112 },
  { name: "catalog-service", port: 6113 },
  { name: "inventory-service", port: 6114 },
  { name: "cart-service", port: 6115 },
  { name: "order-service", port: 6116 },
  { name: "payment-service", port: 6117 }
];
const children = [];

function entryPoint(name) {
  return path.join(rootDirectory, "Application", "services", name, "src", "server.js");
}

async function waitUntilHealthy(port) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Service on port ${port} did not become healthy`);
}

async function request(port, route, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers }
  });
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${route} returned ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}

try {
  for (const service of services) {
    children.push(spawn(process.execPath, [entryPoint(service.name)], {
      cwd: rootDirectory,
      env: { ...process.env, PORT: String(service.port), DATABASE_PATH: ":memory:" },
      stdio: "ignore"
    }));
  }

  const health = await Promise.all(services.map(({ port }) => waitUntilHealthy(port)));
  await request(6112, "/api/users", { method: "POST", body: JSON.stringify({ name: "Test User", email: "test@example.com" }) });
  await request(6113, "/api/products", { method: "POST", body: JSON.stringify({ name: "Test Product", priceCents: 2500 }) });
  await request(6114, "/api/inventory", { method: "PUT", body: JSON.stringify({ productId: 1, quantity: 10 }) });
  await request(6115, "/api/carts/1/items", { method: "POST", body: JSON.stringify({ productId: 1, quantity: 2 }) });
  await request(6116, "/api/orders", { method: "POST", body: JSON.stringify({ userId: 1, totalCents: 5000 }) });
  await request(6117, "/api/payments", { method: "POST", body: JSON.stringify({ orderId: 1, amountCents: 5000 }) });

  console.log(`Smoke test passed: ${health.map(({ service }) => service).join(", ")}`);
} finally {
  for (const child of children) child.kill();
}

