import { Router } from "express";
import {
  clearInstanceLogs,
  getInstanceLogs,
  listManagedInstances,
  startInstances,
  stopInstance,
  stopServiceInstances
} from "../docker-manager.js";
import { getService, serviceCatalog } from "../service-catalog.js";
import { asyncHandler } from "./async-handler.js";

const configuredReplicaLimit = Number(process.env.SILICON_LANES_MAX_REPLICAS ?? 3);
export const MAX_SERVICE_REPLICAS = Number.isInteger(configuredReplicaLimit) && configuredReplicaLimit > 0
  ? configuredReplicaLimit
  : 3;

export function createServiceRouter() {
  const router = Router();

  router.get("/services", asyncHandler(async (_request, response) => {
    const instances = await listManagedInstances();
    response.json(Object.values(serviceCatalog).map((service) => ({
      ...service,
      maxReplicas: MAX_SERVICE_REPLICAS,
      instances: instances.filter((instance) => instance.serviceKey === service.key)
    })));
  }));

  router.post("/services/:key/instances", asyncHandler(async (request, response) => {
    const service = getService(request.params.key);
    if (!service) return response.status(404).json({ error: "Service not found." });

    const count = Number(request.body.count ?? 1);
    if (!Number.isInteger(count) || count < 1 || count > MAX_SERVICE_REPLICAS) {
      return response.status(400).json({ error: `count must be an integer from 1 to ${MAX_SERVICE_REPLICAS}.` });
    }

    const instances = await listManagedInstances();
    const runningCount = instances.filter((instance) => instance.serviceKey === service.key).length;
    if (runningCount + count > MAX_SERVICE_REPLICAS) {
      return response.status(409).json({ error: `${service.name} can run at most ${MAX_SERVICE_REPLICAS} replicas.` });
    }

    return response.status(201).json(await startInstances(service, count));
  }));

  router.delete("/services/:key/instances", asyncHandler(async (request, response) => {
    const service = getService(request.params.key);
    if (!service) return response.status(404).json({ error: "Service not found." });
    return response.json({ stopped: await stopServiceInstances(service.key) });
  }));

  router.delete("/instances/:id", asyncHandler(async (request, response) => {
    await stopInstance(request.params.id);
    return response.status(204).end();
  }));

  router.post("/instances/:id/execute", asyncHandler(async (request, response) => {
    const instances = await listManagedInstances();
    const instance = instances.find((item) => item.id === request.params.id);
    if (!instance) return response.status(404).json({ error: "Managed replica not found." });

    const service = getService(instance.serviceKey);
    const endpointIndex = Number(request.body.endpointIndex);
    const endpoint = service?.endpoints?.[endpointIndex];
    if (!Number.isInteger(endpointIndex) || !endpoint) {
      return response.status(400).json({ error: "Select a valid endpoint for this service." });
    }

    const requestBody = Object.hasOwn(request.body, "body") ? request.body.body : endpoint.body;
    const startedAt = performance.now();
    const upstream = await fetch(`http://127.0.0.1:${instance.hostPort}${endpoint.path}`, {
      method: endpoint.method,
      headers: requestBody === undefined ? undefined : { "content-type": "application/json" },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
      signal: AbortSignal.timeout(5_000)
    });
    const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
    const responseText = await upstream.text();
    let responseBody = responseText;
    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      // Preserve non-JSON service responses as text.
    }

    return response.json({
      ok: upstream.ok,
      status: upstream.status,
      statusText: upstream.statusText,
      durationMs,
      headers: Object.fromEntries(upstream.headers.entries()),
      rawBody: responseText,
      request: {
        method: endpoint.method,
        url: `http://localhost:${instance.hostPort}${endpoint.path}`
      },
      body: responseBody
    });
  }));

  router.get("/instances/:id/logs", asyncHandler(async (request, response) => (
    response.json({ logs: await getInstanceLogs(request.params.id) })
  )));

  router.delete("/instances/:id/logs", asyncHandler(async (request, response) => {
    await clearInstanceLogs(request.params.id);
    return response.status(204).end();
  }));

  return router;
}
