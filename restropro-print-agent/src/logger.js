const fs = require("fs");
const path = require("path");

/**
 * Console logger that can also append to a rotating log file. The Windows
 * service has no console, so support asks for logs\agent.log instead.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const KEEP_FILES = 3; // agent.log, agent.log.1, agent.log.2

let logFile = null;
const RECENT_MAX = 300;
const recent = [];
let writesSinceCheck = 0;

function rotateIfNeeded() {
  try {
    if (fs.statSync(logFile).size < MAX_BYTES) return;
  } catch (_) {
    return; // file does not exist yet
  }
  for (let i = KEEP_FILES - 1; i >= 1; i--) {
    const from = i === 1 ? logFile : `${logFile}.${i - 1}`;
    try {
      fs.renameSync(from, `${logFile}.${i}`);
    } catch (_) {}
  }
}

function enableFileLog(dir) {
  fs.mkdirSync(dir, { recursive: true });
  logFile = path.join(dir, "agent.log");
  rotateIfNeeded();
}

function log(...args) {
  const line = [new Date().toISOString(), ...args.map((a) => (a instanceof Error ? a.stack || a.message : String(a)))].join(" ");
  console.log(line);
  recent.push(line);
  if (recent.length > RECENT_MAX) recent.shift();
  if (!logFile) return;
  try {
    if (++writesSinceCheck >= 200) {
      writesSinceCheck = 0;
      rotateIfNeeded();
    }
    fs.appendFileSync(logFile, line + "\r\n");
  } catch (_) {
    // Never let a full disk or locked file stop printing.
  }
}

/** Last log lines kept in memory (for the Printer Tools page). */
function recentLines(count = 100) {
  return recent.slice(-count);
}

module.exports = { log, enableFileLog, recentLines };
