# Lesson 3: L7 Load Balancer

This lesson places one Nginx Layer 7 load balancer in front of three Catalog
Service replicas:

```text
Browser -> localhost:7312 -> loadBalancer1:80 -> catalogService1/2/3:6212
```

Open the lesson from the main Control Panel at
`http://localhost:7012/lessons/lesson-03-l7-load-balancer`.

## The important Nginx configuration

```nginx
upstream catalog_pool {
  server catalogService1:6212;
  server catalogService2:6212;
  server catalogService3:6212;
}

server {
  listen 80;

  location /api/products {
    proxy_pass http://catalog_pool;
  }
}
```

Nginx uses round robin by default, so no algorithm directive is required. The
first request goes to the first replica, the next request to the second, and so
on. The lab template adds only supporting concerns around this core example:
browser CORS headers, a compact access log, a health endpoint, and retrying a
different upstream when a connection fails.

## Try it

1. Start Lesson 3. It creates three Catalog Service containers and one Nginx
   container on port `7312`.
2. Send six requests. With all three replicas running, each should answer two.
3. Kill one replica and send more requests. The remaining replicas continue to
   answer through the same client-facing URL.
4. Restore the pool to create a replacement replica and rebuild the load
   balancer's upstream list.
5. Stop the lesson to remove the lesson-owned containers.

The response envelope and `X-Request-Server` header identify the Catalog
Service instance that answered each request. There is no cache in this lesson:
every successful request reaches a Catalog Service replica.
