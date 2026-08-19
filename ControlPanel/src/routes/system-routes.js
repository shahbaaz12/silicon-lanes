import { Router } from "express";
import { stopServiceInstances } from "../docker-manager.js";
import { friendlyDockerError, listContainersByLabel, removeContainersByLabel } from "../infrastructure/docker-client.js";
import { serviceCatalog } from "../service-catalog.js";
import { asyncHandler } from "./async-handler.js";

export function createSystemRouter({
  removeLessonContainers = () => removeContainersByLabel("com.silicon-lanes.lesson"),
  listLessonContainers = () => listContainersByLabel("com.silicon-lanes.lesson"),
  listServiceContainers = () => listContainersByLabel("com.silicon-lanes.managed=true"),
  services = Object.values(serviceCatalog),
  stopService = stopServiceInstances
} = {}) {
  const router = Router();

  // Read-only preview so the interface can name exactly what a global stop would remove
  // before asking the user to confirm it. Both label filters are the same ones the DELETE
  // below uses, so the preview cannot disagree with what actually happens.
  router.get("/system", asyncHandler(async (_request, response) => {
    try {
      const [lessons, servicesRunning] = await Promise.all([listLessonContainers(), listServiceContainers()]);
      response.json({
        containers: [
          ...lessons.map((container) => ({ ...container, kind: "lesson" })),
          ...servicesRunning.map((container) => ({ ...container, kind: "service" }))
        ]
      });
    } catch (error) {
      if (error.statusCode) throw error;
      throw friendlyDockerError(error);
    }
  }));

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
