export function createInventoryController(service) {
  return {
    async list(_request, response, next) {
      try { response.json(await service.listInventory()); } catch (error) { next(error); }
    },
    async get(request, response, next) {
      try { response.json(await service.getInventory(Number(request.params.productId))); } catch (error) { next(error); }
    },
    async set(request, response, next) {
      try { response.json(await service.setInventory(request.body)); } catch (error) { next(error); }
    }
  };
}
