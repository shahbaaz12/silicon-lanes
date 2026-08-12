import { Router } from "express";

export function createOrderRouter(controller) {
  const router = Router();
  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  return router;
}

