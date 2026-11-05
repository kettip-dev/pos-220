const http = require("http");
const { log } = require("./logger");

/**
 * "Printer Tools": a small web page served by the agent on this computer only
 * (http://localhost:17171). Staff use it to see the agent status, find
 * printers, and print test pages without the POS.
 *
 * Safety:
 *  - listens on 127.0.0.1 only, so other computers cannot reach it;
 *  - checks the Host header, so a web page cannot reach it via DNS rebinding;
 *  - actions are POST with a custom header + JSON body, which browsers will not
 *    send cross-site without a CORS preflight (which we never approve);
 *  - never shows or changes the agent token.
 */

const DEFAULT_PORT = 17171;
const MAX_BODY = 4096;

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request too large."), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (_) {
        reject(Object.assign(new Error("Invalid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

/**
 * @param {object} opts
 * @param {number} [opts.port]
 * @param {() => object} opts.getStatus
 * @param {() => Promise<string[]>} opts.listPrinters
 * @param {(target: object, kind: string) => Promise<object>} opts.testPrint
 * @param {(address: string) => Promise<object>} opts.checkPrinter
 * @param {() => Promise<object>} opts.scan
 * @param {() => object[]} opts.recentJobs
 * @param {() => string[]} opts.recentLog
 */
function startDashboard(opts) {
  const port = Number(opts.port) || DEFAULT_PORT;
  const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
  const allowedOrigins = new Set([...allowedHosts].map((h) => `http://${h}`));
  let scanInFlight = null;

  const server = http.createServer(async (req, res) => {
    if (!allowedHosts.has(String(req.headers.host || "").toLowerCase())) {
      return sendJson(res, 403, { error: "Open this page as http://localhost:" + port });
    }
    const url = new URL(req.url, `http://localhost:${port}`);

    try {
      if (req.method === "GET") {
        switch (url.pathname) {
          case "/":
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Frame-Options": "DENY",
              "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'",
            });
            return res.end(PAGE_HTML);
          case "/api/status":
            return sendJson(res, 200, opts.getStatus());
          case "/api/printers":
            return sendJson(res, 200, { printers: await opts.listPrinters() });
          case "/api/jobs":
            return sendJson(res, 200, { jobs: opts.recentJobs() });
          case "/api/log":
            return sendJson(res, 200, { lines: opts.recentLog() });
          default:
            return sendJson(res, 404, { error: "Not found." });
        }
      }

      if (req.method === "POST") {
        const origin = req.headers.origin;
        if (req.headers["x-restro-agent"] !== "1" || (origin && !allowedOrigins.has(origin))) {
          return sendJson(res, 403, { error: "Forbidden." });
        }
        if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
          return sendJson(res, 415, { error: "Expected JSON." });
        }
        const body = await readJson(req);
        switch (url.pathname) {
          case "/api/test-print":
            return sendJson(res, 200, await opts.testPrint(body.target || {}, body.kind === "drawer" ? "drawer" : "page"));
          case "/api/check":
            return sendJson(res, 200, await opts.checkPrinter(String(body.address || "")));
          case "/api/scan":
            if (!scanInFlight) scanInFlight = opts.scan().finally(() => (scanInFlight = null));
            return sendJson(res, 200, await scanInFlight);
          default:
            return sendJson(res, 404, { error: "Not found." });
        }
      }

      sendJson(res, 405, { error: "Method not allowed." });
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.message });
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      log(`Printer Tools page not started: port ${port} is already in use (another copy of the agent is probably running).`);
    } else {
      log(`Printer Tools page error: ${err.message}`);
    }
  });
  server.listen(port, "127.0.0.1", () => log(`Printer Tools: http://localhost:${port}`));
  return server;
}

