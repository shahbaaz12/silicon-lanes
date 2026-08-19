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

## Code map

The Control Panel is arranged by responsibility:

- `src/server.js` starts the HTTP listener only.
- `src/app.js` assembles middleware, static pages, routers, and error handling.
- `src/routes/` contains the service API and the generated lesson API routes.
- `src/lessons/registry.js` is the single list of lesson IDs and lifecycle actions.
- `src/infrastructure/` contains shared Docker, health, port, label, and service-pool helpers.
- `*-lesson-manager.js` files contain only lesson-specific orchestration.
- `public/shared/` contains browser utilities reused by the Control Panel pages.
- `test/` verifies the route contract and infrastructure helpers with Node's built-in test runner.

When adding a lesson, implement its manager and add one entry to the lesson registry; the app
will mount its public folder and API routes from that declaration. A lesson with no Docker
lifecycle (bonus reading, like Lesson 8) can register with an empty `routes` array — the app
still mounts its public folder, it just contributes no API routes.

Run the automated checks with `npm test` from this folder.

The home page presents the lessons as one evolving request journey. Service
orchestration lives separately at `http://localhost:7012/service-lab`, where
application-service replicas can be started and inspected without interrupting
the learning narrative. Lesson 1 is served by this same Control Panel at
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

Lesson 8 runs at `http://localhost:7012/lessons/lesson-08-request-path`. It is
optional, advanced-reading material, not a Docker lab — no containers, no
port, no `Start`/`Stop`. It is presented separately on the home page, behind
an explicit divider, and reuses only the shared `lesson-node-lite` components
for its diagrams.

The panel binds only to `127.0.0.1`. It operates only on the six configured
service images and containers carrying the `com.silicon-lanes.managed=true`
label. Its image is built from the independent service folder when instances
are started. Docker reuses cached layers when the source has not changed.

Each instance receives a readable name such as `userService1`, which is also
returned as `requestServer`. The Service Lab presents every service as a compact
card with its running replica count. Cards with active replicas use an accent
glow. Selecting a card expands one reusable workbench below the grid; no separate
service detail page is used.

The workbench manages replica capacity and lets the user target a running
replica, choose one of the service's declared endpoints, edit a sample JSON body,
copy its curl, and execute the request. The response panel reports status,
duration, responding server name, and formatted JSON. Execution is restricted to
managed replicas and endpoints declared in the service catalog. Each service is
limited to three running replicas; this limit is enforced by both the interface
and service API. Set `SILICON_LANES_MAX_REPLICAS` before starting the Control
Panel to extend the limit for larger experiments.

Starting a service automatically creates one shared `postgres:17-alpine`
container and six logical databases. Replicas of a service connect to the same
logical database. The detail page can stop one instance or kill all instances
of the selected service; it does not remove PostgreSQL or its named data volume.
For local development the database password defaults to `silicon_lanes`; set
`SILICON_LANES_DATABASE_PASSWORD` before starting the panel to override it.

The Service Lab's global **Kill all** action removes every labeled lesson and
application-service container while keeping PostgreSQL and its data volume. The
same action is also available everywhere else as a floating **Kill all
containers** control in the bottom-left corner, mounted by `public/kill-all.js`
on the home page and every lesson. That script follows the same pattern as
`theme.js`: it is served from the Control Panel's public root, loaded with a
plain script tag, and mounts itself into the page, so no page needs its own
markup for it. It renders its own toasts rather than reusing a page's toast
region, because those differ across the site. The Service Lab is the one page
that does not load it, since it already has its own Kill all button.

Before removing anything, the floating control calls `GET /api/system`, a read-only preview
that reports exactly which containers a global stop would affect, and names them in the
confirmation dialog. The preview and the `DELETE` use the same two label filters, so what is
shown cannot disagree with what happens. Both destructive helpers reject an empty or missing
label filter rather than passing it to Docker, so no refactor can silently widen the blast
radius. PostgreSQL carries a third label (`com.silicon-lanes.infrastructure=postgres`) that
neither filter matches, which is why it and its data volume always survive.

Container lifecycle operations show a global progress indicator: a thin
indeterminate bar at the top of the page plus a badge naming the operation and
counting elapsed seconds, mounted by `public/progress.js` on every page where
containers can be started (including the Service Lab). It wraps `window.fetch`
rather than requiring each page to call start/stop helpers, so the lesson pages
stay untouched and the indicator cannot drift out of sync with them. Only an
explicit allowlist of container lifecycle calls is watched, so the log polling
every lesson runs on a timer never triggers it, and nothing is shown for the
first 400ms so quick calls do not flash. Progress is indeterminate on purpose —
Docker reports no completion percentage, so a filling bar would be an invented
number; after 20 seconds the badge adds a note that a first run is building
images.

A dismissible note under the header points at the hosted, Docker-free walkthrough, mounted by
`public/browse-note.js` on every page. Hiding it collapses it to a small pull tab tucked under
the header, and the choice is remembered per browser, so dismissing it on one lesson dismisses
it everywhere. Both states sit in normal document flow rather than being fixed-position, since
the fixed corners are already taken by the theme toggle and the Kill all button. The script
does not mount at all when the page is served from github.io, so the hosted copy never links
to itself. The same link also appears in the footers of the home page and the Service Lab;
lesson pages have no footer element.

The light/dark theme toggle is available on the Control Panel and every lesson,
and the selected theme is remembered in the browser.
