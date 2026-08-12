export function createUserController(service) {
  return {
    list(_request, response, next) {
      try {
        response.json(service.listUsers());
      } catch (error) {
        next(error);
      }
    },

    get(request, response, next) {
      try {
        response.json(service.getUser(Number(request.params.id)));
      } catch (error) {
        next(error);
      }
    },

    create(request, response, next) {
      try {
        response.status(201).json(service.createUser(request.body));
      } catch (error) {
        next(error);
      }
    }
  };
}

