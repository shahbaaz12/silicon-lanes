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

See [`Lessons/README.md`](Lessons/README.md) for the lesson sequence.
