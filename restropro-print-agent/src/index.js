#!/usr/bin/env node
/**
 * Restro PRO print agent.
 *
 * Runs on any always-on computer in the restaurant (Windows, macOS, Linux,
 * Raspberry Pi). It keeps an outbound connection to the Restro server and
 * prints jobs on LAN (TCP 9100) and USB / installed printers, which a cloud
 * server cannot reach directly.
 *
 * Usage:
 *   node src/index.js --server https://pos.example.com --token rpa_xxx   (first run, saves config.json)
 *   node src/index.js                                                    (later runs)
 *   node src/index.js --list-printers
 *
 * Extra commands (used by the Windows installer, also handy for support):
 *   --configure --server URL --token rpa_xxx   save settings and exit
 *   --test [--server URL --token rpa_xxx]      check the server accepts the token, then exit
 *   --service                                  run in the background: log to file, wait for config
 *   --scan                                     find network printers (port 9100) on this computer's networks
 *   --check 192.168.1.50[:9100]                check a network printer is reachable
 *   --test-print <IP[:port] | printer name>    print a test page
 *   --drawer <IP[:port] | printer name>        open the cash drawer
 *   --version
 *
 * While running, the Printer Tools page is at http://localhost:17171
 * (--tools-port N to change it, --no-tools to turn it off).
 */

const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const { io } = require("socket.io-client");
const { parseTcpTarget, parseSpoolerName } = require("./address");
const { sendTcp } = require("./transports/tcp");
const { sendToSpooler, listInstalledPrinters, listInstalledPrinterDetails } = require("./transports/spooler");
const { isPackaged, agentHome, configPath, logDir } = require("./paths");
const { log, enableFileLog, recentLines } = require("./logger");
const { buildTestPage, buildDrawerKick } = require("./escpos");
const { checkNetworkPrinter, scanNetwork } = require("./tools");
const { startDashboard, DEFAULT_PORT } = require("./dashboard");
const { version } = require("../package.json");

const CONFIG_PATH = configPath();
const TCP_ATTEMPTS = 2;
const PRINTER_REFRESH_MS = 5 * 60 * 1000;
const CONFIG_POLL_MS = 15 * 1000;
const TEST_TIMEOUT_MS = 15 * 1000;
// After the server closes our connection (token regenerated, or another agent
// started with the same token) wait before trying again, so two copies of the
// agent never fight over the connection in a tight loop.
const SERVER_KICK_RETRY_MS = 30 * 1000;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function readSavedConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (_) {
    return {};
  }
}

function resolveConfig(args) {
  const saved = readSavedConfig();
  return {
    serverUrl: String(args.server || process.env.RESTRO_SERVER_URL || saved.serverUrl || "").trim().replace(/\/+$/, ""),
    token: String(args.token || process.env.RESTRO_AGENT_TOKEN || saved.token || "").trim(),
  };
}

function validateConfig(config) {
  if (!config.serverUrl || !config.token) return "Missing server URL or agent token.";
  if (!/^https?:\/\/[^\s/]+/i.test(config.serverUrl)) return `Server URL "${config.serverUrl}" must start with http:// or https://.`;
  return null;
}

