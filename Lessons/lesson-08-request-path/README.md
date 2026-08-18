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

Page structure, in order. Each step carries a visual:

1. **Four plain-English terms** — IP address, domain name, DNS, BGP. Defined before use.
2. **Step one: visiting a website** — the browser asks DNS, DNS returns one simple address,
   the browser connects. Visual: three-node request flow.
3. **The problem** — that address points at one machine, so one bad day takes the whole site
   down, and DNS keeps handing the address out regardless. Explicitly framed as the same
   single-point-of-failure shape the course has been dismantling since Lesson 1, and as the
   biggest one yet (unlike a dead Catalog replica in Lesson 3, there is no "another one").
   Visual: healthy/down strip ending in an outcome chip.
4. **The fix** — anycast, stated plainly: instead of one address per location, every location
   shares one address. Then BGP (spelled out as Border Gateway Protocol) as the thing that
   decides who reaches which, followed by the two payoffs it buys at once — redundancy and
   geographic performance. Visuals: the three-city anycast diagram, plus a two-up benefit
   pair.
5. **The payoff** — the same failure as step 3, now survived, because the address was never
   tied to one building. Then the availability table showing what each extra nine costs in
   downtime per year, and why the bottom rows are unreachable with one machine. Visuals: the
   failover strip and the uptime table.
6. **Worth knowing: anycast isn't the only way** — short note contrasting anycast/BGP (one
   shared address, network decides) with unicast plus a traffic manager such as an F5 BIG-IP
   (distinct addresses, an appliance you run decides). Visual: two-up comparison.
7. **The end-to-end stepper**, rejoining the Lesson 6/7 topology.
8. **A six-term glossary.**

Two points readers reliably get wrong are carried by the prose rather than by a "you might
think X, actually Y" callout — that was tried and read as forced. They are: anycast is **one**
address in many places, so BGP compares *routes* rather than addresses; and anycast is a
general internet technique rather than a CDN feature, with public DNS resolvers as the
canonical non-CDN example.

## On the availability numbers

The nines table is standard arithmetic (99% ≈ 3.65 days/year, 99.9% ≈ 8.76 hours,
99.99% ≈ 52.6 minutes, 99.999% ≈ 5.26 minutes). The surrounding claims were checked rather
than assumed: published CDN SLAs sit roughly in the 99.9%–99.99% band, some vendors advertise
a 100% uptime SLA on top tiers, and independent measurements of the major providers cluster
near 99.999%. The page deliberately notes that a 100% SLA is a commercial promise backed by
service credits, not a claim that nothing fails — stating it as achieved uptime would be
wrong.

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
