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
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { io } = require("socket.io-client");
const { parseTcpTarget, parseSpoolerName } = require("./address");
const { sendTcp } = require("./transports/tcp");
const { sendToSpooler, listInstalledPrinters } = require("./transports/spooler");
const { version } = require("../package.json");

const CONFIG_PATH = process.env.RESTRO_AGENT_CONFIG || path.join(__dirname, "..", "config.json");
const TCP_ATTEMPTS = 2;
const PRINTER_REFRESH_MS = 5 * 60 * 1000;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

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

function loadConfig(args) {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (_) {}

  const config = {
    serverUrl: String(args.server || process.env.RESTRO_SERVER_URL || saved.serverUrl || "").replace(/\/+$/, ""),
    token: args.token || process.env.RESTRO_AGENT_TOKEN || saved.token || "",
  };

  if (!config.serverUrl || !config.token) {
    console.error(
      "Missing server URL or agent token.\n" +
        "Run once with: node src/index.js --server https://your-pos-domain --token rpa_...\n" +
        "(Create the token in Settings > Thermal Printers > Print Agents.)"
    );
    process.exit(1);
  }

  // Remember CLI-provided settings so the agent can restart without arguments.
  if (args.server || args.token) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
    log(`Saved configuration to ${CONFIG_PATH}`);
  }
  return config;
}

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args["list-printers"]) {
    const printers = await listInstalledPrinters();
    console.log(printers.length ? printers.join("\n") : "No installed printers found.");
    return;
  }

  const config = loadConfig(args);
  log(`Restro print agent v${version} connecting to ${config.serverUrl}`);

  const socket = io(`${config.serverUrl}/print-agent`, {
    auth: { token: config.token, hostname: os.hostname(), version },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  const reportPrinters = async () => {
    if (!socket.connected) return;
    socket.emit("agent_info", { printers: await listInstalledPrinters(), platform: process.platform });
  };

  socket.on("connect", () => {
    log("Connected. Waiting for print jobs...");
    reportPrinters();
  });

  socket.on("disconnect", (reason) => log(`Disconnected (${reason}). Reconnecting...`));

  socket.on("connect_error", (err) => {
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

    if (recentlyPrinted.has(job?.jobId)) {
      log(`Already printed ${label}; confirming again.`);
      return reply({ ok: true });
    }

    try {
      await printJob(job);
      rememberPrinted(job.jobId);
      log(`Printed ${label}`);
      reply({ ok: true });
    } catch (err) {
      log(`FAILED ${label}: ${err.message}`);
      reply({ ok: false, error: err.message });
    }
  });

  setInterval(reportPrinters, PRINTER_REFRESH_MS).unref();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
