import express from "express";
import os from "node:os";
import { createInventoryRouter } from "./routes/inventory-routes.js";

export function createApp({ controller, serviceName }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use((request, _response, next) => {
    console.log(`[request] ${new Date().toISOString()} ${request.method} ${request.originalUrl}`);
    next();
  });
  app.get("/health", (_request, response) => response.json({ status: "ok", serviceName, requestServer: process.env.INSTANCE_NAME ?? os.hostname() }));
  app.use("/api/inventory", createInventoryRouter(controller));
  app.use((_request, response) => response.status(404).json({ error: "Route not found" }));
  app.use((error, _request, response, _next) => {
    console.error(`[${serviceName}]`, error);
    response.status(error.statusCode ?? 500).json({ error: error.message });
  });
  return app;
}
