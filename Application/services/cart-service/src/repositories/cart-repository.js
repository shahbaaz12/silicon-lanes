export class CartRepository {
  constructor(database) {
    this.database = database;
  }

  async listItems(userId) {
    const result = await this.database.query(
      "SELECT * FROM cart_items WHERE user_id = $1 ORDER BY id",
      [userId]
    );
    return result.rows;
  }

  async addItem({ userId, productId, quantity }) {
    const result = await this.database.query(`
      INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)
      ON CONFLICT(user_id, product_id) DO UPDATE SET
        quantity = cart_items.quantity + EXCLUDED.quantity
      RETURNING *
    `, [userId, productId, quantity]);
    return result.rows[0];
  }

  async removeItem(userId, productId) {
    const result = await this.database.query(
      "DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2",
      [userId, productId]
    );
    return result.rowCount;
  }
}

