# Lessons

The lessons build the Silicon Lanes architecture one layer at a time. Each
lesson is a page on the main Control Panel website and keeps its page assets
inside its own folder.

1. [`lesson-01-direct-service`](lesson-01-direct-service/README.md) — a browser
   client calls one Catalog Service instance at its published IP and port.
2. [`lesson-02-reverse-proxy`](lesson-02-reverse-proxy/README.md) — an Nginx
   reverse proxy gives the client one stable address and caches product reads.
3. [`lesson-03-l7-load-balancer`](lesson-03-l7-load-balancer/README.md) — an
   Nginx Layer 7 load balancer distributes product requests across three
   Catalog Service replicas using its default round-robin algorithm.
4. [`lesson-04-api-gateway`](lesson-04-api-gateway/README.md) — one Nginx API
   Gateway maps six public request paths to their owning e-commerce services.
5. **Hybrid**
   [`lesson-05-hybrid`](lesson-05-hybrid/README.md) — the API Gateway routes
   User and Order directly while Catalog scales behind a Load Balancer.

## Shared UI components

Reusable client, service, Reverse Proxy, Load Balancer, and response-tab
components live in `Lessons/shared`. New lessons compose these components and
provide only their lesson-specific controls and content. The response component
includes Pretty, JSON, and Headers tabs populated from the real request, plus
the responding server name.

Lessons 3 and 4 use the minimal `<lesson-service-compact>` component for
service instances. It contains only the instance name, published port, compact
request log, and reusable activity glow.

Lesson 5 adds `<lesson-node-lite>` and `<lesson-service-lite>` for small,
name-only infrastructure and service squares. Both retain the shared activity
glow without embedding logs in the topology.
