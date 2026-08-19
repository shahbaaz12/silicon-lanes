// The panel shown at the top of every page.
//
// This build looks and behaves like the real project, so it has to say plainly
// that nothing here is a real container -- and, just as importantly, that the
// Docker version is a short setup away and what running it actually requires.
window.SiliconLanesSim = window.SiliconLanesSim || {};

(function (sim) {
  sim.repositoryUrl = "https://github.com/shahbaaz12/silicon-lanes";
  sim.repositoryLabel = "github.com/shahbaaz12/silicon-lanes";

  const styles = `
    .sim-banner {
      /* Colours are derived from the page's own text colour, so the panel follows
         whichever theme the site is in without hardcoding either palette. */
      background: color-mix(in srgb, currentColor 7%, transparent);
      border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      padding: 2rem 1.5rem 2.25rem;
    }
    .sim-banner-inner {
      max-width: 62rem;
      margin: 0 auto;
      /* Keeps the first line clear of the theme toggle, which is fixed top-right. */
      padding-right: 6rem;
    }
    .sim-banner-tag {
      margin: 0 0 0.6rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.6;
    }
    .sim-banner h2 {
      margin: 0 0 0.75rem;
      font-size: clamp(1.35rem, 3vw, 1.9rem);
      line-height: 1.2;
      font-weight: 700;
    }
    .sim-banner p {
      margin: 0 0 0.85rem;
      max-width: 54rem;
      font-size: 0.95rem;
      line-height: 1.6;
      opacity: 0.85;
    }
    .sim-banner p.sim-banner-lead { opacity: 1; }
    .sim-banner strong { font-weight: 700; }
    .sim-banner code {
      padding: 0.1em 0.4em;
      border-radius: 0.3em;
      font-size: 0.9em;
      background: color-mix(in srgb, currentColor 12%, transparent);
    }
    .sim-banner-needs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0 0 1.4rem;
      padding: 0;
      list-style: none;
    }
    .sim-banner-needs li {
      padding: 0.35rem 0.75rem;
      border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
      border-radius: 2rem;
      font-size: 0.82rem;
      white-space: nowrap;
    }
    .sim-banner-needs li b { font-weight: 700; }
    .sim-banner-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.85rem 1.4rem;
      border: 2px solid currentColor;
      border-radius: 0.6rem;
      font-size: clamp(0.95rem, 2.2vw, 1.15rem);
      font-weight: 700;
      text-decoration: none;
      color: inherit;
      word-break: break-all;
    }
    .sim-banner-cta:hover {
      /* Deliberately not an inversion: the site's own theme toggle is independent
         of the OS, so a system colour like Canvas can land the same shade as the
         text. Tinting keeps the label readable in every combination. */
      background: color-mix(in srgb, currentColor 15%, transparent);
    }
    .sim-banner-cta span { opacity: 0.7; font-weight: 600; }

    @media (max-width: 760px) {
      .sim-banner { padding: 1.35rem 1.15rem 1.5rem; }
      .sim-banner-inner { padding-right: 3.5rem; }
      .sim-banner p { font-size: 0.88rem; line-height: 1.5; margin-bottom: 0.7rem; }
      /* At full length this panel filled an entire phone screen, leaving no sign
         that a lesson was below it. The heading already makes the point the lead
         paragraph repeats, so that one goes. */
      .sim-banner-lead { display: none; }
      .sim-banner h2 { margin-bottom: 0.6rem; }
      .sim-banner-needs { margin-bottom: 1.1rem; gap: 0.4rem; }
      .sim-banner-needs li { padding: 0.3rem 0.6rem; font-size: 0.78rem; }
      .sim-banner-cta { width: 100%; justify-content: center; text-align: center; }
    }
  `;

  function render() {
    if (document.querySelector(".sim-banner")) return;

    const style = document.createElement("style");
    style.textContent = styles;
    document.head.append(style);

    const banner = document.createElement("aside");
    banner.className = "sim-banner";
    banner.innerHTML = `
      <div class="sim-banner-inner">
        <p class="sim-banner-tag">Simulated demo</p>
        <h2>Every container, request, and log line here is generated in your browser.</h2>
        <p class="sim-banner-lead">
          Nothing is installed and nothing is running. This site imitates the real project
          closely enough to teach the same lessons, which is exactly why it should say so.
        </p>
        <p>
          <strong>The real thing is one click away.</strong> Clone the repository, start the
          control panel, and each lesson launches genuine Docker containers on demand &mdash;
          Nginx reverse proxies, Layer&nbsp;4 and Layer&nbsp;7 load balancers, API gateways, a
          local CDN, and six independent Express services backed by PostgreSQL. Kill a replica
          and watch traffic actually fail over.
        </p>
        <p>
          Every lesson hands you a <strong>copyable cURL command</strong>, so you can hit the
          running containers yourself from <strong>Postman</strong> or a terminal and read the
          real response headers.
        </p>
        <ul class="sim-banner-needs">
          <li><b>All you need:</b></li>
          <li>Docker Desktop</li>
          <li>Node.js 22+</li>
          <li><code>npm install &amp;&amp; npm start</code></li>
        </ul>
        <a class="sim-banner-cta" href="${sim.repositoryUrl}" target="_blank" rel="noopener">
          ${sim.repositoryLabel} <span>&rarr;</span>
        </a>
      </div>
    `;
    document.body.prepend(banner);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
}(window.SiliconLanesSim));
