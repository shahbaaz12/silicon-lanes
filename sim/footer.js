// The closing note appended to the bottom of every page.
//
// Written in the author's own voice, since it is an invitation from them rather
// than a notice from the site.
window.SiliconLanesSim = window.SiliconLanesSim || {};

(function (sim) {
  sim.contactUrl = "https://www.linkedin.com/in/shabaaz12/";

  const styles = `
    .sim-footer {
      margin-top: 3rem;
      padding: 3rem 1.5rem 3.5rem;
      border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      background: color-mix(in srgb, currentColor 5%, transparent);
      text-align: center;
    }
    .sim-footer-inner { max-width: 40rem; margin: 0 auto; }
    .sim-footer h2 {
      margin: 0 0 0.7rem;
      font-size: clamp(1.2rem, 2.6vw, 1.55rem);
      line-height: 1.25;
      font-weight: 700;
    }
    .sim-footer p {
      margin: 0 0 1.6rem;
      font-size: 0.95rem;
      line-height: 1.65;
      opacity: 0.85;
    }
    .sim-footer .sim-footer-warm {
      color: var(--cyan, #69d9ec);
      font-weight: 600;
      opacity: 1;
    }
    /* Cyan sits at about 4.4:1 on the pale background, so it is nudged darker to
       clear the 4.5:1 minimum without a visible shift in hue. */
    html[data-theme="light"] .sim-footer .sim-footer-warm {
      color: color-mix(in srgb, var(--cyan, #087f93) 90%, #000);
    }
    .sim-footer-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.8rem 1.5rem;
      border: 2px solid currentColor;
      border-radius: 0.6rem;
      font-size: 1rem;
      font-weight: 700;
      text-decoration: none;
      color: inherit;
    }
    /* Tinting rather than inverting, for the same reason as the top panel: the
       site's theme toggle is independent of the OS. */
    .sim-footer-cta:hover { background: color-mix(in srgb, currentColor 15%, transparent); }
    .sim-footer-cta span { opacity: 0.7; font-weight: 600; }
    .sim-footer-note {
      margin: 1.6rem 0 0;
      font-size: 0.82rem;
      /* 0.6 would blend this small text to roughly 4.3:1 on the light theme.
         0.7 keeps it visibly secondary while clearing the minimum. */
      opacity: 0.7;
    }
    .sim-footer-note a { color: inherit; text-decoration: underline; text-underline-offset: 0.2em; }

    @media (max-width: 760px) {
      .sim-footer { margin-top: 2rem; padding: 2.25rem 1.15rem 2.5rem; }
      .sim-footer-cta { width: 100%; justify-content: center; }
    }
  `;

  function render() {
    if (document.querySelector(".sim-footer")) return;

    const style = document.createElement("style");
    style.textContent = styles;
    document.head.append(style);

    const footer = document.createElement("footer");
    footer.className = "sim-footer";
    footer.innerHTML = `
      <div class="sim-footer-inner">
        <h2>Thanks for making it this far.</h2>
        <p>
          If something here helped, if you spotted a mistake, or if you just want to talk
          about system design &mdash; <span class="sim-footer-warm">say hi</span>. I read
          every message, and I reply to every one of them.
        </p>
        <a class="sim-footer-cta" href="${sim.contactUrl}" target="_blank" rel="noopener">
          Say hi on LinkedIn <span>&rarr;</span>
        </a>
        <p class="sim-footer-note">Corrections are genuinely welcome.</p>
      </div>
    `;
    document.body.append(footer);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
}(window.SiliconLanesSim));
