function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export class UserService {
  constructor(repository) {
    this.repository = repository;
  }

  async listUsers() {
    return this.repository.list();
  }

  async getUser(id) {
    const user = await this.repository.findById(id);
    if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });
    return user;
  }

  async createUser(input) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!name || !email) throw badRequest("name and email are required");

    try {
      return await this.repository.create({ name, email });
    } catch (error) {
      if (error.code === "23505") {
        throw Object.assign(new Error("Email already exists"), { statusCode: 409 });
      }
      throw error;
    }
  }
}
