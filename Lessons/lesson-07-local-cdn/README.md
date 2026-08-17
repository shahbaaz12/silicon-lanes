# Lesson 7: Local CDN

This lesson places a local Nginx CDN in front of the complete Lesson 6 origin:

```text
Client -> Local CDN -> L4 Edge LB -> API Gateway 1 or 2
                                  -> User / Order
                                  -> L7 Catalog LB -> Catalog Service 1 or 2
```

The client knows only `127.0.0.1:7712`. `GET /api/products` responses are cached
for 15 seconds. User and Order routes bypass the cache. This is an intentionally
changeable teaching policy. Every response includes
`X-Cache-Status`:

- `MISS`: the request reached the origin and its response was stored.
- `HIT`: the CDN returned the stored response without origin work.
- `BYPASS`: the route is intentionally outside the cache policy.

The Clear CDN cache control removes cached Product files. The UI glows only the
client and CDN on a hit; misses and bypasses illuminate the complete real path.
This lesson reuses the Lesson 6 origin runtime so the difference between edge
caching and origin load is directly visible.

The "Clear cache, then request twice" control automates the teaching moment: it
clears the cache and fires two sequential Product requests, so a MISS followed
immediately by a HIT is visible without manually timing requests inside the
15-second TTL. It is only enabled while the Product route is selected, since
User and Order never populate the cache. The page follows the same
`architecture-flow` / `observation` / `architecture-explanation` layout as
Lessons 5 and 6, with the CDN and its cache result rendered above the reused
Edge, Gateway, and Catalog Load Balancer topology.
