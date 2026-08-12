export function createCartController(service) {
  return {
    get(request, response, next) {
      try { response.json(service.getCart(request.params.userId)); } catch (error) { next(error); }
    },
    addItem(request, response, next) {
      try { response.status(201).json(service.addItem(request.params.userId, request.body)); } catch (error) { next(error); }
    },
    removeItem(request, response, next) {
      try {
        service.removeItem(request.params.userId, request.params.productId);
        response.status(204).end();
      } catch (error) { next(error); }
    }
  };
}

