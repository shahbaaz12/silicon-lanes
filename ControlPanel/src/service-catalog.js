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
    database: "silicon_lanes_users",
    endpoints: [
      { method: "GET", path: "/health", label: "Health" },
      { method: "GET", path: "/api/users", label: "List users" },
      { method: "GET", path: "/api/users/1", label: "Get user" },
      { method: "POST", path: "/api/users", label: "Create user", body: { name: "Ada Lovelace", email: "ada@example.com" } }
    ]
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
    database: "silicon_lanes_catalog",
    endpoints: [
      { method: "GET", path: "/health", label: "Health" },
      { method: "GET", path: "/api/products", label: "List products" },
      { method: "GET", path: "/api/products/1", label: "Get product" },
      { method: "POST", path: "/api/products", label: "Create product", body: { name: "Mechanical Keyboard", description: "Wireless keyboard", priceCents: 8900 } }
    ]
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
    database: "silicon_lanes_inventory",
    endpoints: [
      { method: "GET", path: "/health", label: "Health" },
      { method: "GET", path: "/api/inventory", label: "List inventory" },
      { method: "GET", path: "/api/inventory/1", label: "Get inventory" },
      { method: "PUT", path: "/api/inventory", label: "Set inventory", body: { productId: 1, quantity: 25 } }
    ]
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
    database: "silicon_lanes_carts",
    endpoints: [
      { method: "GET", path: "/health", label: "Health" },
      { method: "GET", path: "/api/carts/1", label: "Get cart" },
      { method: "POST", path: "/api/carts/1/items", label: "Add item", body: { productId: 1, quantity: 2 } },
      { method: "DELETE", path: "/api/carts/1/items/1", label: "Remove item" }
    ]
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
    database: "silicon_lanes_orders",
    endpoints: [
      { method: "GET", path: "/health", label: "Health" },
      { method: "GET", path: "/api/orders", label: "List orders" },
      { method: "GET", path: "/api/orders/1", label: "Get order" },
      { method: "POST", path: "/api/orders", label: "Create order", body: { userId: 1, totalCents: 8900 } }
    ]
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
    database: "silicon_lanes_payments",
    endpoints: [
      { method: "GET", path: "/health", label: "Health" },
      { method: "GET", path: "/api/payments", label: "List payments" },
      { method: "GET", path: "/api/payments/1", label: "Get payment" },
      { method: "POST", path: "/api/payments", label: "Create payment", body: { orderId: 1, amountCents: 8900 } }
    ]
  }
});

export function getService(key) {
  return serviceCatalog[key];
}
