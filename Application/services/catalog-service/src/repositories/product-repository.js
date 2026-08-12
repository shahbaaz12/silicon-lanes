export class ProductRepository {
  constructor(database) {
    this.database = database;
  }

  async list() {
    const result = await this.database.query("SELECT * FROM products ORDER BY id");
    return result.rows;
  }

  async findById(id) {
    const result = await this.database.query("SELECT * FROM products WHERE id = $1", [id]);
    return result.rows[0];
  }

  async create({ name, description, priceCents }) {
    const result = await this.database.query(
      "INSERT INTO products (name, description, price_cents) VALUES ($1, $2, $3) RETURNING *",
      [name, description, priceCents]
    );
    return result.rows[0];
  }
}

