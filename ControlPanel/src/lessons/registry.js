import {
  clearDirectServiceLessonLogs,
  getDirectServiceLessonLogs,
  getDirectServiceLessonState,
  startDirectServiceLesson,
  stopDirectServiceLesson
} from "../lesson-manager.js";
import {
  clearReverseProxyLessonCache,
  clearReverseProxyLessonLogs,
  getReverseProxyLessonLogs,
  getReverseProxyLessonState,
  startReverseProxyLesson,
  stopReverseProxyLesson
} from "../reverse-proxy-lesson-manager.js";
import {
  clearL7LoadBalancerLessonLogs,
  getL7LoadBalancerLessonLogs,
  getL7LoadBalancerLessonState,
  killL7LoadBalancerBackend,
  startL7LoadBalancerLesson,
  stopL7LoadBalancerLesson
} from "../l7-load-balancer-lesson-manager.js";
import {
  clearApiGatewayLessonLogs,
  getApiGatewayLessonLogs,
  getApiGatewayLessonState,
  startApiGatewayLesson,
  stopApiGatewayLesson
} from "../api-gateway-lesson-manager.js";
import {
  clearHybridLessonLogs,
  getHybridLessonLogs,
  getHybridLessonState,
  startHybridLesson,
  stopHybridLesson
} from "../hybrid-lesson-manager.js";
import {
  clearAdvancedLessonLogs,
  getAdvancedLessonLogs,
  getAdvancedLessonState,
  startAdvancedLesson,
  stopAdvancedLesson
} from "../advanced-lesson-manager.js";
import {
  clearLocalCdnCache,
  clearLocalCdnLessonLogs,
  getLocalCdnLessonLogs,
  getLocalCdnLessonState,
  startLocalCdnLesson,
  stopLocalCdnLesson
} from "../local-cdn-lesson-manager.js";

function jsonRoute(method, path, run, status = 200, transform = (value) => value) {
  return { method, path, run, status, transform };
}

function emptyRoute(method, path, run) {
  return { method, path, run, status: 204, empty: true };
}

function standardLesson({ id, state, start, stop, logs, clearLogs, extraRoutes = [] }) {
  return {
    id,
    routes: [
      jsonRoute("get", "/state", state),
      jsonRoute("post", "/start", start, 201),
      emptyRoute("delete", "/stop", stop),
      jsonRoute("get", "/logs", logs),
      emptyRoute("delete", "/logs", clearLogs),
      ...extraRoutes
    ]
  };
}

export const lessonRegistry = Object.freeze([
  {
    id: "lesson-01-direct-service",
    routes: [
      jsonRoute("get", "/state", getDirectServiceLessonState),
      jsonRoute("post", "/catalog/start", startDirectServiceLesson, 201),
      emptyRoute("delete", "/catalog/stop", stopDirectServiceLesson),
      jsonRoute("get", "/catalog/logs", getDirectServiceLessonLogs, 200, (logs) => ({ logs })),
      emptyRoute("delete", "/catalog/logs", clearDirectServiceLessonLogs)
    ]
  },
  standardLesson({
    id: "lesson-02-reverse-proxy",
    state: getReverseProxyLessonState,
    start: startReverseProxyLesson,
    stop: stopReverseProxyLesson,
    logs: getReverseProxyLessonLogs,
    clearLogs: clearReverseProxyLessonLogs,
    extraRoutes: [jsonRoute("delete", "/cache", clearReverseProxyLessonCache)]
  }),
  standardLesson({
    id: "lesson-03-l7-load-balancer",
    state: getL7LoadBalancerLessonState,
    start: startL7LoadBalancerLesson,
    stop: stopL7LoadBalancerLesson,
    logs: getL7LoadBalancerLessonLogs,
    clearLogs: clearL7LoadBalancerLessonLogs,
    extraRoutes: [
      jsonRoute("delete", "/services/:id", ({ request }) => killL7LoadBalancerBackend(request.params.id))
    ]
  }),
  standardLesson({
    id: "lesson-04-api-gateway",
    state: getApiGatewayLessonState,
    start: startApiGatewayLesson,
    stop: stopApiGatewayLesson,
    logs: getApiGatewayLessonLogs,
    clearLogs: clearApiGatewayLessonLogs
  }),
  standardLesson({
    id: "lesson-05-hybrid",
    state: getHybridLessonState,
    start: startHybridLesson,
    stop: stopHybridLesson,
    logs: getHybridLessonLogs,
    clearLogs: clearHybridLessonLogs
  }),
  standardLesson({
    id: "lesson-06-advanced",
    state: getAdvancedLessonState,
    start: startAdvancedLesson,
    stop: stopAdvancedLesson,
    logs: getAdvancedLessonLogs,
    clearLogs: clearAdvancedLessonLogs
  }),
  standardLesson({
    id: "lesson-07-local-cdn",
    state: getLocalCdnLessonState,
    start: startLocalCdnLesson,
    stop: stopLocalCdnLesson,
    logs: getLocalCdnLessonLogs,
    clearLogs: clearLocalCdnLessonLogs,
    extraRoutes: [emptyRoute("delete", "/cache", clearLocalCdnCache)]
  })
]);
