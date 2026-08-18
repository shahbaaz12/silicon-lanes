# Application

The application is split into independently runnable and containerized Express
services. There is no root launcher or shared Node.js workspace. Each service
owns its dependencies, API, business logic, repository, and database settings.

| Service | Container port | Base endpoint | PostgreSQL database |
| --- | ---: | --- | --- |
| User | 6112 | `/api/users` | `silicon_lanes_users` |
| Catalog | 6212 | `/api/products` | `silicon_lanes_catalog` |
| Inventory | 6312 | `/api/inventory` | `silicon_lanes_inventory` |
| Cart | 6412 | `/api/carts` | `silicon_lanes_carts` |
| Order | 6512 | `/api/orders` | `silicon_lanes_orders` |
| Payment | 6612 | `/api/payments` | `silicon_lanes_payments` |

Every service exposes `GET /health`.

## Standard response envelope

Every JSON endpoint uses the same response middleware. Successful responses
place the endpoint result in `data`; errors use `error`. Both include the
service and exact instance that answered:

```json
{
  "data": [],
  "servedBy": {
    "service": "catalog-service",
    "server": "catalogService1"
  }
}
```

The same values remain available in the `x-service-name` and
`x-request-server` response headers.

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
docker run -d --name userService1 --network silicon-lanes-network `
  -p 6112:6112 -e INSTANCE_NAME=userService1 silicon-lanes-user

docker run -d --name userService2 --network silicon-lanes-network `
  -p 6113:6112 -e INSTANCE_NAME=userService2 silicon-lanes-user

docker run -d --name userService3 --network silicon-lanes-network `
  -p 6114:6112 -e INSTANCE_NAME=userService3 silicon-lanes-user
```

These commands assume `silicon-lanes-postgres` is running on the named network
with the documented credentials and logical databases. The local control panel
creates that infrastructure automatically and is the recommended launcher.

The equivalent Catalog mappings are `6212:6212`, `6213:6212`, and
`6214:6212`.

All instances of the same service connect to the same logical PostgreSQL
database. Different services retain separate database ownership.

## Service structure

```text
src/
├── app.js          # Express middleware and routes
├── config.js       # Environment-backed configuration
├── server.js       # Dependency wiring and HTTP listener
├── controllers/    # HTTP translation
├── database/       # PostgreSQL connection and schema
├── middleware/     # Standard response contract
├── repositories/   # Data access
├── routes/         # Endpoint definitions
└── services/       # Business rules
```

## Runtime configuration

- `PORT` changes the service's internal listening port.
- `DATABASE_HOST` and `DATABASE_PORT` select the PostgreSQL server.
- `DATABASE_USER` and `DATABASE_PASSWORD` configure authentication.
- `DATABASE_NAME` selects the logical database owned by the service.
- `DATABASE_POOL_SIZE` controls the maximum connections per instance.

## Sample data

Every service seeds its table on first connection so that a freshly started system returns
something meaningful from each endpoint rather than empty arrays. The sample rows
cross-reference each other: three users, three products, inventory keyed to those product
ids, a cart belonging to user 1, three orders, and a payment per order (order 1's total of
24200 is two keyboards plus one desk lamp, matching that cart).

Seeding is safe to run concurrently, which matters because lessons start two or three
replicas of a service at once and they share one logical database. Tables with a natural
unique key (`users.email`, `inventory.product_id`, `cart_items(user_id, product_id)`) insert
with `ON CONFLICT DO NOTHING`, so they also fill in missing rows in a partially-populated
database. The remaining tables have only a serial id, so they use an all-or-nothing
`WHERE NOT EXISTS` guard inside a locked transaction instead.
