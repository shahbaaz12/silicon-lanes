# Silicon Lanes

> A system-design journey — from one server to a scalable system, one layer at a time.

Silicon Lanes is a hands-on way to learn how a web request actually gets from a browser to
the right server. It starts with a browser calling one service directly, then adds a reverse
proxy, a load balancer, an API gateway, and a CDN — one decision at a time, each in response
to a problem the previous setup could not solve.

Nothing here is a diagram of a system. Every lesson starts **real Docker containers** on your
machine, and you send **real HTTP requests** through them.

## Just want to look?

If you'd rather browse the lessons without installing anything, there's a static simulation:

**[shahbaaz12.github.io/silicon-lanes](https://shahbaaz12.github.io/silicon-lanes/index.html)**

It walks through the same material with no Docker, no downloads, and nothing running locally.
To actually start containers and send live traffic through them, run the project below.

---

## Heads-up: this creates real containers

When you start a lesson or a service, the Control Panel builds images and runs actual
containers on your machine. They are yours to poke at — you can `docker ps` them, curl them
directly, watch their logs, and kill them mid-request to see what breaks.

To keep that safe and easy to undo:

- Everything it creates is labelled: application services get
  `com.silicon-lanes.managed=true`, and lesson infrastructure (the Nginx proxies, gateways
  and balancers) gets `com.silicon-lanes.lesson=<lesson-id>`. It only ever touches containers
  carrying one of those labels.
- All ports bind to `127.0.0.1` only, so nothing is exposed to your network.
- A **Kill all containers** button on every page removes everything it started.
- PostgreSQL and its data volume are deliberately *kept* by Kill all, so your sample data
  survives. Remove them yourself if you want a clean slate.

## Requirements

| Requirement | Notes |
| --- | --- |
| **Docker Desktop** | Must be running before you start. Images are built locally on first use. |
| **Node.js 22+** | Only needed for the Control Panel itself. |
| Free ports | `7012` for the panel, `6112–6614` for services, `7212–7712` for lessons. |

The first start is the slow one — Docker has to build the service images, which can take a few
minutes. Later starts reuse cached layers and take seconds. A progress bar with an elapsed
timer shows you it's working rather than stuck.

## Run the Control Panel

```bash
cd ControlPanel
npm install
npm start
```

Then open **<http://localhost:7012>** with Docker Desktop running.

That single command is the whole thing — the panel serves the home page, every lesson, and the
Service Lab, and manages all Docker work itself. There is no separate lesson server.

## The application services

Behind the lessons is a small e-commerce app split into six independent Express services. Each
owns its own code, Dockerfile, and logical PostgreSQL database, and each seeds sample data on
first run so every endpoint returns something meaningful.

Each service gets a **port family**: replica 1 takes the base port, replica 2 the next, and so
on (three replicas by default). Inside Docker they all listen on the base port; the family only
applies to what's published on your machine.

| Service | Ports (replicas 1–3) | Endpoints |
| --- | --- | --- |
| **User** | `6112` `6113` `6114` | `GET /api/users` · `GET /api/users/:id` · `POST /api/users` |
| **Catalog** | `6212` `6213` `6214` | `GET /api/products` · `GET /api/products/:id` · `POST /api/products` |
| **Inventory** | `6312` `6313` `6314` | `GET /api/inventory` · `GET /api/inventory/:productId` · `PUT /api/inventory` |
| **Cart** | `6412` `6413` `6414` | `GET /api/carts/:userId` · `POST /api/carts/:userId/items` · `DELETE /api/carts/:userId/items/:productId` |
| **Order** | `6512` `6513` `6514` | `GET /api/orders` · `GET /api/orders/:id` · `POST /api/orders` |
| **Payment** | `6612` `6613` `6614` | `GET /api/payments` · `GET /api/payments/:id` · `POST /api/payments` |

Every service also exposes `GET /health`, and every response carries a `servedBy` field naming
the exact replica that answered — which is what makes load balancing visible later on.

All six share one `postgres:17-alpine` container with a separate logical database each.
Replicas of the same service share that database.

See [`Application/README.md`](Application/README.md) for details.

## Service Lab

**<http://localhost:7012/service-lab>**

The Service Lab is the workshop, separate from the lesson narrative. Start and stop replicas of
any service, watch the replica count change, pick an endpoint, edit a sample JSON body, copy
the equivalent curl, and fire the request. The response panel shows status, duration, formatted
JSON, and which replica served it.

It's the fastest way to get a feel for the services on their own, before any proxy or load
balancer is in front of them.

## The lessons

Each lesson keeps everything from the one before and introduces exactly one new idea, always
because the previous setup hit a wall. All of them are interactive: start the infrastructure,
send requests, read the real Nginx and service logs.

| # | Lesson | Port | What it teaches |
| --- | --- | --- | --- |
| **1** | [Direct to service](Lessons/lesson-01-direct-service/README.md) | `6212` | The simplest possible path — browser straight to one service. Sets up every problem that follows. |
| **2** | [Reverse Proxy](Lessons/lesson-02-reverse-proxy/README.md) | `7212` | One stable address instead of the service's own, plus a 15-second response cache. Watch hits, misses, and expiry. |
| **3** | [L7 Load Balancer](Lessons/lesson-03-l7-load-balancer/README.md) | `7312` | Round-robin across three Catalog replicas. Kill one mid-lesson and watch traffic keep flowing. |
| **4** | [API Gateway](Lessons/lesson-04-api-gateway/README.md) | `7412` | One entry point for six services, routed by request path. |
| **5** | [Hybrid](Lessons/lesson-05-hybrid/README.md) | `7512` | Scale only what's busy — Catalog goes behind a load balancer while User and Order stay direct. |
| **6** | [Advanced availability](Lessons/lesson-06-advanced/README.md) | `7612` | An L4 edge balancer in front of two stateless gateways, then a private L7 balancer. Removes the gateway as a single point of failure. |
| **7** | [Local CDN](Lessons/lesson-07-local-cdn/README.md) | `7712` | Cache at the edge. A hit skips the entire origin chain; `X-Cache-Status` shows `HIT`, `MISS`, or `BYPASS`. |

### Bonus — Lesson 8

[**Request Path: DNS, Anycast & BGP**](Lessons/lesson-08-request-path/README.md) is optional
reading with **no Docker at all**. Lessons 1–7 begin once a request reaches your containers;
this one backs up to the open internet and answers the question Lesson 7 leaves hanging — if
the CDN is one box, isn't that just another single point of failure? (It isn't, and the reason
is worth knowing.)

