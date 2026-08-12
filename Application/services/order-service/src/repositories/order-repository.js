export class OrderRepository {
  constructor(database) {
    this.database = database;
  }

  async list() {
    const result = await this.database.query("SELECT * FROM orders ORDER BY id");
    return result.rows;
  }

  async findById(id) {
    const result = await this.database.query("SELECT * FROM orders WHERE id = $1", [id]);
    return result.rows[0];
  }

  async create({ userId, totalCents }) {
    const result = await this.database.query(
      "INSERT INTO orders (user_id, total_cents) VALUES ($1, $2) RETURNING *",
      [userId, totalCents]
    );
    return result.rows[0];
  }
}

