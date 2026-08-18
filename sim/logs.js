// Request logs, formatted exactly as the Control Panel's formattedLogs() helper
// renders them, so the lessons' <pre> panels receive identical text.
// Lines are plain arrays so lesson state serialises straight into sessionStorage.
window.SiliconLanesSim = window.SiliconLanesSim || {};

(function (sim) {
  // docker-manager keeps the last 30 request lines; the Nginx panels keep 40.
  sim.pushLine = function pushLine(lines, line, keep = 30) {
    lines.push(line);
    while (lines.length > keep) lines.shift();
    return lines;
  };

  sim.renderLines = (lines, emptyMessage) => (lines.length ? lines.join("\n") : emptyMessage);

  // [request] $iso GET /api/products  ->  "$iso  GET  /api/products"
  sim.serviceLine = (method, uri) => `${sim.isoTimestamp()}  ${method}  ${uri}`;

  // [proxy] ... cache=$upstream_cache_status
  sim.proxyLine = (method, uri, status, cacheStatus) =>
    `${sim.isoTimestamp()}  ${method}  ${uri}  ${status}  cache=${cacheStatus}`;

  // [lb] ... server=$upstream
  sim.loadBalancerLine = (method, uri, status, server) =>
    `${sim.isoTimestamp()}  ${method}  ${uri}  ${status}  → ${server}`;
}(window.SiliconLanesSim));
