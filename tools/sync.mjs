// Copies the browser-facing files from the original silicon-lanes project and
// rewrites root-relative URLs so the site works from a GitHub Pages subpath.
//
// The lesson files are copied verbatim apart from those URL rewrites: the
// simulation is injected by sim/fetch-shim.js at runtime, never by editing
// a lesson's app.js. Re-run this after changing anything in the original.

import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const staticRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(staticRoot, "..", "silicon-lanes");
const sourceRepositoryUrl = "https://github.com/shahbaaz12/silicon-lanes";

const lessons = [
  "lesson-01-direct-service",
  "lesson-02-reverse-proxy",
  "lesson-03-l7-load-balancer",
  "lesson-04-api-gateway",
  "lesson-05-hybrid",
  "lesson-06-advanced",
  "lesson-07-local-cdn",
  "lesson-08-request-path"
];

// Deliberate exclusions:
//   service-lab.html, index.js  the Service Lab starts real containers, so it is
//                               not part of the static build
//   home.js                     replaced by our own copy, which reports simulated
//                               mode instead of pinging Docker. Do not add it back
//                               here or the sync will overwrite that file.
const controlPanelFiles = ["index.html", "progress.js", "kill-all.js", "shared/ui.js", "styles.css", "theme.css", "theme.js", "404.html"];

// Wording that would be untrue in a build with no containers behind it. Applied to
// the original text before URLs are rewritten.
const staticAdjustments = {
  "index.html": [
    [
      /Start and inspect the independent services behind the lessons\.\s*Create replicas,\s*observe their ports, and see which instance handles each request\./,
      "Starting replicas and executing requests against them needs real containers, "
        + "so the Service Lab lives in the Docker project rather than in this simulated build."
    ],
    [/Open the Service Lab /, "See the Service Lab on GitHub "]
  ]
};

const rewritable = new Set([".html", ".js", ".css"]);

function prefixFor(relativePath) {
  const depth = relativePath.split("/").length - 1;
  return depth === 0 ? "." : Array(depth).fill("..").join("/");
}

function rewrite(contents, relativePath) {
  const prefix = prefixFor(relativePath);

  const resolve = (absolute) => {
    if (absolute === "/") return `${prefix}/index.html`;
    if (absolute === "/service-lab") return sourceRepositoryUrl;
    const lessonDirectory = absolute.match(/^\/lessons\/(lesson-[^/]+)\/?$/);
    if (lessonDirectory) return `${prefix}/lessons/${lessonDirectory[1]}/index.html`;
    return `${prefix}${absolute}`;
  };

  return contents
    // href="/..." and src="/..."
    .replace(/\b(href|src)=(["'])(\/[^"']*)\2/g, (_match, attribute, quote, url) =>
      `${attribute}=${quote}${resolve(url)}${quote}`)
    // ES module: from "/..."
    .replace(/\bfrom\s+(["'])(\/[^"']*)\1/g, (_match, quote, url) =>
      `from ${quote}${resolve(url)}${quote}`)
    // Dynamic import("/...")
    .replace(/\bimport\((["'])(\/[^"']*)\1\)/g, (_match, quote, url) =>
      `import(${quote}${resolve(url)}${quote})`)
    // CSS url(/...)
    .replace(/\burl\(\s*(["']?)(\/[^"')]*)\1\s*\)/g, (_match, quote, url) =>
      `url(${quote}${resolve(url)}${quote})`);
}

// The lesson pages are otherwise copied verbatim; the simulation is injected here
// rather than edited into any app.js. These are classic scripts, so they run before
// the lessons' deferred ES modules and window.fetch is replaced in time.
const simulationScripts = ["fixtures.js", "logs.js", "lessons.js", "lessons-advanced.js", "fetch-shim.js", "home-note.js", "footer.js"];

function injectSimulation(contents, relativePath) {
  const prefix = prefixFor(relativePath);
  const tags = [
    "    <!-- Simulation layer: stands in for the Control Panel API and Docker containers. -->",
    ...simulationScripts.map((file) => `    <script src="${prefix}/sim/${file}"></script>`)
  ].join("\n");
  return contents.replace(/([ \t]*)<\/head>/, `${tags}\n$1</head>`);
}

async function copyFile(from, to, relativePath) {
  if (!rewritable.has(path.extname(to))) {
    await cp(from, to);
    return { relativePath, rewritten: false };
  }
  const original = await readFile(from, "utf8");
  let updated = original;
  for (const [pattern, replacement] of staticAdjustments[relativePath] ?? []) {
    if (!pattern.test(updated)) {
      console.error(`  ! adjustment no longer matches in ${relativePath}: ${pattern}`);
      process.exitCode = 1;
    }
    updated = updated.replace(pattern, replacement);
  }
  updated = rewrite(updated, relativePath);
  if (path.extname(to) === ".html") updated = injectSimulation(updated, relativePath);
  await mkdir(path.dirname(to), { recursive: true });
  await writeFile(to, updated);
  return { relativePath, rewritten: updated !== original };
}

async function copyDirectory(from, toRelative) {
  const results = [];
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const childRelative = `${toRelative}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...await copyDirectory(path.join(from, entry.name), childRelative));
    } else {
      await mkdir(path.join(staticRoot, toRelative), { recursive: true });
      results.push(await copyFile(path.join(from, entry.name), path.join(staticRoot, childRelative), childRelative));
    }
  }
  return results;
}

async function sync() {
  const results = [];

  await rm(path.join(staticRoot, "lessons"), { recursive: true, force: true });

  for (const file of controlPanelFiles) {
    results.push(await copyFile(
      path.join(source, "ControlPanel", "public", file),
      path.join(staticRoot, file),
      file
    ));
  }

  results.push(...await copyDirectory(path.join(source, "Lessons", "shared"), "lessons/shared"));

  for (const lesson of lessons) {
    results.push(...await copyDirectory(
      path.join(source, "Lessons", lesson, "public"),
      `lessons/${lesson}`
    ));
  }

  const rewritten = results.filter((result) => result.rewritten);
  console.log(`Copied ${results.length} files, rewrote URLs in ${rewritten.length}:`);
  for (const result of rewritten) console.log(`  ${result.relativePath}`);

  const remaining = [];
  for (const result of results) {
    if (!rewritable.has(path.extname(result.relativePath))) continue;
    const contents = await readFile(path.join(staticRoot, result.relativePath), "utf8");
    const leftovers = contents.match(/\b(?:href|src)=["']\/[^"']*["']/g) ?? [];
    if (leftovers.length) remaining.push(`${result.relativePath}: ${leftovers.join(", ")}`);
  }
  if (remaining.length) {
    console.error("\nRoot-relative URLs still present (these would 404 on Pages):");
    for (const line of remaining) console.error(`  ${line}`);
    process.exitCode = 1;
  } else {
    console.log("\nNo root-relative URLs remain.");
  }
}

await sync();
