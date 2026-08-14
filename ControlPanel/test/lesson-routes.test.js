import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createLessonRouter } from "../src/routes/lesson-routes.js";

async function withServer(registry, run) {
  const app = express();
  app.use("/api/lessons", createLessonRouter(registry));
  app.use((error, _request, response, _next) => {
    response.status(error.statusCode ?? 500).json({ error: error.message });
  });

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("lesson routes preserve status, JSON transforms, parameters, and empty responses", async () => {
  const registry = [{
    id: "example",
    routes: [
      { method: "get", path: "/state", status: 200, run: async () => ({ ready: true }), transform: (value) => value },
      { method: "post", path: "/start", status: 201, run: async () => ({ started: true }), transform: (value) => value },
      { method: "delete", path: "/services/:id", status: 200, run: async ({ request }) => ({ id: request.params.id }), transform: (value) => value },
      { method: "delete", path: "/stop", status: 204, empty: true, run: async () => undefined }
    ]
  }];

  await withServer(registry, async (baseUrl) => {
    const state = await fetch(`${baseUrl}/api/lessons/example/state`);
    assert.equal(state.status, 200);
    assert.deepEqual(await state.json(), { ready: true });

    const start = await fetch(`${baseUrl}/api/lessons/example/start`, { method: "POST" });
    assert.equal(start.status, 201);
    assert.deepEqual(await start.json(), { started: true });

    const remove = await fetch(`${baseUrl}/api/lessons/example/services/backend-1`, { method: "DELETE" });
    assert.deepEqual(await remove.json(), { id: "backend-1" });

    const stop = await fetch(`${baseUrl}/api/lessons/example/stop`, { method: "DELETE" });
    assert.equal(stop.status, 204);
    assert.equal(await stop.text(), "");
  });
});

test("lesson route errors reach the application error handler", async () => {
  const expected = Object.assign(new Error("Port is busy."), { statusCode: 409 });
  const registry = [{
    id: "example",
    routes: [{ method: "post", path: "/start", status: 201, run: async () => { throw expected; }, transform: (value) => value }]
  }];

  await withServer(registry, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/lessons/example/start`, { method: "POST" });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "Port is busy." });
  });
});
