import assert from "node:assert/strict";
import test from "node:test";
import { friendlyDockerError, idsFromLabel } from "../src/infrastructure/docker-client.js";
import { ensureServicePool } from "../src/infrastructure/service-pool.js";

test("Docker helpers parse labels and translate daemon connection failures", () => {
  const container = { Config: { Labels: { backends: "one,two" } } };
  assert.deepEqual(idsFromLabel(container, "backends"), ["one", "two"]);
  assert.deepEqual(idsFromLabel(container, "missing"), []);

  const error = friendlyDockerError({ stderr: "Cannot connect to the Docker daemon" });
  assert.equal(error.statusCode, 503);
  assert.equal(error.message, "Docker Desktop is not running.");
});

test("service pools prefer previous instances and start only the missing capacity", async () => {
  const catalog = { key: "catalog" };
  const user = { key: "user" };
  const available = [
    { id: "catalog-old", serviceKey: "catalog" },
    { id: "catalog-preferred", serviceKey: "catalog" },
    { id: "user-existing", serviceKey: "user" }
  ];
  const starts = [];

  const result = await ensureServicePool({
    requirements: [{ service: catalog, count: 3 }, { service: user, count: 1 }],
    previousIds: ["catalog-preferred"],
    previouslyOwnedIds: ["catalog-preferred"],
    listInstances: async () => available,
    startInstances: async (service, count) => {
      starts.push({ service: service.key, count });
      return Array.from({ length: count }, (_, index) => ({ id: `${service.key}-new-${index}`, serviceKey: service.key }));
    }
  });

  assert.deepEqual(starts, [{ service: "catalog", count: 1 }]);
  assert.deepEqual(result.services.map(({ id }) => id), [
    "catalog-preferred",
    "catalog-old",
    "catalog-new-0",
    "user-existing"
  ]);
  assert.deepEqual(result.ownedIds, ["catalog-preferred", "catalog-new-0"]);
});
