// Replaces window.fetch so the lessons' unmodified app.js files talk to the
// simulation instead of a Control Panel server and Docker containers.
//
// Two kinds of request are intercepted:
//   1. /api/lessons/<id>/...     the lesson lifecycle API (state, start, logs, ...)
//   2. http://localhost:<port>/  the address a lesson dials directly, which in the
//                                real project is a published container port
// Anything else falls through to the browser's real fetch untouched.
//
// This file is a classic script, so it runs before the lessons' deferred ES
// modules: by the time app.js executes, window.fetch is already the simulated one.
window.SiliconLanesSim = window.SiliconLanesSim || {};

(function (sim) {
  const realFetch = window.fetch.bind(window);

  const noContent = () => new Response(null, { status: 204, statusText: "No Content" });

  const failure = (message, status = 500) => sim.jsonResponse({ error: message }, {
    status,
    statusText: status === 404 ? "Not Found" : status === 409 ? "Conflict" : "Internal Server Error"
  });

  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    if (input && typeof input.url === "string") return input.url;
    return String(input);
  }

  function requestMethod(input, init) {
    const method = init?.method ?? (input && typeof input.method === "string" ? input.method : "GET");
    return method.toUpperCase();
  }

  async function handleLessonApi(lessonId, route, method) {
    const lesson = sim.lessons[lessonId];
    if (!lesson) return failure("API route not found.", 404);

    try {
      if (route === "/state" && method === "GET") return sim.jsonResponse(lesson.state());

      if (route === "/start" && method === "POST") {
        const state = await lesson.start();
        return sim.jsonResponse(state, { status: 201, statusText: "Created" });
      }

      if (route === "/stop" && method === "DELETE") {
        await lesson.stop();
        return noContent();
      }

      if (route === "/logs" && method === "GET") return sim.jsonResponse(lesson.logs());

      if (route === "/logs" && method === "DELETE") {
        lesson.clearLogs();
        return noContent();
      }

      // Lesson 2 returns the refreshed state; lesson 7's cache purge returns 204.
      if (route === "/cache" && method === "DELETE" && lesson.clearCache) {
        return sim.jsonResponse(lesson.clearCache());
      }

      const killMatch = route.match(/^\/services\/([^/]+)$/);
      if (killMatch && method === "DELETE" && lesson.killReplica) {
        return sim.jsonResponse(lesson.killReplica(decodeURIComponent(killMatch[1])));
      }
    } catch (error) {
      return failure(error.message ?? "Unexpected error.", error.statusCode ?? 500);
    }

    return failure("API route not found.", 404);
  }

  window.fetch = async function simulatedFetch(input, init) {
    const url = requestUrl(input);
    const method = requestMethod(input, init);

    const lessonApi = url.match(/\/api\/lessons\/(lesson-[^/?#]+)(\/[^?#]*)?/);
    if (lessonApi) {
      return handleLessonApi(lessonApi[1], lessonApi[2] ?? "", method);
    }

    // The Service Lab is not part of the static build; keep its probe from erroring.
    if (/\/api\/services(\?|$)/.test(url)) return sim.jsonResponse([]);

    // The query string is kept: lesson 6 varies ?connectionExperiment= to force a
    // new TCP connection, which is how its L4 edge balancer picks a gateway.
    const origin = url.match(/^https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)(\/[^#]*)?/i);
    if (origin) {
      const lesson = sim.origins[Number(origin[1])];
      // No simulated listener on that port behaves like a refused connection.
      if (!lesson) throw sim.connectionRefused();
      return lesson.origin(origin[2] ?? "/", method);
    }

    return realFetch(input, init);
  };

  sim.realFetch = realFetch;
}(window.SiliconLanesSim));
