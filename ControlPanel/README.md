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
