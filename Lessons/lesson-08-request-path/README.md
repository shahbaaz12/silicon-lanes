# Lesson 8: Request Path (Bonus)

This lesson is optional, advanced-reading material. It is not a Docker lab — there is no
`Start`/`Stop`, no backend, and no `/api/lessons/lesson-08-request-path` routes at all. The
registry entry exists only so its static `public/` folder gets mounted at
`/lessons/lesson-08-request-path/`, the same way every other lesson's assets are served.

## What it is for

Lessons 1–7 all begin the moment a request reaches a container Silicon Lanes controls. This
lesson backs up to before that point, and exists to make **one** point:

> Lesson 7's CDN was a single container, and therefore a single point of failure — the same
> problem every earlier lesson worked to remove. In the real world a CDN is not one box. The
> same address is announced from many locations at once (anycast), BGP routes each client to
> the nearest one, and if a location goes offline it simply stops announcing, so traffic
> shifts to the next nearest with no DNS change and no human involvement.

That is the payoff. Everything else on the page exists to make that sentence land.

## Scope: deliberately shallow

This is **not** a DNS or BGP deep dive, and it should not become one. It explains the minimum
needed to reach the SPOF conclusion and then stops. Earlier drafts expanded into anycast
address-conflict mechanics, unicast/VIP/anycast comparisons, registry allocation, and BGP
hijacking — all accurate, all far too much for a bonus page. If this lesson grows again,
that's the material to cut first.

Page structure, in order:

1. **Four plain-English terms** — IP address, domain name, DNS, BGP. Defined before use.
2. **The normal case** — one name, one address, one server, framed as the familiar
   single-point-of-failure shape the course has been dismantling since Lesson 1.
3. **The fix** — anycast, introduced through the surprise itself: you give every location
   *the same* address. Two points are carried by the prose here, both of which readers get
   wrong, and both of which are better made by explanation than by a "you might think X,
   actually Y" callout (that was tried and read as forced): anycast is **one** address in
   many places, so BGP compares *routes* rather than addresses; and anycast is a general
   internet technique rather than a CDN feature, with public DNS resolvers as the canonical
   non-CDN example.
4. **The payoff** — a before/after failover strip showing traffic rerouting when a location
   drops, plus the honest caveat that in-flight connections do break and reconnect.
5. **"Do real apps have one IP?"** — three scale tiers, with the practical point that most
   teams never configure anycast themselves; they point a domain at a CDN that already has it.
6. **The end-to-end stepper**, rejoining the Lesson 6/7 topology.
7. **A six-term glossary.**

## Implementation notes

Fully self-contained stylesheet (it does not extend another lesson's CSS) and reuses only
`Lessons/shared/components.css`/`components.js` for the `lesson-node-lite` boxes in the
walkthrough diagram, so step highlighting and click-to-inspect node configuration behave
identically to Lessons 6 and 7 — entirely client-side, no fetch calls involved. The stepper in
`app.js` only toggles which node(s) are highlighted and swaps the explanation panel.

Because this lesson is prose rather than a live diagram, it runs a wider column (1320px versus
~1180px elsewhere) and larger body text than the interactive lessons.

Content is adapted from an internal research note on the full client-to-database request path.
Only the client-to-CDN slice is used here; service mesh, database shard routing, and latency
percentiles are out of scope for what Silicon Lanes actually builds.
