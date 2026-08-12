import { Router } from "express";

export function createCartRouter(controller) {
  const router = Router();
  router.get("/:userId", controller.get);
  router.post("/:userId/items", controller.addItem);
  router.delete("/:userId/items/:productId", controller.removeItem);
  return router;
}

