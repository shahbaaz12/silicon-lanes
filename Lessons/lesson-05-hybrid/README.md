# Lesson 5: Hybrid

This lesson combines two Layer 7 decisions:

```text
/api/users    -> API Gateway -> User Service
/api/orders   -> API Gateway -> Order Service
/api/products -> API Gateway -> Load Balancer -> 2 Catalog replicas
```

Open `http://localhost:7012/lessons/lesson-05-hybrid` through the main Control
Panel. The gateway is published on port `7512`; the Catalog Load Balancer stays
private inside the Docker network.

The API Gateway selects a service type from the request path. For Products, the
Load Balancer then selects one of two interchangeable Catalog replicas using
Nginx's default round-robin algorithm. User and Order each have one instance,
so those routes go directly from the gateway to their service.

The small API Gateway and Load Balancer squares use the reusable
`<lesson-node-lite>` component. The four application instances use the
name-only `<lesson-service-lite>` component. Both keep the shared activity glow,
while request logs remain in the trace panel instead of inside service cards.
