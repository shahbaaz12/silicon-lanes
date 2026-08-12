import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  getInstanceLogs,
  listManagedInstances,
  requestInstance,
  startInstances,
  stopInstance
} from "./docker-manager.js";
import { getService, serviceCatalog } from "./service-catalog.js";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = path.join(directory, "public");
const port = Number(process.env.PORT ?? 7012);
const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.use(express.static(publicDirectory));

app.get("/api/services", async (_request, response, next) => {
  try {
    const instances = await listManagedInstances();
    response.json(Object.values(serviceCatalog).map((service) => ({
      ...service,
      instances: instances.filter((instance) => instance.serviceKey === service.key)
    })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/services/:key/instances", async (request, response, next) => {
  try {
    const service = getService(request.params.key);
    if (!service) return response.status(404).json({ error: "Service not found." });
    const count = Number(request.body.count ?? 1);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return response.status(400).json({ error: "count must be an integer from 1 to 10." });
    }
    response.status(201).json(await startInstances(service, count));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/instances/:id", async (request, response, next) => {
  try {
    await stopInstance(request.params.id);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/instances/:id/logs", async (request, response, next) => {
  try {
    response.json({ logs: await getInstanceLogs(request.params.id) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/instances/:id/request", async (request, response, next) => {
  try {
    response.json(await requestInstance(request.params.id));
  } catch (error) {
    next(error);
  }
});

app.get("/services/:key", (request, response, next) => {
  if (!getService(request.params.key)) return next();
  response.sendFile(path.join(publicDirectory, "details.html"));
});

app.use("/api", (_request, response) => response.status(404).json({ error: "API route not found." }));
app.use((_request, response) => response.status(404).sendFile(path.join(publicDirectory, "404.html")));
app.use((error, _request, response, _next) => {
  console.error("[control-panel]", error);
  response.status(error.statusCode ?? 500).json({ error: error.message ?? "Unexpected error." });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`[control-panel] Open http://localhost:${port}`);
});

