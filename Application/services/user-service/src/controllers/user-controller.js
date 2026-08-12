export function createUserController(service) {
  return {
    async list(_request, response, next) {
      try {
        response.json(await service.listUsers());
      } catch (error) {
        next(error);
      }
    },

    async get(request, response, next) {
      try {
        response.json(await service.getUser(Number(request.params.id)));
      } catch (error) {
        next(error);
      }
    },

    async create(request, response, next) {
      try {
        response.status(201).json(await service.createUser(request.body));
      } catch (error) {
        next(error);
      }
    }
  };
}
