import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createSystemRouter } from "../src/routes/system-routes.js";

test("global kill removes lesson infrastructure before every managed service", async () => {
  const calls = [];
  const app = express();
  app.use("/api", createSystemRouter({
    removeLessonContainers: async () => {
      calls.push("lessons");
      return ["proxy-1", "gateway-1"];
    },
    services: [{ key: "user" }, { key: "catalog" }],
    stopService: async (key) => {
      calls.push(key);
      return [`${key}-1`];
    }
  }));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/system`, { method: "DELETE" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      stopped: ["proxy-1", "gateway-1", "user-1", "catalog-1"]
    });
    assert.deepEqual(calls, ["lessons", "user", "catalog"]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
