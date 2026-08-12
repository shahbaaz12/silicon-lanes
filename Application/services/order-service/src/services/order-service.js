export class OrderService {
  constructor(repository) {
    this.repository = repository;
  }

  async listOrders() {
    return this.repository.list();
  }

  async getOrder(id) {
    const order = await this.repository.findById(id);
    if (!order) throw Object.assign(new Error("Order not found"), { statusCode: 404 });
    return order;
  }

  async createOrder(input) {
    const userId = Number(input.userId);
    const totalCents = Number(input.totalCents);
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(totalCents) || totalCents < 0) {
      throw Object.assign(new Error("positive integer userId and non-negative integer totalCents are required"), { statusCode: 400 });
    }
    return this.repository.create({ userId, totalCents });
  }
}
