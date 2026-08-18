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
      padding: 0.55rem 1.25rem;
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
    @media (max-width: 640px) {
      .sim-banner a { margin-left: 0; }
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
      <span>Every container, request, and log line is generated in your browser, so it runs on GitHub Pages with no Docker.</span>
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
