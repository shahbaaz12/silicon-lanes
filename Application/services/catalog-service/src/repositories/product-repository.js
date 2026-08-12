export class ProductRepository {
  constructor(database) {
    this.database = database;
  }

  list() {
    return this.database.prepare("SELECT * FROM products ORDER BY id").all();
  }

  findById(id) {
    return this.database.prepare("SELECT * FROM products WHERE id = ?").get(id);
  }

  create({ name, description, priceCents }) {
    const result = this.database
      .prepare("INSERT INTO products (name, description, price_cents) VALUES (?, ?, ?)")
      .run(name, description, priceCents);
    return this.findById(result.lastInsertRowid);
  }
}

