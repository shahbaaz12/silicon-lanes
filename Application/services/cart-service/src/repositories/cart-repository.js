export class CartRepository {
  constructor(database) {
    this.database = database;
  }

  listItems(userId) {
    return this.database.prepare("SELECT * FROM cart_items WHERE user_id = ? ORDER BY id").all(userId);
  }

  addItem({ userId, productId, quantity }) {
    this.database.prepare(`
      INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
      ON CONFLICT(user_id, product_id) DO UPDATE SET
        quantity = cart_items.quantity + excluded.quantity
    `).run(userId, productId, quantity);
    return this.database
      .prepare("SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?")
      .get(userId, productId);
  }

  removeItem(userId, productId) {
    return this.database
      .prepare("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?")
      .run(userId, productId).changes;
  }
}

