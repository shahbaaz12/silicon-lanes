// The "simulated demo" note, shown as a card on the home page only.
//
// It used to be a banner pinned to the top of every page. As a single home-page
// component it needs no collapse control: it appears once, in the flow of the
// landing page, rather than in front of every lesson.
window.SiliconLanesSim = window.SiliconLanesSim || {};

(function (sim) {
  // Set before the early return below, so other scripts can rely on it on any page.
  sim.repositoryUrl = "https://github.com/shahbaaz12/silicon-lanes";
  sim.repositoryLabel = "github.com/shahbaaz12/silicon-lanes";

  const styles = `
    .sim-note {
      margin: 0 0 2.5rem;
      padding: 1.75rem 1.75rem 2rem;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      border-radius: 1rem;
      background: color-mix(in srgb, currentColor 6%, transparent);
    }
    .sim-note-tag {
      margin: 0 0 0.6rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.6;
    }
    .sim-note h2 {
      margin: 0 0 0.75rem;
      font-size: clamp(1.25rem, 2.6vw, 1.7rem);
      line-height: 1.25;
      font-weight: 700;
    }
    .sim-note p {
      margin: 0 0 0.9rem;
      max-width: 54rem;
      font-size: 0.95rem;
      line-height: 1.6;
      opacity: 0.85;
    }
    .sim-note p.sim-note-lead { opacity: 1; }
    .sim-note code {
      padding: 0.1em 0.4em;
      border-radius: 0.3em;
      font-size: 0.9em;
      background: color-mix(in srgb, currentColor 12%, transparent);
    }
    /* Lime marks what the reader can go and do. The paragraphs are dimmed slightly,
       so highlighted runs return to full opacity to keep their contrast. */
    .sim-note .hl-do { color: var(--lime, #c7f36b); font-weight: 700; opacity: 1; }
    /* The site uses lime as a button fill, never as text on a pale background,
       where it measures about 2.6:1. Darkened here to clear the 4.5:1 minimum. */
    html[data-theme="light"] .sim-note .hl-do {
      color: color-mix(in srgb, var(--lime, #76a929) 68%, #000);
    }
    .sim-note-needs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0 0 1.4rem;
      padding: 0;
      list-style: none;
    }
    .sim-note-needs li {
      padding: 0.35rem 0.75rem;
      border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
      border-radius: 2rem;
      font-size: 0.82rem;
      white-space: nowrap;
    }
    .sim-note-needs li b { font-weight: 700; }
    .sim-note-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.8rem 1.35rem;
      border: 2px solid currentColor;
      border-radius: 0.6rem;
      font-size: clamp(0.95rem, 2.2vw, 1.1rem);
      font-weight: 700;
      text-decoration: none;
      color: inherit;
      word-break: break-all;
    }
    /* Tinting rather than inverting: the site's theme toggle is independent of the
       OS, so a system colour could land the same shade as the label. */
    .sim-note-cta:hover { background: color-mix(in srgb, currentColor 15%, transparent); }
    .sim-note-cta span { opacity: 0.7; font-weight: 600; }

    @media (max-width: 760px) {
      .sim-note { margin-bottom: 2rem; padding: 1.35rem 1.15rem 1.5rem; }
      .sim-note p { font-size: 0.9rem; }
      .sim-note-cta { width: 100%; justify-content: center; text-align: center; }
    }
  `;

  // Lesson pages live under /lessons/; everything else is the landing page.
  function isHomePage() {
    return !/\/lessons\//.test(window.location.pathname);
  }

  function render() {
    if (!isHomePage() || document.querySelector(".sim-note")) return;

    const main = document.querySelector("main");
    if (!main) return;

    const style = document.createElement("style");
    style.textContent = styles;
    document.head.append(style);

    const note = document.createElement("section");
    note.className = "sim-note";
    note.setAttribute("aria-labelledby", "sim-note-heading");
    note.innerHTML = `
      <p class="sim-note-tag">Simulated demo</p>
      <h2 id="sim-note-heading">Every container, request, and log line here is generated in your browser.</h2>
      <p class="sim-note-lead">
        Nothing is installed and nothing is running. This site imitates the real project
        closely enough to teach the same lessons, which is exactly why it should say so.
      </p>
      <p>
        Every lesson hands you a <span class="hl-do">copyable cURL command</span>, so you can hit
        the running containers yourself from <span class="hl-do">Postman</span> or a terminal and
        read the real response headers.
      </p>
      <ul class="sim-note-needs">
        <li><b>All you need:</b></li>
        <li>Docker Desktop</li>
        <li>Node.js 22+</li>
        <li><code>npm install &amp;&amp; npm start</code></li>
      </ul>
      <a class="sim-note-cta" href="${sim.repositoryUrl}" target="_blank" rel="noopener">
        ${sim.repositoryLabel} <span>&rarr;</span>
      </a>
    `;

    // Sits after the hero so the landing page still opens with its own headline.
    const hero = main.querySelector(".hero, .landing-hero");
    if (hero) hero.after(note);
    else main.prepend(note);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
}(window.SiliconLanesSim));
