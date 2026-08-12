import { Router } from "express";

export function createUserRouter(controller) {
  const router = Router();
  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  return router;
}

