import { Router } from "express";
import { stopServiceInstances } from "../docker-manager.js";
import { friendlyDockerError, removeContainersByLabel } from "../infrastructure/docker-client.js";
import { serviceCatalog } from "../service-catalog.js";
import { asyncHandler } from "./async-handler.js";

export function createSystemRouter({
  removeLessonContainers = () => removeContainersByLabel("com.silicon-lanes.lesson"),
  services = Object.values(serviceCatalog),
  stopService = stopServiceInstances
} = {}) {
  const router = Router();

  router.delete("/system", asyncHandler(async (_request, response) => {
    try {
      const stopped = await removeLessonContainers();
      for (const service of services) {
        stopped.push(...await stopService(service.key));
      }
      response.json({ stopped });
    } catch (error) {
      if (error.statusCode) throw error;
      throw friendlyDockerError(error);
    }
  }));

  return router;
}
