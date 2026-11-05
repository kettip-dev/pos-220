const fs = require("fs");
const path = require("path");
const http = require("http");
const { app, utilityProcess } = require("electron");
const log = require("./logger");

/**
 * Runs the Bong POS print agent (../restropro-print-agent, bundled into
 * build/agent/agent.cjs) in a separate Node process. If it crashes, the POS
 * window keeps working and the agent is restarted.
 *
 * The agent keeps its own config.json (server URL + token) and logs in
 * %APPDATA%\Bong POS\print-agent. Its Printer Tools page runs on port 17172 so
 * it never clashes with a standalone agent installed on the same PC (17171).
 */

const TOOLS_PORT = 17172;
const RESTART_DELAYS_MS = [2000, 5000, 15000, 30000, 60000];

let child = null;
let wanted = false;
let restartTimer = null;
let crashes = 0;
let lastStartedAt = 0;

function agentDir() {
  return app.isPackaged ? path.join(process.resourcesPath, "agent") : path.join(__dirname, "..", "build", "agent");
}

function agentEntry() {
  return path.join(agentDir(), "agent.cjs");
}

function agentHome() {
  return path.join(app.getPath("userData"), "print-agent");
}

function configFile() {
  return path.join(agentHome(), "config.json");
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), "utf8"));
  } catch (_) {
    return {};
  }
}

function hasToken() {
  return Boolean(readConfig().token);
}

/** Save server URL and/or token. Pass token: "" to remove it. */
function saveConfig({ serverUrl, token }) {
  const current = readConfig();
  const next = { ...current };
  if (serverUrl !== undefined) next.serverUrl = serverUrl;
  if (token !== undefined) next.token = token;
  fs.mkdirSync(agentHome(), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(next, null, 2), { mode: 0o600 });
}

function baseEnv() {
  const env = { ...process.env, RESTRO_AGENT_HOME: agentHome() };
  // Never let stray variables override config.json.
  delete env.RESTRO_SERVER_URL;
  delete env.RESTRO_AGENT_TOKEN;
  delete env.RESTRO_AGENT_CONFIG;
  if (fs.existsSync(path.join(agentDir(), "RestroRawPrint.dll"))) env.RESTRO_AGENT_INSTALL_DIR = agentDir();
  return env;
}

function fork(args, env) {
  return utilityProcess.fork(agentEntry(), args, {
    env,
    stdio: "pipe",
    serviceName: "Bong POS Print Agent",
  });
}

function spawnAgent() {
  if (!fs.existsSync(agentEntry())) {
    log.error(`Print agent not found at ${agentEntry()}. Run "npm run bundle-agent".`);
    return;
  }
  lastStartedAt = Date.now();
  child = fork(["--service", "--tools-port", String(TOOLS_PORT)], baseEnv());
  child.once("spawn", () => log.info(`Print agent started (pid ${child?.pid})`));
  // The agent writes its own log file; echo to the console for development.
  child.stdout?.on("data", (d) => process.stdout.write(`[agent] ${d}`));
  child.stderr?.on("data", (d) => process.stderr.write(`[agent] ${d}`));
  child.on("exit", (code) => {
    child = null;
    if (!wanted) return;
    // A run that lasted 10 minutes resets the back-off.
    if (Date.now() - lastStartedAt > 10 * 60 * 1000) crashes = 0;
    const delay = RESTART_DELAYS_MS[Math.min(crashes, RESTART_DELAYS_MS.length - 1)];
    crashes++;
    log.warn(`Print agent exited (code ${code}). Restarting in ${delay / 1000}s.`);
    restartTimer = setTimeout(() => wanted && !child && spawnAgent(), delay);
  });
}

function start() {
  wanted = true;
  if (!child && !restartTimer) spawnAgent();
}

function stop() {
  wanted = false;
  clearTimeout(restartTimer);
  restartTimer = null;
  if (child) {
    const proc = child;
    child = null;
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      proc.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      proc.kill();
    });
  }
  return Promise.resolve();
}

async function restart() {
  await stop();
  crashes = 0;
  start();
}

function isRunning() {
  return Boolean(child);
}

/** Check a server URL + token without touching the running agent. */
function testConnection(serverUrl, token) {
  return new Promise((resolve) => {
    if (!fs.existsSync(agentEntry())) return resolve({ ok: false, message: "The print agent is missing from this installation." });
    const env = { ...baseEnv(), RESTRO_SERVER_URL: serverUrl, RESTRO_AGENT_TOKEN: token };
    const proc = fork(["--test"], env);
    let output = "";
    proc.stdout?.on("data", (d) => (output += d));
    proc.stderr?.on("data", (d) => (output += d));
    const timer = setTimeout(() => proc.kill(), 30000);
    proc.on("exit", () => {
      clearTimeout(timer);
      // The agent prints "OK: ..." or "FAILED: ..." (its exit code does not survive utilityProcess).
      const message = output.trim().split(/\r?\n/).filter(Boolean).pop() || "The connection test did not answer.";
      resolve({ ok: message.startsWith("OK:"), message });
    });
  });
}

/** Live status from the agent's Printer Tools API, or null when it is not running. */
function status() {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: TOOLS_PORT, path: "/api/status", headers: { host: `localhost:${TOOLS_PORT}` }, timeout: 2000 }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

const toolsUrl = `http://localhost:${TOOLS_PORT}/`;

module.exports = { start, stop, restart, isRunning, saveConfig, readConfig, hasToken, testConnection, status, toolsUrl, agentHome };