See [`Lessons/README.md`](Lessons/README.md) for the full sequence.

## Repository layout

```
Application/     Six independent Express services, each with its own Dockerfile
ControlPanel/    The local web app: home page, lessons, Service Lab, Docker orchestration
Lessons/         Per-lesson pages, Nginx configs, and shared UI components
Database/        Notes on the shared PostgreSQL setup
```

## Cleaning up

> ### 🛑 Use the **Kill all containers** button
>
> It sits in the bottom-left corner of **every page** — the home page, the Service Lab, and
> every lesson. It is the easiest and safest way to stop everything this project started.
>
> Before it removes anything it asks the server what would be affected and **lists those
> containers by name in the confirmation**, so you can see exactly what is about to go.

**Why it is safe.** It never removes containers by name pattern or with a blanket `docker rm`.
It only ever acts on the two labels this project applies:

| Label | Applied to |
| --- | --- |
| `com.silicon-lanes.managed=true` | The six application services and their replicas |
| `com.silicon-lanes.lesson=<id>` | Lesson infrastructure — Nginx proxies, gateways, balancers |

Anything else on your machine is invisible to it. PostgreSQL is deliberately excluded too: it
carries a third label (`com.silicon-lanes.infrastructure=postgres`) that neither filter
matches, so your sample data survives.

Prefer the terminal? These are the same two filters:

```bash
docker rm -f $(docker ps -aq --filter "label=com.silicon-lanes.lesson") $(docker ps -aq --filter "label=com.silicon-lanes.managed=true")
```

Both label filters are needed: application services carry the first, lesson infrastructure
the second.

Either way PostgreSQL and its named volume are left in place. To remove those too:

```bash
docker rm -f silicon-lanes-postgres && docker volume rm silicon-lanes-postgres-data
```

---

## Say hi 👋

Got a suggestion, spotted something wrong, or just want to talk through one of the lessons?

**[I am here on LinkedIn](https://www.linkedin.com/in/shabaaz12/)** — I reply to every message.

Corrections are especially welcome. This project only works if the explanations actually land,
and the quickest way to fix one that doesn't is for someone to tell me. No detail is too small
— a confusing sentence, a diagram that reads the wrong way, a port that clashed on your
machine. It all helps.

If you learned something here, I'd genuinely love to hear it. Happy building. 🚀
