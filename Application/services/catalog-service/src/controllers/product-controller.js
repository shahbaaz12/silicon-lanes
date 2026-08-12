export function createProductController(service) {
  return {
    list(_request, response, next) {
      try { response.json(service.listProducts()); } catch (error) { next(error); }
    },
    get(request, response, next) {
      try { response.json(service.getProduct(Number(request.params.id))); } catch (error) { next(error); }
    },
    create(request, response, next) {
      try { response.status(201).json(service.createProduct(request.body)); } catch (error) { next(error); }
    }
  };
}

