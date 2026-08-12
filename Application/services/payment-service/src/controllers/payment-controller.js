export function createPaymentController(service) {
  return {
    list(_request, response, next) {
      try { response.json(service.listPayments()); } catch (error) { next(error); }
    },
    get(request, response, next) {
      try { response.json(service.getPayment(Number(request.params.id))); } catch (error) { next(error); }
    },
    create(request, response, next) {
      try { response.status(201).json(service.createPayment(request.body)); } catch (error) { next(error); }
    }
  };
}

