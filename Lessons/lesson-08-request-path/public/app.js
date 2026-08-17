// This lesson is static reading material — everything here runs entirely in the browser.
// No fetch calls, no lesson API, no Docker. The only job of this file is to drive the
// step-through diagram: highlight the right node(s) and swap the explanation panel text.

const steps = [
  {
    nodeIds: ["step-client"],
    title: "Your browser knows a name, not an address.",
    body: "It knows <code>yourapp.com</code>. It has no idea what IP address that is, or which of the (possibly many) computers behind it should answer. That's the very first thing that has to be resolved, before a single packet aimed at your application goes anywhere."
  },
  {
    nodeIds: ["step-dns"],
    title: "DNS hands back one address — the same one, for everyone.",
    body: "The resolver walks the DNS hierarchy and returns an IP. If that IP belongs to a CDN using anycast, every client on the planet gets back the identical address. DNS is not choosing a nearby server here — it can't. There's only one answer to give."
  },
  {
    nodeIds: ["step-bgp"],
    title: "Now a completely different system decides where that address actually leads.",
    body: "Your device sends a packet toward that IP. Because the very same address is announced from multiple physical locations at once, the routers between you and the internet — your ISP, transit providers — use BGP to independently agree on the best path to it. This is a network-layer decision, made hop by hop, with no awareness that DNS was ever involved."
  },
  {
    nodeIds: ["step-pop"],
    title: "You arrive at whichever location BGP chose.",
    body: "Usually, though not guaranteed, that's the topologically nearest one — BGP optimizes for network cost, not the map. A TCP handshake happens, then TLS. This is exactly where Lesson 7 begins: from here, it's a cache lookup at the CDN edge."
  },
  {
    nodeIds: ["step-edge", "step-gateway", "step-l7lb"],
    title: "On a MISS or BYPASS, it's the exact chain you already built.",
    body: "The CDN forwards to its configured origin. In Lessons 6 and 7 that's an L4 Edge Load Balancer, spreading connections across API Gateway instances, one of which routes Products onward to an L7 Catalog Load Balancer — the same three boxes, doing the same jobs, as everywhere else in this project."
  },
  {
    nodeIds: ["step-client", "step-dns", "step-bgp", "step-pop", "step-edge", "step-gateway", "step-l7lb"],
    title: "Same request, two worlds.",
    body: "The first half — DNS, anycast, BGP — happens on the open internet, outside anything you control, before your infrastructure ever sees a packet. The second half is everything you've spent seven lessons building by hand. Both halves are doing the same kind of work: deciding, one hop at a time, exactly which machine should answer."
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
  el.next.textContent = current === steps.length - 1 ? "Restart from the top →" : "Next →";
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
