import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  clearInstanceLogs,
  getInstanceLogs,
  listManagedInstances,
  startInstances,
  stopInstance,
  stopServiceInstances
} from "./docker-manager.js";
import { getService, serviceCatalog } from "./service-catalog.js";
import {
  clearDirectServiceLessonLogs,
  getDirectServiceLessonLogs,
  getDirectServiceLessonState,
  startDirectServiceLesson,
  stopDirectServiceLesson
} from "./lesson-manager.js";
import {
  clearReverseProxyLessonCache,
  clearReverseProxyLessonLogs,
  getReverseProxyLessonLogs,
  getReverseProxyLessonState,
  startReverseProxyLesson,
  stopReverseProxyLesson
} from "./reverse-proxy-lesson-manager.js";
import {
  clearL7LoadBalancerLessonLogs,
  getL7LoadBalancerLessonLogs,
  getL7LoadBalancerLessonState,
  killL7LoadBalancerBackend,
  startL7LoadBalancerLesson,
  stopL7LoadBalancerLesson
} from "./l7-load-balancer-lesson-manager.js";
import {
  clearApiGatewayLessonLogs,
  getApiGatewayLessonLogs,
  getApiGatewayLessonState,
  startApiGatewayLesson,
  stopApiGatewayLesson
} from "./api-gateway-lesson-manager.js";
import {
  clearHybridLessonLogs,
  getHybridLessonLogs,
  getHybridLessonState,
  startHybridLesson,
  stopHybridLesson
} from "./hybrid-lesson-manager.js";
import {
  clearAdvancedLessonLogs,
  getAdvancedLessonLogs,
  getAdvancedLessonState,
  startAdvancedLesson,
  stopAdvancedLesson
} from "./advanced-lesson-manager.js";
import {
  clearLocalCdnCache,
  clearLocalCdnLessonLogs,
  getLocalCdnLessonLogs,
  getLocalCdnLessonState,
  startLocalCdnLesson,
  stopLocalCdnLesson
} from "./local-cdn-lesson-manager.js";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = path.join(directory, "public");
const sharedLessonsDirectory = path.resolve(directory, "..", "Lessons", "shared");
const directServiceLessonDirectory = path.resolve(directory, "..", "Lessons", "lesson-01-direct-service", "public");
const reverseProxyLessonDirectory = path.resolve(directory, "..", "Lessons", "lesson-02-reverse-proxy", "public");
const l7LoadBalancerLessonDirectory = path.resolve(directory, "..", "Lessons", "lesson-03-l7-load-balancer", "public");
const apiGatewayLessonDirectory = path.resolve(directory, "..", "Lessons", "lesson-04-api-gateway", "public");
const hybridLessonDirectory = path.resolve(directory, "..", "Lessons", "lesson-05-hybrid", "public");
const advancedLessonDirectory = path.resolve(directory, "..", "Lessons", "lesson-06-advanced", "public");
const localCdnLessonDirectory = path.resolve(directory, "..", "Lessons", "lesson-07-local-cdn", "public");
const port = Number(process.env.PORT ?? 7012);
const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.use(express.static(publicDirectory));
app.use("/lessons/shared", express.static(sharedLessonsDirectory));
app.use("/lessons/lesson-01-direct-service", express.static(directServiceLessonDirectory));
app.use("/lessons/lesson-02-reverse-proxy", express.static(reverseProxyLessonDirectory));
app.use("/lessons/lesson-03-l7-load-balancer", express.static(l7LoadBalancerLessonDirectory));
app.use("/lessons/lesson-04-api-gateway", express.static(apiGatewayLessonDirectory));
app.use("/lessons/lesson-05-hybrid", express.static(hybridLessonDirectory));
app.use("/lessons/lesson-06-advanced", express.static(advancedLessonDirectory));
app.use("/lessons/lesson-07-local-cdn", express.static(localCdnLessonDirectory));

