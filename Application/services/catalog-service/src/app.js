import express from "express";
import os from "node:os";
import { createProductRouter } from "./routes/product-routes.js";

export function createApp({ controller, serviceName }) {
  const app = express();
  const requestServer = process.env.INSTANCE_NAME ?? os.hostname();
  const lessonOrigins = new Set([
    "http://localhost:7012",
    "http://127.0.0.1:7012"
  ]);
  app.disable("x-powered-by");
  app.use(express.json());
  app.use((request, response, next) => {
    response.set("x-service-name", serviceName);
    response.set("x-request-server", requestServer);
    const origin = request.get("origin");
    if (lessonOrigins.has(origin)) {
      response.set("access-control-allow-origin", origin);
      response.set("access-control-expose-headers", "x-service-name, x-request-server");
      response.vary("origin");
    }
    next();
  });
  app.use((request, _response, next) => {
    if (request.get("x-silicon-lanes-probe") !== "docker") {
      console.log(`[request] ${new Date().toISOString()} ${request.method} ${request.originalUrl}`);
    }
    next();
  });
  app.get("/health", (_request, response) => response.json({ status: "ok", serviceName, requestServer }));
  app.use("/api/products", createProductRouter(controller));
  app.use((_request, response) => response.status(404).json({ error: "Route not found" }));
  app.use((error, _request, response, _next) => {
    console.error(`[${serviceName}]`, error);
    response.status(error.statusCode ?? 500).json({ error: error.message });
  });
  return app;
}
