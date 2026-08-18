// Seed data and small helpers shared by every simulated lesson.
//
// Loaded as a classic script so it runs before the lessons' deferred ES modules.
// Everything hangs off one global namespace to avoid a build step.
window.SiliconLanesSim = window.SiliconLanesSim || {};

(function (sim) {
  // Mirrors the seed rows in Application/services/catalog-service/src/database/connection.js.
  // The real API runs SELECT * so rows arrive snake_cased, which is why the lessons
  // read `priceCents ?? price_cents`.
  sim.products = [
    { id: 1, name: "Mechanical Keyboard", description: "Low-profile wireless keyboard", price_cents: 8900, created_at: "2026-01-04T09:12:00.000Z" },
    { id: 2, name: "Studio Headphones", description: "Closed-back monitoring headphones", price_cents: 12900, created_at: "2026-01-04T09:12:00.000Z" },
    { id: 3, name: "Desk Lamp", description: "Adjustable warm-to-cool task light", price_cents: 6400, created_at: "2026-01-04T09:12:00.000Z" }
  ];

  sim.catalogPort = (sequence) => 6211 + sequence;

  let idCounter = 0;
  sim.containerId = function containerId() {
    // Docker ids are 64 hex characters; the lessons slice and display them.
    idCounter += 1;
    const seed = `${Date.now().toString(16)}${idCounter.toString(16).padStart(4, "0")}`;
    let id = seed;
    while (id.length < 64) id += Math.floor(Math.random() * 16).toString(16);
    return id.slice(0, 64);
  };

  // Nginx writes $time_iso8601, which is second-resolution local time with an offset.
  sim.isoTimestamp = function isoTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absolute = Math.abs(offsetMinutes);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
      + `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
  };

  // Latency is modelled rather than measured, but it is spent for real: the shim
  // awaits it, so the lessons' own performance.now() timings stay honest.
  sim.delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  sim.jitter = (base, spread) => base + Math.random() * spread;

  sim.latency = {
    serviceQuery: () => sim.jitter(18, 22),   // Express + a PostgreSQL round trip
    proxyHop: () => sim.jitter(4, 4),         // one Nginx forward
    cacheHit: () => sim.jitter(1.5, 2.5),     // served from the proxy's memory
    containerStart: () => sim.jitter(900, 700)
  };
}(window.SiliconLanesSim));
