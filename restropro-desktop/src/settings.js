const fs = require("fs");
const path = require("path");
const { app } = require("electron");

/**
 * Desktop settings in %APPDATA%\Bong POS\settings.json.
 * The print agent token is NOT kept here: it lives in the agent's own
 * config.json (see agent-host.js), the file the agent already reads.
 */

const DEFAULT_POS_URL = "https://pos.allkh.app";

const DEFAULTS = {
  posUrl: DEFAULT_POS_URL,
  kiosk: false,
  autoStart: false,
  keepAwake: false,
  agentEnabled: false,
  windowBounds: null,
  windowMaximized: true,
  zoomFactor: 1,
};

let cache = null;

function file() {
  return path.join(app.getPath("userData"), "settings.json");
}

function load() {
  if (cache) return cache;
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(file(), "utf8"));
  } catch (_) {}
  cache = { ...DEFAULTS, ...saved };
  return cache;
}

function get(key) {
  return load()[key];
}

function set(patch) {
  cache = { ...load(), ...patch };
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    const tmp = `${file()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
    fs.renameSync(tmp, file());
  } catch (_) {}
  return cache;
}

/** "pos.example.com/" → "https://pos.example.com". Returns null when invalid. */
function normalizePosUrl(value) {
  let text = String(value || "").trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch (_) {
    return null;
  }
}

module.exports = { get, set, load, normalizePosUrl, DEFAULT_POS_URL };
