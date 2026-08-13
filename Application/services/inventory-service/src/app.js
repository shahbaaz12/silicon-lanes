import express from "express";
import { createInventoryRouter } from "./routes/inventory-routes.js";
import { standardResponse } from "./middleware/standard-response.js";

export function createApp({ controller, serviceName }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use(standardResponse(serviceName));
  app.use((request, _response, next) => {
    if (request.get("x-silicon-lanes-probe") !== "docker") {
      console.log(`[request] ${new Date().toISOString()} ${request.method} ${request.originalUrl}`);
    }
    next();
  });
  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.use("/api/inventory", createInventoryRouter(controller));
  app.use((_request, response) => response.status(404).json({ error: "Route not found" }));
  app.use((error, _request, response, _next) => {
    console.error(`[${serviceName}]`, error);
    response.status(error.statusCode ?? 500).json({ error: error.message });
  });
  return app;
}
