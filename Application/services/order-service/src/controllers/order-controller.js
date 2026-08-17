export function createOrderController(service) {
  return {
    async list(_request, response, next) {
      try { response.json(await service.listOrders()); } catch (error) { next(error); }
    },
    async get(request, response, next) {
      try { response.json(await service.getOrder(request.params.id)); } catch (error) { next(error); }
    },
    async create(request, response, next) {
      try { response.status(201).json(await service.createOrder(request.body)); } catch (error) { next(error); }
    }
  };
}
