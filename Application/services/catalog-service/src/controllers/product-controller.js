export function createProductController(service) {
  return {
    async list(_request, response, next) {
      try { response.json(await service.listProducts()); } catch (error) { next(error); }
    },
    async get(request, response, next) {
      try { response.json(await service.getProduct(Number(request.params.id))); } catch (error) { next(error); }
    },
    async create(request, response, next) {
      try { response.status(201).json(await service.createProduct(request.body)); } catch (error) { next(error); }
    }
  };
}
