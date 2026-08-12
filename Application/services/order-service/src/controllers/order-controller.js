export function createOrderController(service) {
  return {
    list(_request, response, next) {
      try { response.json(service.listOrders()); } catch (error) { next(error); }
    },
    get(request, response, next) {
      try { response.json(service.getOrder(Number(request.params.id))); } catch (error) { next(error); }
    },
    create(request, response, next) {
      try { response.status(201).json(service.createOrder(request.body)); } catch (error) { next(error); }
    }
  };
}

