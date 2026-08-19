// A dismissible note pointing at the hosted, Docker-free walkthrough.
//
// Mounted the same way as theme.js, kill-all.js and progress.js: served from the Control
// Panel's public root, loaded with a plain script tag, and inserting itself into the page so
// no page needs its own markup.
//
// Both states live in the normal document flow rather than being fixed-position. The top-right
// corner already holds the theme toggle and the bottom-left the Kill all button, so a third
// floating element would have to negotiate with both; keeping this inline sidesteps that
// entirely and keeps the layout stable when it collapses.
//
// The dismissal is remembered per browser, so hiding it on one lesson hides it everywhere.

const STORAGE_KEY = "silicon-lanes-browse-note-hidden";
const STATIC_URL = "https://shahbaaz12.github.io/silicon-lanes/index.html";

function isHidden() {
  try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
}

function remember(hidden) {
  try { localStorage.setItem(STORAGE_KEY, String(hidden)); } catch { /* private mode — session only */ }
}

function insertionPoint() {
  // Sit directly under the site header where there is one, otherwise at the top of the page.
  const header = document.querySelector(".site-header, .topbar");
  if (header?.parentElement) return (node) => header.after(node);
  const main = document.querySelector("main");
  if (main) return (node) => main.prepend(node);
  return (node) => document.body.prepend(node);
}

function mount() {
  const note = document.createElement("aside");
  note.className = "browse-note";
  note.innerHTML = `
    <div class="browse-note-inner">
      <span class="browse-note-text">
        Prefer to just look around? You can read every lesson with
        <strong>no Docker and nothing to install</strong>.
      </span>
      <a class="browse-note-link" href="${STATIC_URL}" target="_blank" rel="noreferrer">Open the walkthrough &rarr;</a>
      <button class="browse-note-hide" type="button" aria-label="Hide this note">Hide</button>
    </div>
  `;

  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "browse-note-tab";
  tab.innerHTML = '<span aria-hidden="true">&#9662;</span><span>Browse without Docker</span>';
  tab.setAttribute("aria-label", "Show the no-Docker walkthrough note");

  const apply = (hidden) => {
    note.hidden = hidden;
    tab.hidden = !hidden;
  };

  note.querySelector(".browse-note-hide").addEventListener("click", () => {
    apply(true);
    remember(true);
    tab.focus();
  });

  tab.addEventListener("click", () => {
    apply(false);
    remember(false);
    note.querySelector(".browse-note-link").focus();
  });

  apply(isHidden());
  const insert = insertionPoint();
  insert(tab);
  insert(note);
}

// Nothing to advertise when the reader is already on the hosted walkthrough.
if (!/github\.io$/i.test(window.location.hostname)) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
}
