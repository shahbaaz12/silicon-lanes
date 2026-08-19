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

    /* Highlights use the site's own two accents, which every lesson stylesheet
       defines and theme.css re-points for the light theme. Lime marks what the
       reader can go and do; cyan marks the infrastructure they would be running.
       The paragraphs are dimmed slightly, so highlighted runs go back to full
       opacity to keep their contrast. */
    .sim-banner .hl-do,
    .sim-banner .hl-infra { opacity: 1; }
    .sim-banner .hl-do { color: var(--lime, #c7f36b); font-weight: 700; }
    .sim-banner .hl-infra { color: var(--cyan, #69d9ec); font-weight: 600; }
    .sim-banner .hl-headline {
      color: var(--lime, #c7f36b);
      font-weight: 700;
      padding: 0.12em 0.45em;
      margin-left: -0.45em;
      border-radius: 0.35em;
      background: color-mix(in srgb, var(--lime, #c7f36b) 15%, transparent);
    }
    /* The site uses lime as a button fill, never as text on a pale background,
       where it measures about 2.6:1. Darkened here so the light theme clears the
       4.5:1 minimum; the tint behind the headline is left alone. */
    html[data-theme="light"] .sim-banner .hl-do,
    html[data-theme="light"] .sim-banner .hl-headline {
      color: color-mix(in srgb, var(--lime, #76a929) 68%, #000);
    }
    /* Cyan lands at 4.37:1 on the pale background. A slight darkening clears 4.5
       with no visible shift in hue. */
    html[data-theme="light"] .sim-banner .hl-infra {
      color: color-mix(in srgb, var(--cyan, #087f93) 90%, #000);
    }
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

    /* Hide control, and the pull tab that brings the panel back. The choice is
       remembered per browser, so the note does not reappear on every lesson. */
    .sim-banner { position: relative; }
    .sim-banner-hide {
      position: absolute;
      /* On narrow screens the button sits over the tag line, which otherwise wins
         the hit test and makes it untappable. */
      z-index: 1;
      top: 0.75rem;
      /* Tracks the theme toggle rather than guessing at a gap. The toggle is fixed
         at right: max(20px, (100vw - 1440px) / 2) and is 88px wide, so on wide
         screens it moves inward with the centred layout and a constant offset here
         would collide again. 88px for the toggle, 12px of clearance. */
      right: calc(max(20px, (100vw - 1440px) / 2) + 100px);
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.3rem 0.7rem;
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 2rem;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      opacity: 0.7;
      cursor: pointer;
    }
    .sim-banner-hide:hover {
      opacity: 1;
      background: color-mix(in srgb, currentColor 10%, transparent);
    }
    .sim-banner-show {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
      padding: 0.4rem 1rem;
      border: 0;
      border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      background: color-mix(in srgb, currentColor 7%, transparent);
      color: inherit;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      /* Sits clear of the theme toggle, which is fixed at the top right. */
      padding-right: 7rem;
      cursor: pointer;
    }
    .sim-banner-show:hover { background: color-mix(in srgb, currentColor 13%, transparent); }
    .sim-banner-show .sim-banner-show-arrow { opacity: 0.7; }

    @media (max-width: 760px) {
      .sim-banner { padding: 1.35rem 1.15rem 1.5rem; }
      .sim-banner-hide { top: 0.5rem; }
      .sim-banner-show { padding-right: 4rem; }
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

  // Remembered across pages and visits: being told the same thing on all nine
  // pages is worse than being told once. localStorage, not sessionStorage, so
  // the choice survives a reload.
  const hiddenKey = "silicon-lanes-note-hidden";
  const isHidden = () => {
    try {
      return window.localStorage.getItem(hiddenKey) === "true";
    } catch {
      return false;
    }
  };
  const remember = (hidden) => {
    try {
      window.localStorage.setItem(hiddenKey, String(hidden));
    } catch {
      // Private mode refuses writes; the toggle still works for this page view.
    }
  };

  function render() {
    if (document.querySelector(".sim-banner")) return;

    const style = document.createElement("style");
    style.textContent = styles;
    document.head.append(style);

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "sim-banner-show";
    tab.hidden = true;
    tab.innerHTML = `<span class="sim-banner-show-arrow" aria-hidden="true">&darr;</span>
      <span>Simulated demo &mdash; show the note</span>`;

    const banner = document.createElement("aside");
    banner.className = "sim-banner";
    banner.innerHTML = `
      <button type="button" class="sim-banner-hide">Hide <span aria-hidden="true">&uarr;</span></button>
      <div class="sim-banner-inner">
        <p class="sim-banner-tag">Simulated demo</p>
        <h2>Every container, request, and log line here is generated in your browser.</h2>
        <p class="sim-banner-lead">
          Nothing is installed and nothing is running. This site imitates the real project
          closely enough to teach the same lessons, which is exactly why it should say so.
        </p>
        <p>
          <span class="hl-headline">The real thing is one click away.</span> Clone the repository,
          start the control panel, and each lesson launches
          <span class="hl-infra">actual Docker containers</span> on demand &mdash;
          <span class="hl-infra">Nginx reverse proxies</span>,
          <span class="hl-infra">Layer&nbsp;4 and Layer&nbsp;7 load balancers</span>,
          <span class="hl-infra">API gateways</span>, a <span class="hl-infra">local CDN</span>,
          and <span class="hl-infra">six Express services on PostgreSQL</span>. Kill a replica and
          watch traffic actually fail over.
        </p>
        <p>
          Every lesson hands you a <span class="hl-do">copyable cURL command</span>, so you can hit
          the running containers yourself from <span class="hl-do">Postman</span> or a terminal and
          read the real response headers.
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
    function setHidden(hidden, { persist = true } = {}) {
      banner.hidden = hidden;
      tab.hidden = !hidden;
      if (persist) remember(hidden);
    }

    banner.querySelector(".sim-banner-hide").addEventListener("click", () => {
      setHidden(true);
      tab.focus();
    });
    tab.addEventListener("click", () => {
      setHidden(false);
      banner.querySelector(".sim-banner-hide").focus();
    });

    document.body.prepend(banner);
    document.body.prepend(tab);
    setHidden(isHidden(), { persist: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
}(window.SiliconLanesSim));
