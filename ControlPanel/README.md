# Silicon Lanes Control Panel

A local web interface for building, starting, inspecting, requesting, and
stopping the repository's Dockerized services.

## Run

Docker Desktop must be running.

```powershell
cd ControlPanel
npm install
npm start
```

Open `http://localhost:7012`.

The home page also contains the sequential learning path. Lesson 1 is served by
this same Control Panel at
`http://localhost:7012/lessons/lesson-01-direct-service`; there is no separate
lesson website or lesson server process.

Lesson 2 runs at `http://localhost:7012/lessons/lesson-02-reverse-proxy`. It
starts a local `nginx:1.27-alpine` reverse proxy on port `7212`, demonstrates a
15-second product-response cache, and keeps proxy and Catalog Service logs
separate.

Lesson 3 runs at `http://localhost:7012/lessons/lesson-03-l7-load-balancer`.
It starts Nginx on port `7312` and three Catalog Service replicas, then shows
round-robin request distribution and continued routing after one replica is
stopped.

Lesson 4 runs at `http://localhost:7012/lessons/lesson-04-api-gateway`. It
starts Nginx on port `7412` and routes `/api/users`, `/api/products`,
`/api/inventory`, `/api/carts`, `/api/orders`, and `/api/payments` to the six
independent application services.

Lesson 5 runs at `http://localhost:7012/lessons/lesson-05-hybrid`. Its API
Gateway publishes port `7512`, routes User and Order directly, and sends
Products through a private two-replica Catalog Load Balancer.

Lesson 6 runs at `http://localhost:7012/lessons/lesson-06-advanced`. Only its
L4 edge Load Balancer is published, on port `7612`. It round-robins TCP connections across two
private API Gateways; Product traffic then crosses a second private Load
Balancer at L7 before reaching one of two Catalog replicas.

Lesson 7 runs at `http://localhost:7012/lessons/lesson-07-local-cdn`. Its local
CDN is published on port `7712`, caches successful Product reads for 15 seconds,
and reports `HIT`, `MISS`, or `BYPASS` in `X-Cache-Status`.

The panel binds only to `127.0.0.1`. It operates only on the six configured
service images and containers carrying the `com.silicon-lanes.managed=true`
label. Its image is built from the independent service folder when instances
are started. Docker reuses cached layers when the source has not changed.

Each instance receives a readable name such as `userService1`, which is also
returned as `requestServer`. The detail page shows the host-to-container port
mapping, selected endpoint curl, and a compact live request log containing only
timestamp, HTTP method, and URL.

Each instance card can show every endpoint exposed by its service. Selecting an
endpoint updates the displayed curl command and copy action. Clearing logs hides
the current request history while allowing later requests to appear normally.

Starting a service automatically creates one shared `postgres:17-alpine`
container and six logical databases. Replicas of a service connect to the same
logical database. The detail page can stop one instance or kill all instances
of the selected service; it does not remove PostgreSQL or its named data volume.
For local development the database password defaults to `silicon_lanes`; set
`SILICON_LANES_DATABASE_PASSWORD` before starting the panel to override it.
