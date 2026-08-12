export class PaymentService {
  constructor(repository) {
    this.repository = repository;
  }

  async listPayments() {
    return this.repository.list();
  }

  async getPayment(id) {
    const payment = await this.repository.findById(id);
    if (!payment) throw Object.assign(new Error("Payment not found"), { statusCode: 404 });
    return payment;
  }

  async createPayment(input) {
    const orderId = Number(input.orderId);
    const amountCents = Number(input.amountCents);
    if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(amountCents) || amountCents < 0) {
      throw Object.assign(new Error("positive integer orderId and non-negative integer amountCents are required"), { statusCode: 400 });
    }
    return this.repository.create({ orderId, amountCents });
  }
}
