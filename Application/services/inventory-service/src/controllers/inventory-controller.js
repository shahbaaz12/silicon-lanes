export function createInventoryController(service) {
  return {
    list(_request, response, next) {
      try { response.json(service.listInventory()); } catch (error) { next(error); }
    },
    get(request, response, next) {
      try { response.json(service.getInventory(Number(request.params.productId))); } catch (error) { next(error); }
    },
    set(request, response, next) {
      try { response.json(service.setInventory(request.body)); } catch (error) { next(error); }
    }
  };
}

