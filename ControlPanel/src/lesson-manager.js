import {
  clearInstanceLogs,
  getInstanceLogs,
  listManagedInstances,
  startInstances,
  stopInstance
} from "./docker-manager.js";
import { serviceCatalog } from "./service-catalog.js";

const catalog = serviceCatalog.catalog;
let lessonInstanceId;
let lessonOwnsInstance = false;

async function catalogInstances() {
  return (await listManagedInstances()).filter((instance) => instance.serviceKey === catalog.key);
}

async function currentInstance() {
  if (!lessonInstanceId) return null;
  const instance = (await catalogInstances()).find((candidate) => candidate.id === lessonInstanceId);
  if (!instance) {
    lessonInstanceId = undefined;
    lessonOwnsInstance = false;
  }
  return instance ?? null;
}

function serializeState(instance) {
  return {
    running: Boolean(instance),
    ownedByLesson: Boolean(instance && lessonOwnsInstance),
    instance: instance ? {
      id: instance.id,
      name: instance.name,
      hostPort: instance.hostPort,
      containerPort: instance.containerPort,
      directUrl: `http://localhost:${instance.hostPort}/api/products`
    } : null
  };
}

export async function getDirectServiceLessonState() {
  return serializeState(await currentInstance());
}

export async function startDirectServiceLesson() {
  let instance = await currentInstance();
  if (!instance) {
    const existing = await catalogInstances();
    if (existing.length > 0) {
      [instance] = existing;
      lessonOwnsInstance = false;
    } else {
      [instance] = await startInstances(catalog, 1);
      lessonOwnsInstance = true;
    }
    lessonInstanceId = instance.id;
    await clearInstanceLogs(instance.id);
  }
  return serializeState(instance);
}

export async function stopDirectServiceLesson() {
  const instance = await currentInstance();
  if (!instance) return;
  if (!lessonOwnsInstance) {
    throw Object.assign(new Error(
      "This Catalog Service was already running, so the lesson will not remove it. Stop it from the service detail page."
    ), { statusCode: 409 });
  }
  await stopInstance(instance.id);
  lessonInstanceId = undefined;
  lessonOwnsInstance = false;
}

export async function getDirectServiceLessonLogs() {
  const instance = await currentInstance();
  return instance ? getInstanceLogs(instance.id) : "Start the service to see its request log.";
}

export async function clearDirectServiceLessonLogs() {
  const instance = await currentInstance();
  if (instance) await clearInstanceLogs(instance.id);
}