const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bong POS · Printer Tools</title>
<style>
  :root { --bg:#f4f5f7; --card:#fff; --text:#111827; --muted:#6b7280; --line:#e5e7eb; --brand:#ea580c; --ok:#16a34a; --bad:#dc2626; --warn:#d97706; }
  * { box-sizing: border-box; }
  body { margin:0; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:var(--bg); color:var(--text); }
  header { background:#111827; color:#fff; padding:14px 20px; display:flex; align-items:center; gap:12px; }
  header h1 { font-size:18px; margin:0; font-weight:700; }
  header .sub { color:#9ca3af; font-size:13px; }
  main { max-width:1100px; margin:0 auto; padding:18px; display:grid; gap:16px; grid-template-columns: repeat(auto-fit, minmax(min(330px, 100%), 1fr)); }
  @media (max-width: 520px) { main { padding:10px; gap:10px; } }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; min-width:0; }
  .scroll-x { overflow-x:auto; }
  .card h2 { margin:0 0 4px; font-size:16px; }
  .card p.hint { margin:0 0 12px; color:var(--muted); font-size:13px; }
  .wide { grid-column: 1 / -1; }
  .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .item { display:flex; gap:8px; align-items:center; justify-content:space-between; padding:8px 0; border-top:1px solid var(--line); flex-wrap:wrap; }
  .item:first-of-type { border-top:0; }
  .name { font-weight:600; word-break:break-word; }
  .meta { color:var(--muted); font-size:12px; }
  button { min-height:42px; padding:0 14px; border-radius:10px; border:1px solid var(--line); background:#fff; color:var(--text); font:inherit; font-weight:600; cursor:pointer; transition: transform .05s; }
  button:active { transform: scale(.95); }
  button.primary { background:var(--brand); border-color:var(--brand); color:#fff; }
  button:disabled { opacity:.55; cursor:wait; }
  input { min-height:42px; padding:0 12px; border-radius:10px; border:1px solid var(--line); font:inherit; flex:1; min-width:160px; }
  .pill { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:13px; font-weight:600; }
  .pill.ok { background:#dcfce7; color:var(--ok); } .pill.bad { background:#fee2e2; color:var(--bad); } .pill.warn { background:#fef3c7; color:var(--warn); }
  .dot { width:8px; height:8px; border-radius:50%; background:currentColor; }
  dl { display:grid; grid-template-columns:auto 1fr; gap:6px 14px; margin:0; font-size:14px; }
  dt { color:var(--muted); } dd { margin:0; word-break:break-all; }
  .result { margin-top:10px; font-size:14px; min-height:20px; }
  .result.ok { color:var(--ok); } .result.bad { color:var(--bad); }
  pre { margin:0; max-height:320px; overflow:auto; background:#0b1020; color:#d1d5db; padding:12px; border-radius:10px; font: 12px/1.5 ui-monospace, Consolas, monospace; white-space:pre-wrap; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:6px 4px; border-top:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:600; border-top:0; }
  .empty { color:var(--muted); font-size:14px; padding:6px 0; }
</style>
</head>
<body>
<header>
  <div>
    <h1>Bong POS · Printer Tools</h1>
    <div class="sub" id="hdr">Print agent on this computer</div>
  </div>
</header>
<main>
  <section class="card">
    <h2>Agent status</h2>
    <p class="hint">The agent must be <b>Connected</b> for the POS to print here.</p>
    <div id="statusPill" class="pill warn"><span class="dot"></span>Loading…</div>
    <dl style="margin-top:12px" id="statusList"></dl>
  </section>

  <section class="card">
    <h2>USB / installed printers</h2>
    <p class="hint">Printers installed in Windows. Use the exact name in POS → Thermal Printers → USB / Installed. Virtual printers (PDF, OneNote, XPS) save to a file and cannot print receipts.</p>
    <div id="usbList" class="empty">Loading…</div>
    <div class="row" style="margin-top:8px"><button onclick="loadPrinters()">Refresh list</button></div>
  </section>

  <section class="card">
    <h2>Network printer</h2>
    <p class="hint">Test a LAN / Wi-Fi printer by its IP address (port 9100 if not given).</p>
    <div class="row">
      <input id="ip" placeholder="192.168.1.200 or 192.168.1.200:9100" inputmode="decimal" autocomplete="off">
    </div>
    <div class="row" style="margin-top:8px">
      <button onclick="checkIp()">Check connection</button>
      <button class="primary" onclick="printIp('page')">Print test page</button>
      <button onclick="printIp('drawer')">Open cash drawer</button>
    </div>
    <div id="ipResult" class="result"></div>
  </section>

  <section class="card">
    <h2>Find network printers</h2>
    <p class="hint">Looks for printers on this computer's network (port 9100). Takes up to about 10 seconds.</p>
    <div class="row"><button class="primary" id="scanBtn" onclick="scan()">Scan network</button></div>
    <div id="scanInfo" class="meta" style="margin-top:8px"></div>
    <div id="scanList" style="margin-top:4px"></div>
  </section>

  <section class="card wide">
    <h2>Recent print jobs</h2>
    <p class="hint">Jobs from the POS and test prints since the agent started.</p>
    <div id="jobs" class="empty scroll-x">No jobs yet.</div>
  </section>

  <section class="card wide">
    <div class="row" style="justify-content:space-between">
      <div><h2>Log</h2><p class="hint">Send this to support if printing does not work.</p></div>
      <div class="row"><button onclick="loadLog()">Refresh</button><button onclick="copyLog()">Copy</button></div>
    </div>
    <pre id="log">Loading…</pre>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

async function api(path, body) {
  const opts = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-Restro-Agent": "1" }, body: JSON.stringify(body) };
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
  return data;
}

function showResult(el, r, okText) {
  el.className = "result " + (r.ok ? "ok" : "bad");
  el.textContent = r.ok ? okText(r) : ("✗ " + (r.error || "Failed"));
}

async function withBusy(btn, fn) {
  if (btn) btn.disabled = true;
  try { await fn(); } finally { if (btn) btn.disabled = false; }
}

async function loadStatus() {
  try {
    const s = await api("/api/status");
    const pill = $("statusPill");
    if (!s.configured) { pill.className = "pill warn"; pill.innerHTML = '<span class="dot"></span>Not set up'; }
    else if (s.connected) { pill.className = "pill ok"; pill.innerHTML = '<span class="dot"></span>Connected'; }
    else { pill.className = "pill bad"; pill.innerHTML = '<span class="dot"></span>Offline'; }
    $("hdr").textContent = "Print agent v" + s.version + " on " + s.hostname;
    const rows = [
      ["POS server", s.serverUrl || "—"],
      ["Connected since", s.connectedAt ? new Date(s.connectedAt).toLocaleString() : "—"],
      ["Last problem", s.lastError || "—"],
      ["Agent started", new Date(s.startedAt).toLocaleString()],
      ["Jobs printed", s.printed + (s.failed ? " (" + s.failed + " failed)" : "")],
    ];
    $("statusList").innerHTML = rows.map(([k, v]) => "<dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd>").join("");
  } catch (e) {
    $("statusPill").className = "pill bad"; $("statusPill").innerHTML = '<span class="dot"></span>Agent not responding';
  }
}

async function loadPrinters() {
  const box = $("usbList");
  try {
    const { printers } = await api("/api/printers");
    if (!printers.length) { box.className = "empty"; box.textContent = "No printers installed in Windows."; return; }
    // Real printers first; virtual ones (PDF, OneNote…) cannot print receipts.
    printers.sort((a, b) => Number(a.virtual) - Number(b.virtual));
    box.className = "";
    box.innerHTML = printers.map((p, i) => {
      const tags = (p.virtual ? '<span class="pill warn">Virtual, not a paper printer</span> ' : "") +
        (p.offline ? '<span class="pill bad">Offline</span>' : "");
      const off = p.virtual ? " disabled" : "";
      return '<div class="item"><div><div class="name">' + esc(p.name) + '</div>' +
        '<div class="meta">' + esc([p.driver, p.port].filter(Boolean).join(" · ")) + '</div>' +
        (tags ? '<div style="margin-top:4px">' + tags + '</div>' : "") + '</div><div class="row">' +
        '<button class="primary" data-i="' + i + '" data-kind="page"' + off + '>Test print</button>' +
        '<button data-i="' + i + '" data-kind="drawer"' + off + '>Drawer</button></div>' +
        '<div class="result" id="usbRes' + i + '" style="width:100%"></div></div>';
    }).join("");
    box.querySelectorAll("button").forEach((b) => b.onclick = () => withBusy(b, async () => {
      const i = b.dataset.i, res = $("usbRes" + i);
      res.className = "result"; res.textContent = "Printing… (waiting for the printer to take the job)";
      const r = await api("/api/test-print", { target: { type: "usb", name: printers[i].name }, kind: b.dataset.kind });
      showResult(res, r, (r) => "✓ The printer took the job (" + r.ms + " ms). Check the paper.");
      loadJobs();
    }));
  } catch (e) { box.className = "empty"; box.textContent = e.message; }
}

function ipValue() { return $("ip").value.trim(); }

function checkIp() {
  const res = $("ipResult");
  if (!ipValue()) { res.className = "result bad"; res.textContent = "Enter the printer's IP address."; return; }
  res.className = "result"; res.textContent = "Checking…";
  api("/api/check", { address: ipValue() }).then((r) => showResult(res, r, (r) => "✓ " + r.address + " is reachable (" + r.ms + " ms)."), (e) => showResult(res, { ok: false, error: e.message }));
}

function printIp(kind, address, resEl) {
  const res = resEl || $("ipResult");
  const addr = address || ipValue();
  if (!addr) { res.className = "result bad"; res.textContent = "Enter the printer's IP address."; return; }
  res.className = "result"; res.textContent = "Sending…";
  api("/api/test-print", { target: { type: "tcp", address: addr }, kind })
    .then((r) => { showResult(res, r, (r) => "✓ Sent to " + addr + " in " + r.ms + " ms. Check the printer."); loadJobs(); },
          (e) => showResult(res, { ok: false, error: e.message }));
}

function scan() {
  const btn = $("scanBtn");
  withBusy(btn, async () => {
    $("scanInfo").textContent = "Scanning…"; $("scanList").innerHTML = "";
    try {
      const r = await api("/api/scan", {});
      $("scanInfo").textContent = "Checked " + r.scanned + " addresses on " + (r.subnets.map((s) => s.cidr).join(", ") || "no private network") + ".";
      if (!r.found.length) { $("scanList").innerHTML = '<div class="empty">No printers found. Make sure the printer is on and connected to the same network.</div>'; return; }
      $("scanList").innerHTML = r.found.map((f, i) =>
        '<div class="item"><div><div class="name">' + esc(f.address) + '</div><div class="meta">answered in ' + f.ms + ' ms</div></div>' +
        '<div class="row"><button class="primary" data-a="' + esc(f.address) + '" data-i="' + i + '">Test print</button>' +
        '<button data-use="' + esc(f.address) + '">Use</button></div>' +
        '<div class="result" id="scanRes' + i + '" style="width:100%"></div></div>').join("");
      $("scanList").querySelectorAll("button[data-a]").forEach((b) => b.onclick = () => printIp("page", b.dataset.a, $("scanRes" + b.dataset.i)));
      $("scanList").querySelectorAll("button[data-use]").forEach((b) => b.onclick = () => { $("ip").value = b.dataset.use; $("ip").focus(); });
    } catch (e) { $("scanInfo").textContent = e.message; }
  });
}

async function loadJobs() {
  try {
    const { jobs } = await api("/api/jobs");
    const box = $("jobs");
    if (!jobs.length) { box.className = "empty scroll-x"; box.textContent = "No jobs yet."; return; }
    box.className = "scroll-x";
    box.innerHTML = "<table><tr><th>Time</th><th>Job</th><th>Printer</th><th>Result</th></tr>" + jobs.map((j) =>
      "<tr><td>" + esc(new Date(j.at).toLocaleTimeString()) + "</td><td>" + esc(j.label) + "</td><td>" + esc(j.printer) +
      '</td><td style="color:' + (j.ok ? "var(--ok)" : "var(--bad)") + '">' + (j.ok ? "✓ Printed" : "✗ " + esc(j.error)) + "</td></tr>").join("") + "</table>";
  } catch (_) {}
}

async function loadLog() {
  try { const { lines } = await api("/api/log"); $("log").textContent = lines.join("\\n") || "(empty)"; $("log").scrollTop = 1e9; } catch (e) { $("log").textContent = e.message; }
}

function copyLog() { navigator.clipboard.writeText($("log").textContent); }

$("ip").addEventListener("keydown", (e) => { if (e.key === "Enter") checkIp(); });
loadStatus(); loadPrinters(); loadJobs(); loadLog();
setInterval(() => { loadStatus(); loadJobs(); }, 5000);
</script>
</body>
</html>`;

module.exports = { startDashboard, DEFAULT_PORT };
