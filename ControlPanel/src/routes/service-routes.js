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

export function createServiceRouter() {
  const router = Router();

  router.get("/services", asyncHandler(async (_request, response) => {
    const instances = await listManagedInstances();
    response.json(Object.values(serviceCatalog).map((service) => ({
      ...service,
      instances: instances.filter((instance) => instance.serviceKey === service.key)
    })));
  }));

  router.post("/services/:key/instances", asyncHandler(async (request, response) => {
    const service = getService(request.params.key);
    if (!service) return response.status(404).json({ error: "Service not found." });

    const count = Number(request.body.count ?? 1);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return response.status(400).json({ error: "count must be an integer from 1 to 10." });
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

  router.get("/instances/:id/logs", asyncHandler(async (request, response) => (
    response.json({ logs: await getInstanceLogs(request.params.id) })
  )));

  router.delete("/instances/:id/logs", asyncHandler(async (request, response) => {
    await clearInstanceLogs(request.params.id);
    return response.status(204).end();
  }));

  return router;
}
