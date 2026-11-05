const fs = require("fs");
const path = require("path");
const { app } = require("electron");

/** Small rotating log at %APPDATA%\Bong POS\logs\desktop.log (also used by the updater). */

const MAX_BYTES = 2 * 1024 * 1024;
let logFile = null;

function ensureFile() {
  if (logFile) return logFile;
  const dir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(dir, { recursive: true });
  logFile = path.join(dir, "desktop.log");
  try {
    if (fs.statSync(logFile).size > MAX_BYTES) fs.renameSync(logFile, `${logFile}.1`);
  } catch (_) {}
  return logFile;
}

function write(level, args) {
  const line = [new Date().toISOString(), level, ...args.map((a) => (a instanceof Error ? a.stack || a.message : String(a)))].join(" ");
  console.log(line);
  try {
    fs.appendFileSync(ensureFile(), line + "\r\n");
  } catch (_) {}
}

const log = {
  info: (...a) => write("INFO", a),
  warn: (...a) => write("WARN", a),
  error: (...a) => write("ERROR", a),
  debug: () => {},
  file: () => ensureFile(),
};

module.exports = log;
