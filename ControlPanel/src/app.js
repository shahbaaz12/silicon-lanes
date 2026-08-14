import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { lessonRegistry } from "./lessons/registry.js";
import { createLessonRouter } from "./routes/lesson-routes.js";
import { createServiceRouter } from "./routes/service-routes.js";
import { getService } from "./service-catalog.js";

const controlPanelDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = path.join(controlPanelDirectory, "public");
const lessonsDirectory = path.resolve(controlPanelDirectory, "..", "Lessons");

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());
  app.use(express.static(publicDirectory));
  app.use("/lessons/shared", express.static(path.join(lessonsDirectory, "shared")));

  for (const lesson of lessonRegistry) {
    app.use(`/lessons/${lesson.id}`, express.static(path.join(lessonsDirectory, lesson.id, "public")));
  }

  app.use("/api", createServiceRouter());
  app.use("/api/lessons", createLessonRouter());

  app.get("/services/:key", (request, response, next) => {
    if (!getService(request.params.key)) return next();
    return response.sendFile(path.join(publicDirectory, "details.html"));
  });

  app.use("/api", (_request, response) => response.status(404).json({ error: "API route not found." }));
  app.use((_request, response) => response.status(404).sendFile(path.join(publicDirectory, "404.html")));
  app.use((error, _request, response, _next) => {
    console.error("[control-panel]", error);
    response.status(error.statusCode ?? 500).json({ error: error.message ?? "Unexpected error." });
  });

  return app;
}
