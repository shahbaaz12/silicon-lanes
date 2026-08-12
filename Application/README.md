# Application

The application is split into independently runnable and containerized Express
services. There is no root launcher or shared Node.js workspace. Each service
owns its dependencies, API, business logic, repository, and database settings.

| Service | Container port | Base endpoint | Default database |
| --- | ---: | --- | --- |
| User | 6112 | `/api/users` | `Database/users.db` |
| Catalog | 6212 | `/api/products` | `Database/catalog.db` |
| Inventory | 6312 | `/api/inventory` | `Database/inventory.db` |
| Cart | 6412 | `/api/carts` | `Database/carts.db` |
| Order | 6512 | `/api/orders` | `Database/orders.db` |
| Payment | 6612 | `/api/payments` | `Database/payments.db` |

Every service exposes `GET /health`.

## Build one service

From the repository root:

```powershell
docker build -t silicon-lanes-user .\Application\services\user-service
docker build -t silicon-lanes-catalog .\Application\services\catalog-service
```

## Run multiple instances

A service keeps the same port inside every container. Docker assigns a distinct
host port to each instance. For example, three User instances use host ports
`6112`, `6113`, and `6114`, all mapped to container port `6112`:

```powershell
$databasePath = (Resolve-Path .\Database).Path

docker run -d --name user-1 -p 6112:6112 `
  --mount "type=bind,source=$databasePath,target=/data" `
  -e DATABASE_PATH=/data/users-1.db silicon-lanes-user

docker run -d --name user-2 -p 6113:6112 `
  --mount "type=bind,source=$databasePath,target=/data" `
  -e DATABASE_PATH=/data/users-2.db silicon-lanes-user

docker run -d --name user-3 -p 6114:6112 `
  --mount "type=bind,source=$databasePath,target=/data" `
  -e DATABASE_PATH=/data/users-3.db silicon-lanes-user
```

The equivalent Catalog mappings are `6212:6212`, `6213:6212`, and
`6214:6212`.

Each SQLite-writing container should use a separate database file. Separate
files are suitable for infrastructure experiments but do not share application
state. When replicas must share consistent data, replace SQLite with a database
server such as PostgreSQL.

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

## Runtime configuration

- `PORT` changes the service's internal listening port.
- `DATABASE_DIR` changes the directory containing its default database file.
- `DATABASE_PATH` selects an explicit file, or `:memory:` for temporary data.
