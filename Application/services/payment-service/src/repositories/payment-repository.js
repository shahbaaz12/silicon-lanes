export class PaymentRepository {
  constructor(database) {
    this.database = database;
  }

  list() {
    return this.database.prepare("SELECT * FROM payments ORDER BY id").all();
  }

  findById(id) {
    return this.database.prepare("SELECT * FROM payments WHERE id = ?").get(id);
  }

  create({ orderId, amountCents }) {
    const result = this.database
      .prepare("INSERT INTO payments (order_id, amount_cents) VALUES (?, ?)")
      .run(orderId, amountCents);
    return this.findById(result.lastInsertRowid);
  }
}

