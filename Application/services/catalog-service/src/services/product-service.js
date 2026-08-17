function positiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { statusCode: 400 });
  }
  return parsed;
}

export class ProductService {
  constructor(repository) {
    this.repository = repository;
  }

  async listProducts() {
    return this.repository.list();
  }

  async getProduct(id) {
    const product = await this.repository.findById(positiveInteger(id, "id"));
    if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });
    return product;
  }

  async createProduct(input) {
    const name = input.name?.trim();
    const description = input.description?.trim() ?? "";
    const priceCents = Number(input.priceCents);
    if (!name || !Number.isInteger(priceCents) || priceCents < 0) {
      throw Object.assign(new Error("name and a non-negative integer priceCents are required"), { statusCode: 400 });
    }
    return this.repository.create({ name, description, priceCents });
  }
}
