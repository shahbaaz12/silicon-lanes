export class InventoryRepository {
  constructor(database) {
    this.database = database;
  }

  list() {
    return this.database.prepare("SELECT * FROM inventory ORDER BY product_id").all();
  }

  findByProductId(productId) {
    return this.database.prepare("SELECT * FROM inventory WHERE product_id = ?").get(productId);
  }

  set({ productId, quantity }) {
    this.database.prepare(`
      INSERT INTO inventory (product_id, quantity) VALUES (?, ?)
      ON CONFLICT(product_id) DO UPDATE SET
        quantity = excluded.quantity,
        updated_at = CURRENT_TIMESTAMP
    `).run(productId, quantity);
    return this.findByProductId(productId);
  }
}

