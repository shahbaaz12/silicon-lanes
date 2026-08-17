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
       -> CDN Point of Presence (connection established; Lesson 7 picks up here)
       -> on a MISS/BYPASS: Edge L4 Load Balancer -> API Gateway -> L7 Catalog Load Balancer
```

## Teaching approach

The page is written to be read start-to-finish by someone who does not already know the
vocabulary. Terms are defined before they are used, never after:

1. **Four plain-English definitions first** — IP address, domain name, DNS, resolver. Nothing
   else is introduced until these are established.
2. **The ordinary case** — one name, one address, one server, in one building. Stated plainly
   as the setup most real applications actually use, so the later material reads as a
   variation on something familiar rather than as the default.
3. **The problem** — users far away from that one building.
4. **Two solutions, contrasted** — GeoDNS (DNS returns *different* addresses) versus anycast
   (DNS returns *one* address everywhere, and the network decides). Conflating these two is
   the most common confusion in this topic, so they are introduced together, side by side.
5. **Three question-led sections**, each answering an objection a reader will actually have.
   These are the core of the lesson and carry a rose accent bar so they read as a set:
   - *"The same IP in multiple places — isn't that a conflict? Doesn't DNS reject it?"*
     Answered in three parts: DNS never verifies anything (it is a lookup table, not a
     registration system); routing has always handled multiple paths to the same prefix, so
     anycast uses existing behaviour rather than subverting it; and the actual guardrail is
     address-block ownership enforced in routing (RIR allocation, Autonomous System numbers,
     signed announcements), with BGP hijacking as the failure mode.
   - *"Is an anycast address a virtual IP?"* Answered with a three-card comparison —
     unicast (one address, one machine), VIP (one address, one machine live at a time,
     failover within a site), anycast (one address, many machines live simultaneously across
     regions). The distinction matters because "virtual IP" in normal usage means the middle
     case, not anycast.
   - *"Do real applications have just one IP?"* Answered across three scale tiers, with the
     practical point that most teams never configure anycast themselves — they point their
     domain at a CDN whose anycast addresses already exist.
6. **The anycast diagram**, once every term in it has a meaning.
7. **The end-to-end stepper**, as the payoff rather than the introduction.
8. **A full glossary** of all thirteen terms as reference.

## Implementation notes

Fully self-contained stylesheet (it does not extend another lesson's CSS) and reuses only
`Lessons/shared/components.css`/`components.js` for the `lesson-node-lite` boxes in the
walkthrough diagram, so the step-through highlighting and click-to-inspect node configuration
behave identically to Lessons 6 and 7 — entirely client-side, no fetch calls involved. The
stepper in `app.js` only toggles which node(s) are highlighted and swaps the explanation
panel; nothing in this lesson talks to the network.

Because this lesson is prose-heavy rather than diagram-heavy, it deliberately runs a wider
column (1320px versus ~1180px elsewhere) and larger body text than the interactive lessons.
It is meant to be read, not scanned while watching logs.

Content is adapted from an internal research note on the full client-to-database request path.
This lesson covers only the client-to-CDN-to-L7-load-balancer slice of that note; the rest
(service mesh, database shard routing, latency percentiles) is out of scope for what Silicon
Lanes actually builds.

Lesson 7's "what still remains" list points here for the question it deliberately leaves open:
a single CDN instance is a SPOF, but *how did the client's request find it at all*, out of
every CDN location on Earth? This lesson is the answer.
