import express from "express";
import os from "node:os";
import { createPaymentRouter } from "./routes/payment-routes.js";

export function createApp({ controller, serviceName }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use((request, response, next) => {
    const startedAt = Date.now();
    console.log(`[${serviceName}] request received ${request.method} ${request.path} server=${os.hostname()}`);
    response.on("finish", () => console.log(`[${serviceName}] response sent ${response.statusCode} durationMs=${Date.now() - startedAt}`));
    next();
  });
  app.get("/health", (_request, response) => response.json({ status: "ok", serviceName, requestServer: os.hostname() }));
  app.use("/api/payments", createPaymentRouter(controller));
  app.use((_request, response) => response.status(404).json({ error: "Route not found" }));
  app.use((error, _request, response, _next) => {
    console.error(`[${serviceName}]`, error);
    response.status(error.statusCode ?? 500).json({ error: error.message });
  });
  return app;
}
