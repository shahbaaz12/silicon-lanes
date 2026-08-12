export class InventoryRepository {
  constructor(database) {
    this.database = database;
  }

  async list() {
    const result = await this.database.query("SELECT * FROM inventory ORDER BY product_id");
    return result.rows;
  }

  async findByProductId(productId) {
    const result = await this.database.query("SELECT * FROM inventory WHERE product_id = $1", [productId]);
    return result.rows[0];
  }

  async set({ productId, quantity }) {
    const result = await this.database.query(`
      INSERT INTO inventory (product_id, quantity) VALUES ($1, $2)
      ON CONFLICT(product_id) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [productId, quantity]);
    return result.rows[0];
  }
}

