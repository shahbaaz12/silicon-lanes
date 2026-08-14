import { Router } from "express";
import { lessonRegistry } from "../lessons/registry.js";
import { asyncHandler } from "./async-handler.js";

export function createLessonRouter(registry = lessonRegistry) {
  const router = Router();

  for (const lesson of registry) {
    for (const route of lesson.routes) {
      router[route.method](`/${lesson.id}${route.path}`, asyncHandler(async (request, response) => {
        const result = await route.run({ request, response });
        if (route.empty) return response.status(route.status).end();
        return response.status(route.status).json(route.transform(result));
      }));
    }
  }

  return router;
}
