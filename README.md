# Silicon Lanes

> A system-design journey.

An exploration of high-level system design, beginning with the infrastructure
that receives, routes, and balances requests.

## Topics

- Load balancers
- API gateways
- Reverse proxies

## E-commerce application

The `Application` workspace contains independent Express services backed by
service-owned SQLite databases in the root-level `Database` directory.

```bash
npm install
npm start
```

The services listen on ports `6112` through `6117`. See
[`Application/README.md`](Application/README.md) for the service map and API
paths.
