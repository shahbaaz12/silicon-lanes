import { Router } from "express";

export function createInventoryRouter(controller) {
  const router = Router();
  router.get("/", controller.list);
  router.get("/:productId", controller.get);
  router.put("/", controller.set);
  return router;
}

