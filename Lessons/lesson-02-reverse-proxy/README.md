# Lesson 2 — Reverse Proxy and response caching

This lesson inserts a real Nginx reverse proxy between the browser and the
Catalog Service:

```text
Browser client -> http://127.0.0.1:7212/api/products -> Nginx cache -> catalogService1
```

Run the main Control Panel and open
`http://localhost:7012/lessons/lesson-02-reverse-proxy`.

## Cache configuration

The Nginx configuration is in `nginx/default.conf.template`. Successful product
responses are cached for 15 seconds:

```nginx
proxy_cache catalog_cache;
proxy_cache_valid 200 15s;
```

Nginx returns `X-Cache-Status: MISS` when it calls the Catalog Service and
`X-Cache-Status: HIT` when it answers from its cache. The browser is instructed
not to keep its own copy, ensuring every lesson request reaches Nginx.

The client response panel measures the complete browser request time. **Copy
cURL** copies the same proxy request for use in a terminal or import into
Postman.

The **Clear cache** control recreates only the lesson proxy container. Its cache
is therefore empty while the Catalog Service and PostgreSQL remain running.

## What to observe

- The client knows only the Reverse Proxy address.
- The first request reaches both proxy and service.
- A repeat request within 15 seconds reaches only the proxy.
- The Catalog Service log does not change on a cache hit.
- After expiry, Nginx reports `EXPIRED` and refreshes from the service.
- After manual clearing, the next request reports `MISS`.
- Client connection, upstream selection, caching, and future HTTPS termination
  move from the application boundary to the proxy.
