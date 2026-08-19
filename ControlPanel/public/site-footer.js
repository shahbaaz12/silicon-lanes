// The closing note appended to the bottom of every page.
//
// Ported from the published site's sim/footer.js so the local project and the hosted
// walkthrough end the same way. Two deliberate differences: the markup is named site-footer
// rather than sim-footer (nothing here is a simulation), and the styles live in theme.css,
// which every page already loads, rather than being injected as a <style> tag.
//
// Written in the author's own voice, since it is an invitation from them rather than a
// notice from the site.

const CONTACT_URL = "https://www.linkedin.com/in/shabaaz12/";

function render() {
  if (document.querySelector(".site-footer")) return;

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="site-footer-inner">
      <h2>Thanks for making it this far.</h2>
      <p>
        If something here helped, if you spotted a mistake, or if you just want to talk
        about system design &mdash; <span class="site-footer-warm">say hi</span>. I read
        every message, and I reply to every one of them.
      </p>
      <a class="site-footer-cta" href="${CONTACT_URL}" target="_blank" rel="noopener">
        Say hi on LinkedIn <span>&rarr;</span>
      </a>
      <p class="site-footer-note">Corrections are genuinely welcome.</p>
    </div>
  `;
  document.body.append(footer);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", render, { once: true });
} else {
  render();
}
