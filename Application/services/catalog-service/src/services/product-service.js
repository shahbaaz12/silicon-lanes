export class ProductService {
  constructor(repository) {
    this.repository = repository;
  }

  listProducts() {
    return this.repository.list();
  }

  getProduct(id) {
    const product = this.repository.findById(id);
    if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });
    return product;
  }

  createProduct(input) {
    const name = input.name?.trim();
    const description = input.description?.trim() ?? "";
    const priceCents = Number(input.priceCents);
    if (!name || !Number.isInteger(priceCents) || priceCents < 0) {
      throw Object.assign(new Error("name and a non-negative integer priceCents are required"), { statusCode: 400 });
    }
    return this.repository.create({ name, description, priceCents });
  }
}