app.get("/api/services", async (_request, response, next) => {
  try {
    const instances = await listManagedInstances();
    response.json(Object.values(serviceCatalog).map((service) => ({
      ...service,
      instances: instances.filter((instance) => instance.serviceKey === service.key)
    })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/services/:key/instances", async (request, response, next) => {
  try {
    const service = getService(request.params.key);
    if (!service) return response.status(404).json({ error: "Service not found." });
    const count = Number(request.body.count ?? 1);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return response.status(400).json({ error: "count must be an integer from 1 to 10." });
    }
    response.status(201).json(await startInstances(service, count));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/services/:key/instances", async (request, response, next) => {
  try {
    const service = getService(request.params.key);
    if (!service) return response.status(404).json({ error: "Service not found." });
    response.json({ stopped: await stopServiceInstances(service.key) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/instances/:id", async (request, response, next) => {
  try {
    await stopInstance(request.params.id);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/instances/:id/logs", async (request, response, next) => {
  try {
    response.json({ logs: await getInstanceLogs(request.params.id) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/instances/:id/logs", async (request, response, next) => {
  try {
    await clearInstanceLogs(request.params.id);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/lessons/lesson-01-direct-service/state", async (_request, response, next) => {
  try {
    response.json(await getDirectServiceLessonState());
  } catch (error) {
    next(error);
  }
});

app.post("/api/lessons/lesson-01-direct-service/catalog/start", async (_request, response, next) => {
  try {
    response.status(201).json(await startDirectServiceLesson());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lessons/lesson-01-direct-service/catalog/stop", async (_request, response, next) => {
  try {
    await stopDirectServiceLesson();
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/lessons/lesson-01-direct-service/catalog/logs", async (_request, response, next) => {
  try {
    response.json({ logs: await getDirectServiceLessonLogs() });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lessons/lesson-01-direct-service/catalog/logs", async (_request, response, next) => {
  try {
    await clearDirectServiceLessonLogs();
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/lessons/lesson-02-reverse-proxy/state", async (_request, response, next) => {
  try {
    response.json(await getReverseProxyLessonState());
  } catch (error) {
    next(error);
  }
});

app.post("/api/lessons/lesson-02-reverse-proxy/start", async (_request, response, next) => {
  try {
    response.status(201).json(await startReverseProxyLesson());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lessons/lesson-02-reverse-proxy/stop", async (_request, response, next) => {
  try {
    await stopReverseProxyLesson();
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/lessons/lesson-02-reverse-proxy/logs", async (_request, response, next) => {
  try {
    response.json(await getReverseProxyLessonLogs());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lessons/lesson-02-reverse-proxy/logs", async (_request, response, next) => {
  try {
    await clearReverseProxyLessonLogs();
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lessons/lesson-02-reverse-proxy/cache", async (_request, response, next) => {
  try {
    response.json(await clearReverseProxyLessonCache());
  } catch (error) {
    next(error);
  }
});

app.get("/api/lessons/lesson-03-l7-load-balancer/state", async (_request, response, next) => {
  try {
    response.json(await getL7LoadBalancerLessonState());
  } catch (error) {
    next(error);
  }
});

app.post("/api/lessons/lesson-03-l7-load-balancer/start", async (_request, response, next) => {
  try {
    response.status(201).json(await startL7LoadBalancerLesson());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lessons/lesson-03-l7-load-balancer/stop", async (_request, response, next) => {
  try {
    await stopL7LoadBalancerLesson();
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lessons/lesson-03-l7-load-balancer/services/:id", async (request, response, next) => {
  try {
    response.json(await killL7LoadBalancerBackend(request.params.id));
  } catch (error) {
    next(error);
  }
});

app.get("/api/lessons/lesson-03-l7-load-balancer/logs", async (_request, response, next) => {
  try {
    response.json(await getL7LoadBalancerLessonLogs());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lessons/lesson-03-l7-load-balancer/logs", async (_request, response, next) => {
  try {
    await clearL7LoadBalancerLessonLogs();
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/lessons/lesson-04-api-gateway/state", async (_request, response, next) => {
  try {
    response.json(await getApiGatewayLessonState());
  } catch (error) {
    next(error);
  }
});

app.post("/api/lessons/lesson-04-api-gateway/start", async (_request, response, next) => {
  try {
    response.status(201).json(await startApiGatewayLesson());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lessons/lesson-04-api-gateway/stop", async (_request, response, next) => {
  try {
    await stopApiGatewayLesson();
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/lessons/lesson-04-api-gateway/logs", async (_request, response, next) => {
  try {
    response.json(await getApiGatewayLessonLogs());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/lessons/lesson-04-api-gateway/logs", async (_request, response, next) => {
  try {
    await clearApiGatewayLessonLogs();
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/lessons/lesson-05-hybrid/state", async (_request, response, next) => {
  try { response.json(await getHybridLessonState()); } catch (error) { next(error); }
});

app.post("/api/lessons/lesson-05-hybrid/start", async (_request, response, next) => {
  try { response.status(201).json(await startHybridLesson()); } catch (error) { next(error); }
});

app.delete("/api/lessons/lesson-05-hybrid/stop", async (_request, response, next) => {
  try { await stopHybridLesson(); response.status(204).end(); } catch (error) { next(error); }
});

app.get("/api/lessons/lesson-05-hybrid/logs", async (_request, response, next) => {
  try { response.json(await getHybridLessonLogs()); } catch (error) { next(error); }
});

app.delete("/api/lessons/lesson-05-hybrid/logs", async (_request, response, next) => {
  try { await clearHybridLessonLogs(); response.status(204).end(); } catch (error) { next(error); }
});

app.get("/api/lessons/lesson-06-advanced/state", async (_request, response, next) => {
  try { response.json(await getAdvancedLessonState()); } catch (error) { next(error); }
});

app.post("/api/lessons/lesson-06-advanced/start", async (_request, response, next) => {
  try { response.status(201).json(await startAdvancedLesson()); } catch (error) { next(error); }
});

app.delete("/api/lessons/lesson-06-advanced/stop", async (_request, response, next) => {
  try { await stopAdvancedLesson(); response.status(204).end(); } catch (error) { next(error); }
});

app.get("/api/lessons/lesson-06-advanced/logs", async (_request, response, next) => {
  try { response.json(await getAdvancedLessonLogs()); } catch (error) { next(error); }
});

app.delete("/api/lessons/lesson-06-advanced/logs", async (_request, response, next) => {
  try { await clearAdvancedLessonLogs(); response.status(204).end(); } catch (error) { next(error); }
});

app.get("/api/lessons/lesson-07-local-cdn/state", async (_request, response, next) => {
  try { response.json(await getLocalCdnLessonState()); } catch (error) { next(error); }
});

app.post("/api/lessons/lesson-07-local-cdn/start", async (_request, response, next) => {
  try { response.status(201).json(await startLocalCdnLesson()); } catch (error) { next(error); }
});

app.delete("/api/lessons/lesson-07-local-cdn/stop", async (_request, response, next) => {
  try { await stopLocalCdnLesson(); response.status(204).end(); } catch (error) { next(error); }
});

app.get("/api/lessons/lesson-07-local-cdn/logs", async (_request, response, next) => {
  try { response.json(await getLocalCdnLessonLogs()); } catch (error) { next(error); }
});

app.delete("/api/lessons/lesson-07-local-cdn/logs", async (_request, response, next) => {
  try { await clearLocalCdnLessonLogs(); response.status(204).end(); } catch (error) { next(error); }
});

app.delete("/api/lessons/lesson-07-local-cdn/cache", async (_request, response, next) => {
  try { await clearLocalCdnCache(); response.status(204).end(); } catch (error) { next(error); }
});

app.get("/services/:key", (request, response, next) => {
  if (!getService(request.params.key)) return next();
  response.sendFile(path.join(publicDirectory, "details.html"));
});

app.use("/api", (_request, response) => response.status(404).json({ error: "API route not found." }));
app.use((_request, response) => response.status(404).sendFile(path.join(publicDirectory, "404.html")));
app.use((error, _request, response, _next) => {
  console.error("[control-panel]", error);
  response.status(error.statusCode ?? 500).json({ error: error.message ?? "Unexpected error." });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`[control-panel] Open http://localhost:${port}`);
});
