function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export class UserService {
  constructor(repository) {
    this.repository = repository;
  }

  listUsers() {
    return this.repository.list();
  }

  getUser(id) {
    const user = this.repository.findById(id);
    if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });
    return user;
  }

  createUser(input) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!name || !email) throw badRequest("name and email are required");

    try {
      return this.repository.create({ name, email });
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        throw Object.assign(new Error("Email already exists"), { statusCode: 409 });
      }
      throw error;
    }
  }
}

