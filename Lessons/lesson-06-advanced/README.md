# Lesson 6: Advanced

This lesson removes the API Gateway as a single entry-point instance:

```text
Client -> Edge Load Balancer -> API Gateway 1 or 2
                              -> User Service
                              -> Order Service
                              -> Catalog Load Balancer -> Catalog Service 1 or 2
```

The edge load balancer is the only public lesson container, published on
`localhost:7612`. Both API Gateways and the Catalog load balancer remain private
on the Docker network.

The edge tier is an L4 Nginx stream proxy: it distributes TCP connections
without inspecting HTTP paths. The Catalog tier is an L7 HTTP load balancer.
Both use simple round-robin upstreams with shared worker zones. Both API
Gateways use identical, stateless path-routing configuration. The
`X-API-Gateway` response header identifies which gateway handled the request,
while the standard response envelope identifies the final service instance.

The local Edge proxy uses a short three-second idle timeout so its Layer 4
access log appears promptly in the interactive lesson. Production connection
timeouts should be chosen for the actual traffic and workload.

All topology nodes use the reusable lite components and retain exact-path
activity glow. Logs are kept in the trace panel rather than inside the nodes.
