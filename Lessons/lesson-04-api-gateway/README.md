# Lesson 4: API Gateway

This lesson places one Nginx API Gateway in front of all six e-commerce
services:

```text
Browser -> 127.0.0.1:7412 -> apiGateway1:80 -> path-selected service
```

Open the page through the main Control Panel at
`http://127.0.0.1:7012/lessons/lesson-04-api-gateway`.

## The routing idea

```nginx
location /api/users     { proxy_pass http://user_service; }
location /api/products  { proxy_pass http://catalog_service; }
location /api/inventory { proxy_pass http://inventory_service; }
location /api/carts     { proxy_pass http://cart_service; }
location /api/orders    { proxy_pass http://order_service; }
location /api/payments  { proxy_pass http://payment_service; }
```

Every request enters through port `7412`. Nginx matches the request path to a
`location` block and forwards the unchanged path to the selected service. The
actual template also contains browser CORS headers, a health endpoint, and a
compact teaching log; these support the lab but do not change the routing idea.

## Try it

1. Start Lesson 4 to start or reuse one instance of every service and launch
   `apiGateway1`.
2. Select any of the six GET requests in the client card.
3. Send the request and watch the client, gateway, and matched service light up.
4. Compare the gateway routing decision with `servedBy.server` in the response.
5. Stop the lesson to remove the gateway and services that this lesson started.

Unlike Lesson 3, the gateway is selecting a service type, not balancing among
replicas of one type. A later architecture can use both decisions in sequence.
