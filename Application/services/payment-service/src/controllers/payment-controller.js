export function createPaymentController(service) {
  return {
    async list(_request, response, next) {
      try { response.json(await service.listPayments()); } catch (error) { next(error); }
    },
    async get(request, response, next) {
      try { response.json(await service.getPayment(request.params.id)); } catch (error) { next(error); }
    },
    async create(request, response, next) {
      try { response.status(201).json(await service.createPayment(request.body)); } catch (error) { next(error); }
    }
  };
}
