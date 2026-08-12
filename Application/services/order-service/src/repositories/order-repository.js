export class OrderRepository {
  constructor(database) {
    this.database = database;
  }

  list() {
    return this.database.prepare("SELECT * FROM orders ORDER BY id").all();
  }

  findById(id) {
    return this.database.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  }

  create({ userId, totalCents }) {
    const result = this.database
      .prepare("INSERT INTO orders (user_id, total_cents) VALUES (?, ?)")
      .run(userId, totalCents);
    return this.findById(result.lastInsertRowid);
  }
}

