export const serviceCatalog = Object.freeze({
  user: {
    key: "user",
    name: "User Service",
    description: "Customer identities and profiles.",
    color: "violet",
    basePort: 6112,
    containerPort: 6112,
    folder: "user-service",
    image: "silicon-lanes-user:local",
    database: "users"
  },
  catalog: {
    key: "catalog",
    name: "Catalog Service",
    description: "Products, prices, and descriptions.",
    color: "cyan",
    basePort: 6212,
    containerPort: 6212,
    folder: "catalog-service",
    image: "silicon-lanes-catalog:local",
    database: "catalog"
  },
  inventory: {
    key: "inventory",
    name: "Inventory Service",
    description: "Available quantities for products.",
    color: "emerald",
    basePort: 6312,
    containerPort: 6312,
    folder: "inventory-service",
    image: "silicon-lanes-inventory:local",
    database: "inventory"
  },
  cart: {
    key: "cart",
    name: "Cart Service",
    description: "Customer carts and line items.",
    color: "amber",
    basePort: 6412,
    containerPort: 6412,
    folder: "cart-service",
    image: "silicon-lanes-cart:local",
    database: "carts"
  },
  order: {
    key: "order",
    name: "Order Service",
    description: "Order creation and lifecycle.",
    color: "orange",
    basePort: 6512,
    containerPort: 6512,
    folder: "order-service",
    image: "silicon-lanes-order:local",
    database: "orders"
  },
  payment: {
    key: "payment",
    name: "Payment Service",
    description: "Payment authorization records.",
    color: "rose",
    basePort: 6612,
    containerPort: 6612,
    folder: "payment-service",
    image: "silicon-lanes-payment:local",
    database: "payments"
  }
});

export function getService(key) {
  return serviceCatalog[key];
}

