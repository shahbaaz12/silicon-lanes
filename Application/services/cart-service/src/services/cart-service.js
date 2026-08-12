function positiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { statusCode: 400 });
  }
  return parsed;
}

export class CartService {
  constructor(repository) {
    this.repository = repository;
  }

  getCart(userId) {
    return { userId: positiveInteger(userId, "userId"), items: this.repository.listItems(Number(userId)) };
  }

  addItem(userId, input) {
    return this.repository.addItem({
      userId: positiveInteger(userId, "userId"),
      productId: positiveInteger(input.productId, "productId"),
      quantity: positiveInteger(input.quantity, "quantity")
    });
  }

  removeItem(userId, productId) {
    const changes = this.repository.removeItem(
      positiveInteger(userId, "userId"),
      positiveInteger(productId, "productId")
    );
    if (!changes) throw Object.assign(new Error("Cart item not found"), { statusCode: 404 });
  }
}

