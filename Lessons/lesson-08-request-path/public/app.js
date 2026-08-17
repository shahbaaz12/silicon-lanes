// This lesson is static reading material — everything here runs entirely in the browser.
// No fetch calls, no lesson API, no Docker. The only job of this file is to drive the
// step-through diagram: highlight the right node(s) and swap the explanation panel text.

const steps = [
  {
    nodeIds: ["step-client"],
    title: "You type a name. Your browser has no idea what that means yet.",
    body: "It has <code>yourapp.com</code>, which is a word, and words don't work on a network. Before a single byte can be sent anywhere, that word has to become a number."
  },
  {
    nodeIds: ["step-dns"],
    title: "DNS turns the name into a number — the same number for everyone.",
    body: "The lookup comes back with an address like <code>203.0.113.10</code>. If that address belongs to a provider using anycast, then every person on Earth asking this same question gets this same answer. DNS isn't picking somewhere near you. It only has one answer to give, and it doesn't know where you are."
  },
  {
    nodeIds: ["step-bgp"],
    title: "Now something completely different decides where that number leads.",
    body: "Your data sets off toward that address. Because many locations are all announcing it at once, the networks along the way compare the paths they know about and forward you down whichever looks cheapest. This is happening in the routers, long after DNS finished, with no knowledge that DNS was ever involved."
  },
  {
    nodeIds: ["step-pop"],
    title: "You arrive wherever the routing decided.",
    body: "Usually that's the nearest location, though it counts networks crossed rather than kilometres, so it's occasionally a surprise. Your connection gets established here — and this is precisely where Lesson 7 picks up the story, with a cache lookup at the edge."
  },
  {
    nodeIds: ["step-edge", "step-gateway", "step-l7lb"],
    title: "If the cache doesn't have it, it's the chain you already built.",
    body: "The CDN forwards the request to its origin. In Lessons 6 and 7, that's the L4 Edge Load Balancer spreading connections across API Gateways, one of which sends Product requests onward to the L7 Catalog Load Balancer — the same boxes doing the same jobs you've already watched work."
  },
  {
    nodeIds: ["step-client", "step-dns", "step-bgp", "step-pop", "step-edge", "step-gateway", "step-l7lb"],
    title: "One request, two worlds.",
    body: "The first half runs on the open internet, on infrastructure nobody at your company operates, before your servers know a request exists. The second half is entirely yours. But both halves are doing the same thing: narrowing down, one decision at a time, exactly which machine ends up answering."
  }
];

let current = 0;

const el = {
  prev: document.querySelector("#step-prev"),
  next: document.querySelector("#step-next"),
  counter: document.querySelector("#step-counter"),
  dots: document.querySelector("#step-dots"),
  title: document.querySelector("#step-title"),
  body: document.querySelector("#step-body")
};

el.dots.innerHTML = steps.map(() => "<i></i>").join("");
const dotEls = [...el.dots.children];

function highlight(index) {
  for (const step of steps) {
    for (const nodeId of step.nodeIds) {
      document.querySelector(`#${nodeId}`)?.classList.remove("lesson-node-active");
    }
  }
  const step = steps[index];
  window.requestAnimationFrame(() => {
    for (const nodeId of step.nodeIds) {
      document.querySelector(`#${nodeId}`)?.signalActivity?.(1400);
    }
  });
}

function render() {
  const step = steps[current];
  el.counter.textContent = `Step ${current + 1} of ${steps.length}`;
  el.title.textContent = step.title;
  el.body.innerHTML = step.body;
  dotEls.forEach((dot, index) => dot.classList.toggle("active", index === current));
  el.prev.disabled = current === 0;
  el.next.textContent = current === steps.length - 1 ? "Start over →" : "Next →";
  highlight(current);
}

el.prev.addEventListener("click", () => {
  if (current === 0) return;
  current -= 1;
  render();
});

el.next.addEventListener("click", () => {
  current = current === steps.length - 1 ? 0 : current + 1;
  render();
});

render();
