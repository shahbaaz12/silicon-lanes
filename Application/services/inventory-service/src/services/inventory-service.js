export class InventoryService {
  constructor(repository) {
    this.repository = repository;
  }

  async listInventory() {
    return this.repository.list();
  }

  async getInventory(productId) {
    const item = await this.repository.findByProductId(productId);
    if (!item) throw Object.assign(new Error("Inventory record not found"), { statusCode: 404 });
    return item;
  }

  async setInventory(input) {
    const productId = Number(input.productId);
    const quantity = Number(input.quantity);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity < 0) {
      throw Object.assign(new Error("positive integer productId and non-negative integer quantity are required"), { statusCode: 400 });
    }
    return this.repository.set({ productId, quantity });
  }
}
