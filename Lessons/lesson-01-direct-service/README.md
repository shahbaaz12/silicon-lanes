# Lesson 1 — Hitting a service directly

This lesson shows the simplest request path:

```text
Browser client -> http://localhost:6212/api/products -> catalogService1
```

There is no load balancer, reverse proxy, or API gateway. The client knows the
Catalog Service address and sends its request straight to that server.

## Run the lesson

Start Docker Desktop, then run the main Control Panel:

```powershell
cd ControlPanel
npm install
npm start
```

Open `http://localhost:7012`, then choose **Lesson 01 — Hitting the service
directly**, or open `http://localhost:7012/lessons/lesson-01-direct-service`.

Use **Start Catalog Service**, then **Get all products**. The lesson starts a
Dockerized Catalog Service and its shared PostgreSQL infrastructure when they
are not already running. On the first empty catalog it also creates three
sample products.

The browser calls the published Catalog Service address directly. The main
Control Panel only controls the Docker lifecycle and reads the container's
compact request log; it does not proxy the product request.

## What to notice

- The client must know the server's exact address.
- One server accepts the connection, processes the request, queries PostgreSQL,
  and builds the response.
- There is no automatic failover if this address becomes unavailable.
- Adding replicas would force the client to choose which address to call.
