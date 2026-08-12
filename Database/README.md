# Database

Silicon Lanes uses one PostgreSQL server with a separate logical database owned
by each service:

- `silicon_lanes_users`
- `silicon_lanes_catalog`
- `silicon_lanes_inventory`
- `silicon_lanes_carts`
- `silicon_lanes_orders`
- `silicon_lanes_payments`

All replicas of one service connect to the same database, so state is shared
across load-balanced instances. A service must access another service's data
through its API rather than connecting directly to the other database.

The local control panel automatically creates:

- Container: `silicon-lanes-postgres`
- Network: `silicon-lanes-network`
- Named volume: `silicon-lanes-postgres-data`

Tables are initialized by each service when it starts. Killing application
instances does not remove PostgreSQL or its data volume.
