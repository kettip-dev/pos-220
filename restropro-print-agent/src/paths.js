const os = require("os");
const path = require("path");

/**
 * Where the agent keeps config.json and logs.
 *   - Packaged Windows exe: C:\ProgramData\RestroPrintAgent (locked to
 *     SYSTEM + Administrators by the installer, because it holds the token).
 *   - Packaged on other OSes: ~/.restro-print-agent
 *   - Running from source (`node src/index.js`): the agent folder, as before.
 * RESTRO_AGENT_HOME overrides all of these.
 */

function isPackaged() {
  try {
    return require("node:sea").isSea();
  } catch (_) {
    return false;
  }
}

function agentHome() {
  if (process.env.RESTRO_AGENT_HOME) return process.env.RESTRO_AGENT_HOME;
  if (isPackaged()) {
    if (process.platform === "win32") {
      return path.join(process.env.ProgramData || "C:\\ProgramData", "RestroPrintAgent");
    }
    return path.join(os.homedir(), ".restro-print-agent");
  }
  return path.join(__dirname, "..");
}

function configPath() {
  return process.env.RESTRO_AGENT_CONFIG || path.join(agentHome(), "config.json");
}

function logDir() {
  return path.join(agentHome(), "logs");
}

/**
 * Directory of the running exe (Program Files when installed). Only
 * Administrators can write there, so helper files loaded from it are safe.
 */
function installDir() {
  return isPackaged() ? path.dirname(process.execPath) : null;
}

module.exports = { isPackaged, agentHome, configPath, logDir, installDir };
