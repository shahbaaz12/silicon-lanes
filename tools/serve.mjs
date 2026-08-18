// Minimal static file server for local preview. No dependencies, and nothing
// like it ships to GitHub Pages -- Pages serves these files itself.
//
//   node tools/serve.mjs        then open http://localhost:7013

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const staticRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 7013);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = path.join(staticRoot, path.normalize(decoded).replace(/^(\.\.[/\\])+/, ""));
  if (!candidate.startsWith(staticRoot)) return null;
  try {
    const info = await stat(candidate);
    // GitHub Pages serves index.html for a directory request; match that.
    return info.isDirectory() ? path.join(candidate, "index.html") : candidate;
  } catch {
    return null;
  }
}

createServer(async (request, response) => {
  const file = await resolveFile(request.url);
  try {
    if (!file) throw new Error("not found");
    const body = await readFile(file);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(body);
  } catch {
    const notFound = await readFile(path.join(staticRoot, "404.html")).catch(() => "Not found");
    response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    response.end(notFound);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`[silicon-lanes-static] http://localhost:${port}`);
});
