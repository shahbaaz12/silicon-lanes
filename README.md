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
services. Each service owns its runtime, API, business logic, and SQLite
database. Container instances and host-port mappings are controlled externally.

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
