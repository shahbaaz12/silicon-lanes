# Silicon Lanes — simulated build

A browser-only version of [Silicon Lanes](https://github.com/shahbaaz12/silicon-lanes),
built so the lessons can be opened from a link instead of requiring Docker.

**Live:** https://shahbaaz12.github.io/silicon-lanes/

Every container, request, log line, and cache decision on this site is generated in
your browser. Nothing is installed and nothing is running. The original project does
all of this for real, with Nginx and PostgreSQL containers.

## How it works

The lesson pages here are the same files as the original — same HTML, same CSS, the
same `app.js`. They are copied verbatim, with two mechanical changes:

1. Root-relative URLs (`/theme.css`) become relative (`../../theme.css`), because
   GitHub Pages serves this from a subpath rather than a domain root.
2. Five `<script>` tags are injected into `<head>`.

Those scripts are the whole simulation:

| File | Role |
| --- | --- |
| `sim/fixtures.js` | seed rows, ports, container ids, latency model |
| `sim/logs.js` | log lines formatted the way the Control Panel formats them |
| `sim/lessons.js` | lifecycles for lessons 1–3 |
| `sim/lessons-advanced.js` | lifecycles for lessons 4–7 |
| `sim/fetch-shim.js` | replaces `window.fetch` |
| `sim/banner.js` | the attribution bar |

`fetch-shim.js` intercepts exactly two kinds of request and passes everything else
through to the real `fetch`:

- `/api/lessons/<id>/…` — the Control Panel's lesson API
- `http://localhost:<port>/…` — the address each lesson dials directly, which in the
  real project is a published container port

No lesson's `app.js` was edited. It calls `fetch`, receives a `Response` with the
body and headers it expects, and cannot tell the difference.

## What is faithful

The simulation reproduces the mechanisms the lessons teach, not just their appearance:

- Round-robin selection across replicas, and the skipping of a killed one
- Cache `MISS` → `HIT` → `EXPIRED`, and the fact that a `HIT` never reaches the
  service — its request log genuinely gains no line
- Path-based gateway routing, including longest-prefix matching for `/api/carts/1`
- An L4 edge balancer choosing per **connection**, so lesson 6's connection
  experiment spreads across both gateways while one connection stays put
- Lesson 7's `BYPASS` for routes outside the cache policy
- Lesson state persists across page navigation, the way containers keep running

Response times are modelled rather than measured, but they are spent for real: the
shim `await`s the modelled latency, so each lesson's own `performance.now()` reports
a genuine elapsed duration. The ~47 ms → ~3 ms drop on a cache hit is real elapsed
time, not a printed number.

## What is not real

- **Timings are modelled.** Plausible, consistent, but not measurements of anything.
- **Container ids and ports are synthetic.** Stable within a session, invented.
- **Writes do not persist.** Nothing is stored; a reload resets everything.
- **Only the Catalog service has data.** Users, orders, inventory, carts, and
  payments return empty collections — which is exactly what the real services return
  against a fresh database.
- **The cURL buttons produce real commands that will not work here.** They target
  container ports, so they only resolve against the Docker project.
- **Docker failure states are absent.** Port conflicts, image build failures, and an
  unreachable daemon cannot occur.
- **The Service Lab is not included.** It starts real containers on demand, so it
  stays in the Docker project.
- **Lesson 8 is untouched.** It never used Docker; it is the original file.

## Running it locally

```bash
node tools/serve.mjs
```

Then open http://localhost:7013. Any static file server works — there is no build
step and no dependencies.

## Re-syncing from the original

The original project is the source of truth. After changing a lesson there:

```bash
node tools/sync.mjs
```

It re-copies the lesson files, redoes the URL rewrites, re-injects the simulation
scripts, and fails loudly if any root-relative URL survives or if a wording
adjustment no longer matches. It expects `silicon-lanes` to sit next to this folder.

`home.js` is excluded from the sync and maintained here, because the original pings
Docker for its status indicator.

If a lesson's state shape or log format changes, the matching simulation in
`sim/lessons*.js` has to be updated by hand — the sync script copies files, it does
not infer behaviour.
