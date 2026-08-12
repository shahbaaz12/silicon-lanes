# Application

The application is split into independently runnable Express services. Each
service owns its API, business logic, repository, and SQLite database file.

| Service | Port | Base endpoint | Database |
| --- | ---: | --- | --- |
| User | 6112 | `/api/users` | `Database/users.db` |
| Catalog | 6113 | `/api/products` | `Database/catalog.db` |
| Inventory | 6114 | `/api/inventory` | `Database/inventory.db` |
| Cart | 6115 | `/api/carts` | `Database/carts.db` |
| Order | 6116 | `/api/orders` | `Database/orders.db` |
| Payment | 6117 | `/api/payments` | `Database/payments.db` |

Every service exposes `GET /health`.

## Service structure

```text
src/
├── app.js          # Express middleware and routes
├── config.js       # Environment-backed configuration
├── server.js       # Dependency wiring and HTTP listener
├── controllers/    # HTTP translation
├── database/       # SQLite connection and schema
├── repositories/   # Data access
├── routes/         # Endpoint definitions
└── services/       # Business rules
```