// The token is a secret: on the installed Windows agent only SYSTEM and
// Administrators may read config.json (well-known SIDs, so it works on any
// Windows language).
function restrictConfigAccess() {
  if (process.platform !== "win32" || !isPackaged()) return;
  try {
    execFileSync("icacls", [CONFIG_PATH, "/inheritance:r", "/grant:r", "*S-1-5-18:F", "*S-1-5-32-544:F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } catch (err) {
    log(`Warning: could not restrict access to ${CONFIG_PATH}: ${err.message}`);
  }
}

function saveConfig(config) {
  fs.mkdirSync(agentHome(), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  restrictConfigAccess();
  log(`Saved configuration to ${CONFIG_PATH}`);
}

const MISSING_CONFIG_HELP =
  "Run once with: restro-print-agent --server https://your-pos-domain --token rpa_...\n" +
  "(Create the token in Settings > Thermal Printers > Print Agents.)";

// One queue per physical printer, so concurrent jobs never interleave.
const printerQueues = new Map();
function enqueue(key, task) {
  const previous = printerQueues.get(key) || Promise.resolve();
  const run = previous.catch(() => {}).then(task);
  const tail = run.catch(() => {});
  printerQueues.set(key, tail);
  tail.then(() => {
    if (printerQueues.get(key) === tail) printerQueues.delete(key);
  });
  return run;
}

// Remember recently printed job ids: if the server re-sends a job because our
// acknowledgement was lost, confirm it again instead of printing a duplicate.
const recentlyPrinted = new Set();
function rememberPrinted(jobId) {
  recentlyPrinted.add(jobId);
  if (recentlyPrinted.size > 500) recentlyPrinted.delete(recentlyPrinted.values().next().value);
}

// Live state shown on the Printer Tools page (never includes the token).
const agentState = {
  startedAt: new Date().toISOString(),
  serverUrl: "",
  configured: false,
  connected: false,
  connectedAt: null,
  lastError: null,
  printed: 0,
  failed: 0,
};
const recentJobs = [];
function recordJob(entry) {
  recentJobs.unshift({ at: new Date().toISOString(), ...entry });
  if (recentJobs.length > 30) recentJobs.pop();
  if (entry.ok) agentState.printed++;
  else agentState.failed++;
}

/**
 * Print a test page (or open the cash drawer) on a USB/installed printer or a
 * network printer. Goes through the same per-printer queue and address checks
 * as real POS jobs. Never throws: returns { ok, ms } or { ok: false, error }.
 */
async function runTestPrint(target, kind = "page") {
  const isUsb = target?.type === "usb";
  const address = String((isUsb ? target?.name : target?.address) || "").trim();
  const printerLabel = isUsb ? address : address.includes(":") ? address : `${address}:9100`;
  const label = kind === "drawer" ? "Cash drawer test" : "Test page";
  const buffer = kind === "drawer" ? buildDrawerKick() : buildTestPage({ printerLabel, hostname: os.hostname(), version });
  const started = Date.now();
  try {
    if (!address) throw new Error(isUsb ? "Choose a printer." : "Enter the printer's IP address.");
    await printJob({ printer: { transport: isUsb ? "usb" : "tcp", address }, payload: buffer.toString("base64") });
    const ms = Date.now() - started;
    log(`${label} sent to ${printerLabel} (${ms} ms)`);
    recordJob({ label, printer: printerLabel, ok: true });
    return { ok: true, ms };
  } catch (err) {
    log(`${label} FAILED on ${printerLabel}: ${err.message}`);
    recordJob({ label, printer: printerLabel, ok: false, error: err.message });
    return { ok: false, error: err.message };
  }
}

/** "192.168.1.50", "192.168.1.50:9100" → network printer; anything else → installed printer name. */
function parseCliTarget(value) {
  const text = String(value || "").trim();
  return /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(text) ? { type: "tcp", address: text } : { type: "usb", name: text };
}

// Network printers found by the last LAN scan. Sent to the server so the POS
// settings can offer them as choices instead of asking for an IP address.
const NETWORK_RESCAN_MS = 15 * 60 * 1000;
const networkScan = { printers: [], scannedAt: null, inFlight: null, onUpdate: null };

/** Scan the LAN (one scan at a time) and remember the result. */
function scanNetworkShared() {
  if (!networkScan.inFlight) {
    networkScan.inFlight = scanNetwork()
      .then((result) => {
        networkScan.printers = result.found.map(({ address, ms }) => ({ address, ms }));
        networkScan.scannedAt = new Date().toISOString();
        if (networkScan.onUpdate) networkScan.onUpdate();
        return result;
      })
      .finally(() => (networkScan.inFlight = null));
  }
  return networkScan.inFlight;
}

function startPrinterTools(args) {
  if (args["no-tools"]) return;
  const saved = readSavedConfig();
  startDashboard({
    port: Number(args["tools-port"] || process.env.RESTRO_TOOLS_PORT || saved.toolsPort) || DEFAULT_PORT,
    getStatus: () => ({ ...agentState, version, hostname: os.hostname(), platform: process.platform }),
    listPrinters: listInstalledPrinterDetails,
    testPrint: runTestPrint,
    checkPrinter: checkNetworkPrinter,
    scan: scanNetworkShared,
    recentJobs: () => recentJobs,
    recentLog: () => recentLines(150),
  });
}

async function printJob(job) {
  const printer = job?.printer || {};
  const buffer = Buffer.from(String(job?.payload || ""), "base64");
  if (buffer.length === 0) throw new Error("Empty print job.");

  if (printer.transport === "usb") {
    const name = parseSpoolerName(printer.address);
    return enqueue(`usb:${name}`, () => sendToSpooler(name, buffer));
  }

  const { host, port } = parseTcpTarget(printer.address);
  return enqueue(`tcp:${host}:${port}`, async () => {
    let lastError;
    for (let attempt = 1; attempt <= TCP_ATTEMPTS; attempt++) {
      try {
        return await sendTcp(host, port, buffer);
      } catch (err) {
        lastError = err;
        if (attempt < TCP_ATTEMPTS) await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw lastError;
  });
}

function openSocket(config, extra = {}) {
  return io(`${config.serverUrl}/print-agent`, {
    auth: { token: config.token, hostname: os.hostname(), version },
    transports: ["websocket", "polling"],
    ...extra,
  });
}

/**
 * Connect once to check the URL and token, without taking part in printing.
 * Exit code 0 = connected, 2 = token rejected, 1 = anything else.
 */
function testConnection(config) {
  return new Promise((resolve) => {
    const socket = openSocket(config, { reconnection: false, timeout: TEST_TIMEOUT_MS });
    const finish = (code, message) => {
      clearTimeout(timer);
      socket.close();
      console.log(message);
      resolve(code);
    };
    const timer = setTimeout(
      () => finish(1, `FAILED: no answer from ${config.serverUrl} within ${TEST_TIMEOUT_MS / 1000}s. Check the address and this computer's internet connection.`),
      TEST_TIMEOUT_MS
    );
    socket.on("connect", () => finish(0, `OK: connected to ${config.serverUrl}. The token was accepted.`));
    socket.on("connect_error", (err) => {
      if (err.message === "invalid_token" || err.message === "missing_token") {
        finish(2, "FAILED: the server rejected this agent token. Create or regenerate it in Settings > Thermal Printers > Print Agents.");
      } else {
        finish(1, `FAILED: could not connect to ${config.serverUrl} (${err.message}).`);
      }
    });
  });
}

async function waitForConfig(args) {
  let warned = false;
  for (;;) {
    const config = resolveConfig(args);
    const problem = validateConfig(config);
    if (!problem) return config;
    if (!warned) {
      log(`${problem} Waiting for ${CONFIG_PATH} (checking every ${CONFIG_POLL_MS / 1000}s).`);
      warned = true;
    }
    await new Promise((r) => setTimeout(r, CONFIG_POLL_MS));
  }
}

function runAgent(config) {
  log(`Restro print agent v${version} connecting to ${config.serverUrl}`);
  agentState.serverUrl = config.serverUrl;
  agentState.configured = true;

  const socket = openSocket(config, {
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  const reportPrinters = async () => {
    if (!socket.connected) return;
    socket.emit("agent_info", {
      printers: await listInstalledPrinters(),
      platform: process.platform,
      network_printers: networkScan.printers,
      network_scanned_at: networkScan.scannedAt,
    });
  };
  networkScan.onUpdate = reportPrinters;

  const rescanIfStale = () => {
    const age = networkScan.scannedAt ? Date.now() - Date.parse(networkScan.scannedAt) : Infinity;
    if (age >= NETWORK_RESCAN_MS) scanNetworkShared().catch((err) => log(`Network scan failed: ${err.message}`));
  };

  socket.on("connect", () => {
    log("Connected. Waiting for print jobs...");
    agentState.connected = true;
    agentState.connectedAt = new Date().toISOString();
    agentState.lastError = null;
    reportPrinters();
    rescanIfStale();
  });

  // "Scan again" in the POS printer settings.
  socket.on("scan_network", async (_payload, ack) => {
    const reply = typeof ack === "function" ? ack : typeof _payload === "function" ? _payload : () => {};
    try {
      const result = await scanNetworkShared();
      log(`Network scan from POS: ${result.found.length} printer(s) on ${result.subnets.map((s) => s.cidr).join(", ") || "no network"}`);
      reply({ ok: true, found: networkScan.printers, scanned_at: networkScan.scannedAt, subnets: result.subnets.map((s) => s.cidr) });
    } catch (err) {
      reply({ ok: false, error: err.message });
    }
  });

  socket.on("disconnect", (reason) => {
    agentState.connected = false;
    agentState.connectedAt = null;
    agentState.lastError = `Disconnected (${reason})`;
    // A server-side disconnect does not reconnect on its own.
    if (reason === "io server disconnect") {
      log(
        `The server closed this connection (token regenerated, or another agent started with the same token). ` +
          `Reconnecting in ${SERVER_KICK_RETRY_MS / 1000}s.`
      );
      setTimeout(() => socket.connect(), SERVER_KICK_RETRY_MS);
    } else {
      log(`Disconnected (${reason}). Reconnecting...`);
    }
  });

  socket.on("connect_error", (err) => {
    agentState.connected = false;
    agentState.lastError =
      err.message === "invalid_token" || err.message === "missing_token" ? "The server rejected the agent token." : err.message;
    // Errors raised by the server's auth middleware stop automatic reconnection.
    if (err.message === "invalid_token" || err.message === "missing_token") {
      log("The agent token was rejected. Create a new token in Settings > Thermal Printers > Print Agents. Retrying in 60s.");
      setTimeout(() => socket.connect(), 60000);
    } else if (!socket.active) {
      log(`Connection refused: ${err.message}. Retrying in 10s.`);
      setTimeout(() => socket.connect(), 10000);
    } else {
      log(`Connection error: ${err.message}`);
    }
  });

  socket.on("print_job", async (job, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    const label = `job #${job?.jobId} (${job?.jobType || "raw"}) → ${job?.printer?.name || "?"} [${job?.printer?.address || "?"}]`;
    const jobEntry = { label: `#${job?.jobId} ${job?.jobType || "print"}`, printer: job?.printer?.name || job?.printer?.address || "?" };

    if (recentlyPrinted.has(job?.jobId)) {
      log(`Already printed ${label}; confirming again.`);
      return reply({ ok: true });
    }

    try {
      await printJob(job);
      rememberPrinted(job.jobId);
      log(`Printed ${label}`);
      recordJob({ ...jobEntry, ok: true });
      reply({ ok: true });
    } catch (err) {
      log(`FAILED ${label}: ${err.message}`);
      recordJob({ ...jobEntry, ok: false, error: err.message });
      reply({ ok: false, error: err.message });
    }
  });

  setInterval(reportPrinters, PRINTER_REFRESH_MS).unref();
  setInterval(() => socket.connected && rescanIfStale(), PRINTER_REFRESH_MS).unref();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(version);
    return;
  }

  if (args["list-printers"]) {
    const printers = await listInstalledPrinterDetails();
    if (!printers.length) console.log("No installed printers found.");
    for (const p of printers) {
      const notes = [p.virtual && "virtual: cannot print receipts", p.offline && "offline"].filter(Boolean);
      console.log(`${p.name}${notes.length ? `  (${notes.join(", ")})` : ""}`);
    }
    return;
  }

  if (args.scan) {
    const r = await scanNetwork();
    console.log(`Scanned ${r.scanned} addresses on ${r.subnets.map((s) => s.cidr).join(", ") || "no private network"}.`);
    console.log(r.found.length ? r.found.map((f) => `  ${f.address}  (${f.ms} ms)`).join("\n") : "No printers found on port 9100.");
    return;
  }

  if (args.check) {
    const r = await checkNetworkPrinter(String(args.check));
    console.log(r.ok ? `OK: ${r.address} is reachable (${r.ms} ms).` : `FAILED: ${r.error}`);
    process.exitCode = r.ok ? 0 : 1;
    return;
  }

  if (args["test-print"] || args.drawer) {
    const r = await runTestPrint(parseCliTarget(args["test-print"] || args.drawer), args.drawer ? "drawer" : "page");
    console.log(r.ok ? `OK: sent in ${r.ms} ms. Check the printer.` : `FAILED: ${r.error}`);
    process.exitCode = r.ok ? 0 : 1;
    return;
  }

  if (args.test) {
    const config = resolveConfig(args);
    const problem = validateConfig(config);
    if (problem) {
      console.log(`FAILED: ${problem}`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = await testConnection(config);
    return;
  }

  if (args.configure) {
    const config = resolveConfig(args);
    const problem = validateConfig(config);
    if (problem) {
      console.error(`${problem}\n${MISSING_CONFIG_HELP}`);
      process.exitCode = 1;
      return;
    }
    saveConfig(config);
    return;
  }

  if (args.service) {
    // Background mode (Windows scheduled task): no console, never exit for a
    // missing config, so the agent starts by itself once it is configured.
    enableFileLog(logDir());
    process.on("uncaughtException", (err) => log("Unexpected error:", err));
    process.on("unhandledRejection", (err) => log("Unexpected error:", err));
    startPrinterTools(args);
    runAgent(await waitForConfig(args));
    return;
  }

  const config = resolveConfig(args);
  const problem = validateConfig(config);
  if (problem) {
    console.error(`${problem}\n${MISSING_CONFIG_HELP}`);
    process.exit(1);
  }
  // Remember CLI-provided settings so the agent can restart without arguments.
  if (args.server || args.token) saveConfig(config);
  startPrinterTools(args);
  runAgent(config);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
