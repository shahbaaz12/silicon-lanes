# Lesson 8: Request Path (Bonus)

This lesson is optional, advanced-reading material. It is not a Docker lab — there is no
`Start`/`Stop`, no backend, and no `/api/lessons/lesson-08-request-path` routes at all. The
registry entry exists only so its static `public/` folder gets mounted at
`/lessons/lesson-08-request-path/`, the same way every other lesson's assets are served.

Lessons 1–7 all begin the moment a request reaches a container Silicon Lanes controls. This
lesson backs up to before that point and asks how a real client, on the real internet, finds
a CDN in the first place:

```text
Client -> DNS resolution (returns an anycast IP, identical for every client)
       -> BGP routing (each network independently picks the best path to that IP)
       -> CDN Point of Presence (TCP + TLS handshake; Lesson 7 picks up here)
       -> on a MISS/BYPASS: Edge L4 Load Balancer -> API Gateway -> L7 Catalog Load Balancer
```

The core teaching point is the split between two decisions that get conflated in
conversation: DNS decides *what* IP address everyone gets (the same one, under anycast); BGP
decides *where* that IP physically routes to for a given client, based on network topology,
not geography. A second diagram makes the anycast idea concrete — one IP address announced
from three CDN locations, with two example clients taking different BGP paths to reach it.

The page is a self-contained stylesheet (it does not extend another lesson's CSS) and reuses
only `Lessons/shared/components.css`/`components.js` for the `lesson-node-lite` boxes in its
diagrams, so the step-through walkthrough and the click-to-inspect node configuration behave
identically to Lessons 6 and 7 — entirely client-side, no fetch calls involved. The stepper in
`app.js` just toggles which node(s) are highlighted and swaps the explanation panel; nothing in
this lesson talks to the network.

Content is adapted from an internal research note on the full client-to-database request path
(DNS/anycast/BGP, load-balancer tiers, OSI vs TCP/IP, sharding, and Netflix's public
architecture as a real-world example). This lesson covers only the client-to-CDN-to-L7-load-balancer
slice of that note; the rest (service mesh, database shard routing, latency percentiles) is
out of scope for what Silicon Lanes actually builds.

Lesson 7's "what still remains" list points here for the question it deliberately leaves open:
a single CDN instance is a SPOF, but *how did the client's request find it at all*, out of
every CDN location on Earth? This lesson is the answer.
