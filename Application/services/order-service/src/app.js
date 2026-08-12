import express from "express";
import { createOrderRouter } from "./routes/order-routes.js";

export function createApp({ controller, serviceName }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.get("/health", (_request, response) => response.json({ service: serviceName, status: "ok" }));
  app.use("/api/orders", createOrderRouter(controller));
  app.use((_request, response) => response.status(404).json({ error: "Route not found" }));
  app.use((error, _request, response, _next) => {
    console.error(`[${serviceName}]`, error);
    response.status(error.statusCode ?? 500).json({ error: error.message });
  });
  return app;
}

