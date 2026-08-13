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

## Shared UI components

Reusable client, service, Reverse Proxy, Load Balancer, and response-tab
components live in `Lessons/shared`. New lessons compose these components and
provide only their lesson-specific controls and content. The response component
includes Pretty, JSON, and Headers tabs populated from the real request, plus the responding
server name.
