export function createCartController(service) {
  return {
    async get(request, response, next) {
      try { response.json(await service.getCart(request.params.userId)); } catch (error) { next(error); }
    },
    async addItem(request, response, next) {
      try { response.status(201).json(await service.addItem(request.params.userId, request.body)); } catch (error) { next(error); }
    },
    async removeItem(request, response, next) {
      try {
        await service.removeItem(request.params.userId, request.params.productId);
        response.json({ removed: true });
      } catch (error) { next(error); }
    }
  };
}
