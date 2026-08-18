// The attribution bar shown on every page.
//
// This build looks and behaves like the real project, so it has to say plainly
// that nothing here is a real container, and point at the repository where the
// Docker version lives.
window.SiliconLanesSim = window.SiliconLanesSim || {};

(function (sim) {
  sim.repositoryUrl = "https://github.com/shahbaaz12/silicon-lanes";

  const styles = `
    .sim-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.35rem 0.75rem;
      /* The shared theme toggle is position:fixed at the top right with z-index 100.
         Without this reserved space it sits on top of the link and swallows the click. */
      padding: 0.55rem 7.5rem 0.55rem 1.25rem;
      font-size: 0.82rem;
      line-height: 1.45;
      background: color-mix(in srgb, currentColor 6%, transparent);
      border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    }
    .sim-banner strong { font-weight: 650; }
    .sim-banner span { opacity: 0.75; }
    .sim-banner a {
      margin-left: auto;
      font-weight: 600;
      white-space: nowrap;
      text-decoration: underline;
      text-underline-offset: 0.2em;
      color: inherit;
    }
    .sim-banner a:hover { opacity: 0.75; }
    /* Declared before the media query: these rules have equal specificity, so
       whichever comes last would otherwise win at every width. */
    .sim-banner .sim-banner-short { display: none; }
    @media (max-width: 640px) {
      /* Three wrapped lines cost too much of a small screen, so the long
         explanation gives way to the short one. */
      .sim-banner { padding-right: 6rem; }
      .sim-banner a { margin-left: 0; }
      .sim-banner .sim-banner-long { display: none; }
      .sim-banner .sim-banner-short { display: inline; }
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
      <strong>Simulated demo.</strong>
      <span class="sim-banner-long">Every container, request, and log line is generated in your browser, so it runs on GitHub Pages with no Docker.</span>
      <span class="sim-banner-short">No Docker &mdash; it all runs in your browser.</span>
      <a href="${sim.repositoryUrl}" target="_blank" rel="noopener">Try it for real &rarr;</a>
    `;
    document.body.prepend(banner);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
}(window.SiliconLanesSim));
