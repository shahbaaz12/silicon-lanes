export class PaymentRepository {
  constructor(database) {
    this.database = database;
  }

  async list() {
    const result = await this.database.query("SELECT * FROM payments ORDER BY id");
    return result.rows;
  }

  async findById(id) {
    const result = await this.database.query("SELECT * FROM payments WHERE id = $1", [id]);
    return result.rows[0];
  }

  async create({ orderId, amountCents }) {
    const result = await this.database.query(
      "INSERT INTO payments (order_id, amount_cents) VALUES ($1, $2) RETURNING *",
      [orderId, amountCents]
    );
    return result.rows[0];
  }
}

