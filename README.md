# Silicon Lanes

> A system-design journey.

An exploration of high-level system design, beginning with the infrastructure
that receives, routes, and balances requests.

## Topics

- Load balancers
- API gateways
- Reverse proxies

## E-commerce application

The `Application` directory contains independent, container-ready Express
services. Each service owns its runtime, API, business logic, and logical
PostgreSQL database. Replicas share their service database while container
instances and host-port mappings remain externally controlled.

See [`Application/README.md`](Application/README.md) for service ports, Docker
commands, and API paths.

## Control panel

`ControlPanel` is a local dashboard for starting one or more Docker instances,
opening a service detail page, sending sample GET requests, and viewing the
response and container logs.

```powershell
cd ControlPanel
npm install
npm start
```

Open `http://localhost:7012` while Docker Desktop is running.

## Sequential lessons

`Lessons` introduces the architecture one layer at a time as pages inside the
Control Panel website. Lesson 1 begins with a browser client calling one Catalog
Service address directly, before a load balancer, reverse proxy, or API gateway
is added.

Lesson 2 then inserts an Nginx reverse proxy with a short response-cache TTL so
cache misses, hits, expiry, and reduced Catalog Service work are visible.

Lesson 3 turns Nginx into a Layer 7 load balancer and distributes the same HTTP
request across three Catalog Service replicas with simple round-robin routing.

Lesson 4 introduces one API Gateway address and uses the request path to select
the appropriate e-commerce service.

Lesson 5 combines the layers: the gateway selects Catalog, then a Catalog Load
Balancer selects one of two replicas; User and Order remain direct routes.

Lesson 6 scales the entry tier: one public L4 edge Load Balancer selects between
two stateless API Gateways, which route Catalog traffic through a private L7
Load Balancer.

See [`Lessons/README.md`](Lessons/README.md) for the lesson sequence.
