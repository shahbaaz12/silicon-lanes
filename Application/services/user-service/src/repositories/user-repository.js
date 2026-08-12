export class UserRepository {
  constructor(database) {
    this.database = database;
  }

  list() {
    return this.database.prepare("SELECT * FROM users ORDER BY id").all();
  }

  findById(id) {
    return this.database.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }

  create({ name, email }) {
    const result = this.database
      .prepare("INSERT INTO users (name, email) VALUES (?, ?)")
      .run(name, email);
    return this.findById(result.lastInsertRowid);
  }
}

