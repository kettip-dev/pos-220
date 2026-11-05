const { app, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("./logger");

/**
 * Automatic updates for the desktop app itself (the POS screens update on
 * every server deploy without this).
 *
 * Feed: <POS address>/desktop/latest.yml, published by scripts/release.ps1.
 * Updates download in the background and install when the app closes, or right
 * away if staff click "Restart now". Nothing ever restarts during service
 * without asking.
 */

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

let feedUrl = null;
let timer = null;
let getWindow = () => null;
let manualCheck = false;
let promptShown = false;
let downloadedVersion = null;
const listeners = new Set();
let state = { status: "idle", message: "" };

function setState(status, message = "", extra = {}) {
  state = { status, message, ...extra };
  for (const fn of listeners) fn(state);
}

function configure(posUrl) {
  feedUrl = `${posUrl.replace(/\/+$/, "")}/desktop/`;
  autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
}

function init({ posUrl, window }) {
  getWindow = window;
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  configure(posUrl);

  autoUpdater.on("checking-for-update", () => setState("checking", "Checking for updates..."));
  autoUpdater.on("update-not-available", () => {
    setState("current", `Bong POS ${app.getVersion()} is up to date.`);
    if (manualCheck) {
      manualCheck = false;
      dialog.showMessageBox(getWindow() || undefined, { type: "info", title: "Bong POS", message: `You have the latest version (${app.getVersion()}).` });
    }
  });
  autoUpdater.on("update-available", (info) => setState("downloading", `Downloading version ${info.version}...`, { version: info.version }));
  autoUpdater.on("download-progress", (p) =>
    setState("downloading", `Downloading update... ${Math.round(p.percent)}%`, { percent: p.percent })
  );
  autoUpdater.on("update-downloaded", (info) => {
    downloadedVersion = info.version;
    setState("ready", `Version ${info.version} is ready. It installs when Bong POS restarts.`, { version: info.version });
    manualCheck = false;
    promptRestart();
  });
  autoUpdater.on("error", (err) => {
    log.warn(`Update check failed: ${err?.message || err}`);
    setState("error", "Could not check for updates.");
    if (manualCheck) {
      manualCheck = false;
      dialog.showMessageBox(getWindow() || undefined, {
        type: "warning",
        title: "Bong POS",
        message: "Could not check for updates.",
        detail: `Update address: ${feedUrl}\n${err?.message || err}`,
      });
    }
  });

  if (!app.isPackaged) {
    log.info("Development run: automatic updates are off.");
    return;
  }
  setTimeout(check, 15 * 1000);
  timer = setInterval(check, CHECK_EVERY_MS);
}

function promptRestart() {
  if (promptShown || !downloadedVersion) return;
  promptShown = true;
  dialog
    .showMessageBox(getWindow() || undefined, {
      type: "info",
      title: "Update ready",
      message: `Bong POS ${downloadedVersion} is ready to install.`,
      detail: "Restart now, or keep working: the update installs the next time Bong POS closes.",
      buttons: ["Restart now", "Later"],
      defaultId: 1,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response === 0) quitAndInstall();
    });
}

function quitAndInstall() {
  app.isQuittingForUpdate = true;
  // Silent install, then start the app again.
  autoUpdater.quitAndInstall(true, true);
}

function check({ manual = false } = {}) {
  if (!app.isPackaged) {
    if (manual) {
      dialog.showMessageBox(getWindow() || undefined, {
        type: "info",
        title: "Bong POS",
        message: "Updates are only checked in the installed app.",
      });
    }
    return;
  }
  if (downloadedVersion) {
    if (manual) {
      promptShown = false;
      promptRestart();
    }
    return;
  }
  manualCheck = manual;
  autoUpdater.checkForUpdates().catch(() => {});
}

function onState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

module.exports = { init, configure, check, quitAndInstall, onState, getState: () => state, stop: () => clearInterval(timer) };
