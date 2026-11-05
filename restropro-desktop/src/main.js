const path = require("path");
const crypto = require("crypto");
const {
  app,
  BrowserWindow,
  WebContentsView,
  Menu,
  Tray,
  Notification,
  dialog,
  ipcMain,
  nativeImage,
  net,
  powerSaveBlocker,
  session,
  shell,
} = require("electron");
const settings = require("./settings");
const log = require("./logger");
const agent = require("./agent-host");
const updater = require("./updater");

/**
 * Bong POS desktop shell.
 *
 * The window loads the live POS website (default https://pos.allkh.app), so
 * screen changes ship with every server deploy. This app adds what a browser
 * tab cannot: its own window and taskbar icon, a built-in print agent for LAN
 * and USB printers, start with Windows, kiosk mode, sound without a click, and
 * automatic updates of the app itself.
 */

app.setAppUserModelId("app.allkh.bongpos");

if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

const ASSETS = path.join(__dirname, "..", "assets");
const RENDERER = path.join(__dirname, "..", "renderer");
const ICON = path.join(ASSETS, "icon.png");

// --pos-url http://localhost:5173 opens another server for this run only (development).
const argPosUrl = (() => {
  const i = process.argv.indexOf("--pos-url");
  return i > -1 ? settings.normalizePosUrl(process.argv[i + 1]) : null;
})();

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let keepAwakeId = null;
let shownTrayHint = false;
let quitting = false;

function posUrl() {
  return argPosUrl || settings.get("posUrl") || settings.DEFAULT_POS_URL;
}

function posOrigin() {
  return new URL(posUrl()).origin;
}

function isPosUrl(url) {
  try {
    return new URL(url).origin === posOrigin();
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------- main window
//
// VS Code style: no Windows title bar. The window's own page is a slim custom
// title bar (renderer/titlebar.html) with the native minimize / maximize /
// close buttons drawn over its right end (titleBarOverlay). The POS website
// runs in a separate view below it, so the website needs no changes.

const TITLEBAR_HEIGHT = 40;
const TITLEBAR_COLOR = "#ffffff";
let posView = null;

function posContents() {
  return posView && !posView.webContents.isDestroyed() ? posView.webContents : null;
}

function createMainWindow() {
  const bounds = settings.get("windowBounds");
  mainWindow = new BrowserWindow({
    width: bounds?.width || 1366,
    height: bounds?.height || 820,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "Bong POS",
    icon: ICON,
    backgroundColor: TITLEBAR_COLOR,
    titleBarStyle: "hidden",
    titleBarOverlay: { color: TITLEBAR_COLOR, symbolColor: "#1f2937", height: TITLEBAR_HEIGHT },
    kiosk: settings.get("kiosk"),
    webPreferences: {
      preload: path.join(__dirname, "titlebar-preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(RENDERER, "titlebar.html"));
  mainWindow.webContents.on("will-navigate", (e) => e.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("did-finish-load", sendTitlebarState);

  posView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      // New-order and kitchen sounds play without waiting for a tap.
      autoplayPolicy: "no-user-gesture-required",
      backgroundThrottling: false,
    },
  });
  posView.setBackgroundColor("#ECF1EB");
  mainWindow.contentView.addChildView(posView);
  layoutViews();

  mainWindow.once("ready-to-show", () => {
    if (settings.get("windowMaximized") && !settings.get("kiosk")) mainWindow.maximize();
    if (!process.argv.includes("--hidden")) mainWindow.show();
    if (settings.get("fullScreen") && !settings.get("kiosk")) mainWindow.setFullScreen(true);
    layoutViews();
  });
  for (const ev of ["resize", "maximize", "unmaximize", "restore"]) {
    mainWindow.on(ev, layoutViews);
  }
  for (const ev of ["enter-full-screen", "leave-full-screen"]) {
    mainWindow.on(ev, () => {
      titlebarRevealed = false;
      // Remember full screen for the next launch (kiosk has its own setting).
      if (!kioskOn()) settings.set({ fullScreen: mainWindow.isFullScreen() });
      layoutViews();
      sendTitlebarState();
      buildMenu();
    });
  }
  // Typing goes to the POS, not the title bar.
  mainWindow.on("focus", () => posContents()?.focus());
  mainWindow.on("page-title-updated", (event) => event.preventDefault());

  const wc = posView.webContents;
  wc.setZoomFactor(settings.get("zoomFactor") || 1);
  wc.on("did-finish-load", () => wc.setZoomFactor(settings.get("zoomFactor") || 1));

  // Stay on the POS site; anything else opens in the normal browser.
  wc.on("will-navigate", (event, url) => {
    if (isPosUrl(url) || url.startsWith("file:")) return;
    event.preventDefault();
    openExternal(url);
  });

  // Receipts and kitchen tickets open as print pop-ups (window.open("") + print()).
  wc.setWindowOpenHandler(({ url }) => {
    if (!url || url === "about:blank" || isPosUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          icon: ICON,
          autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
        },
      };
    }
    openExternal(url);
    return { action: "deny" };
  });

  wc.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // -3 = navigation aborted (e.g. replaced by another one): not an error.
    if (!isMainFrame || errorCode === -3 || !isPosUrl(validatedURL)) return;
    log.warn(`Could not load ${validatedURL}: ${errorDescription} (${errorCode})`);
    wc.loadFile(path.join(RENDERER, "offline.html"), {
      query: { url: posUrl(), error: errorDescription || String(errorCode) },
    });
  });

  wc.on("render-process-gone", (_event, details) => {
    if (quitting || details.reason === "clean-exit" || details.reason === "killed") return;
    log.error(`POS page crashed (${details.reason}). Reloading.`);
    setTimeout(() => loadPos({ clearCache: false }), 1000);
  });

  let saveTimer = null;
  const saveBounds = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || kioskOn() || mainWindow.isFullScreen()) return;
      const patch = { windowMaximized: mainWindow.isMaximized() };
      if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) patch.windowBounds = mainWindow.getBounds();
      settings.set(patch);
    }, 500);
  };
  mainWindow.on("resize", saveBounds);
  mainWindow.on("move", saveBounds);
  mainWindow.on("maximize", saveBounds);
  mainWindow.on("unmaximize", saveBounds);

  // With the print agent on, closing the window keeps printing in the tray.
  mainWindow.on("close", (event) => {
    if (quitting || !agentShouldRun()) return;
    event.preventDefault();
    mainWindow.hide();
    if (!shownTrayHint && Notification.isSupported()) {
      shownTrayHint = true;
      new Notification({
        title: "Bong POS is still printing",
        body: "The print agent keeps running in the system tray. Right-click the tray icon and choose Quit to close it.",
        icon: ICON,
      }).show();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    posView = null;
  });

  loadPos();
}

/**
 * POS view fills the window below the title bar.
 *  - Full screen: only a thin handle of the title bar stays visible at the top;
 *    hovering or tapping it slides the bar back in (titlebarRevealed), with an
 *    "exit full screen" button, so touch screens never get stuck.
 *  - Kiosk: the POS takes the whole screen (exit with Ctrl+Shift+K).
 */
const FULLSCREEN_HANDLE = 6;

// Electron's isKiosk() also reports true for plain full screen on Windows,
// so kiosk mode is tracked by its own setting.
function kioskOn() {
  return Boolean(settings.get("kiosk"));
}
let titlebarRevealed = false;

function layoutViews() {
  if (!mainWindow || mainWindow.isDestroyed() || !posView) return;
  const { width, height } = mainWindow.getContentBounds();
  let top = TITLEBAR_HEIGHT;
  if (kioskOn()) top = 0;
  else if (mainWindow.isFullScreen()) top = titlebarRevealed ? TITLEBAR_HEIGHT : FULLSCREEN_HANDLE;
  posView.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) });
}

function toggleFullScreen() {
  if (!mainWindow || kioskOn()) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
}

function setKiosk(on) {
  if (!mainWindow) return;
  mainWindow.setKiosk(on);
  setTimeout(layoutViews, 50);
}

/**
 * Load the POS. When the server is reachable, first drop the cached PWA bundle
 * (service worker + Cache Storage) so every launch runs the newest deploy.
 * Sign-in (cookies, localStorage) is kept. Offline, the cached app is used.
 */
async function loadPos({ clearCache = true } = {}) {
  if (!posContents()) return;
  const url = posUrl();
  if (clearCache && (await isReachable(url))) {
    try {
      await posContents().session.clearStorageData({ origin: posOrigin(), storages: ["serviceworkers", "cachestorage"] });
      await posContents().session.clearCache();
    } catch (err) {
      log.warn(`Could not clear the app cache: ${err.message}`);
    }
  }
  posContents()?.loadURL(url);
}

// ---------------------------------------------------------------- title bar

async function sendTitlebarState() {
  const wc = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
  if (!wc) return;
  const running = agentShouldRun();
  const st = running && agent.isRunning() ? await agent.status() : null;
  wc.send("titlebar:state", {
    version: app.getVersion(),
    agent: !running ? "off" : st?.connected ? "connected" : "offline",
    agentError: st?.lastError || "",
    update: updater.getState(),
    fullScreen: mainWindow.isFullScreen() && !kioskOn(),
    revealed: titlebarRevealed,
  });
}

function fromTitlebar(event) {
  return mainWindow && event.sender === mainWindow.webContents;
}

ipcMain.on("titlebar:menu", (event, pos) => {
  if (!fromTitlebar(event)) return;
  Menu.getApplicationMenu()?.popup({ window: mainWindow, x: Math.round(pos?.x || 0), y: Math.round(pos?.y || TITLEBAR_HEIGHT) });
});
ipcMain.on("titlebar:action", (event, action) => {
  if (!fromTitlebar(event)) return;
  if (action === "settings") openSettings();
  if (action === "printer-tools") openPrinterTools();
  if (action === "install-update") updater.quitAndInstall();
  if (action === "fullscreen") toggleFullScreen();
});
ipcMain.on("titlebar:reveal", (event, show) => {
  if (!fromTitlebar(event) || !mainWindow?.isFullScreen()) return;
  if (titlebarRevealed === Boolean(show)) return;
  titlebarRevealed = Boolean(show);
  layoutViews();
  sendTitlebarState();
});

async function isReachable(url) {
  try {
    const res = await net.fetch(url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(5000) });
    return res.status < 500;
  } catch (_) {
    return false;
  }
}

function showMainWindow() {
  if (!mainWindow) return createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function openExternal(url) {
  if (/^(https?:|mailto:|tel:)/i.test(url)) shell.openExternal(url);
}

// ---------------------------------------------------------------- browser sign-in
//
// Like VS Code: "Sign in with your browser" opens <POS>/desktop-login in the
// system browser (Google sign-in, saved passwords and password managers all
// work there). The browser returns a one-time code through
// bongpos://auth/callback?code=…&state=…, and the POS page in this app
// exchanges it, together with the PKCE verifier that never left this app, for
// its own session.

const PROTOCOL = "bongpos";
const SIGNIN_TTL_MS = 10 * 60 * 1000;
let pendingSignIn = null; // { state, verifier, at }
let readySignIn = null; // { code, verifier, at }

function registerProtocol() {
  if (process.defaultApp) {
    // Development (`electron .`): Windows must start electron.exe with the app folder.
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1] || ".")]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

function findDeepLink(argv = []) {
  return argv.find((arg) => typeof arg === "string" && arg.toLowerCase().startsWith(`${PROTOCOL}://`)) || null;
}

function startBrowserSignIn() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  pendingSignIn = { state, verifier, at: Date.now() };
  const url = new URL("/desktop-login", posOrigin());
  url.searchParams.set("state", state);
  url.searchParams.set("challenge", challenge);
  log.info("Browser sign-in started.");
  shell.openExternal(url.toString());
}

function handleDeepLink(link) {
  let url;
  try {
    url = new URL(link);
  } catch (_) {
    return;
  }
  // bongpos://auth/callback?code=…&state=…
  if (url.hostname !== "auth" || url.pathname.replace(/\/+$/, "") !== "/callback") return;
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const pending = pendingSignIn;
  if (!pending || pending.state !== state || Date.now() - pending.at > SIGNIN_TTL_MS || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
    log.warn("Ignored a sign-in link that this app did not start (or that expired).");
    dialog.showMessageBox(mainWindow || undefined, {
      type: "warning",
      title: "Bong POS",
      message: "This sign-in link has expired.",
      detail: 'Click "Sign in with your browser" in Bong POS again.',
    });
    return;
  }
  pendingSignIn = null;
  readySignIn = { code, verifier: pending.verifier, at: Date.now() };
  log.info("Browser sign-in received; finishing in the app.");
  showMainWindow();
  posContents()?.loadURL(new URL("/desktop-login/complete", posOrigin()).toString());
}

ipcMain.on("desktop:browser-signin", (event) => {
  if (event.sender === posContents() && isPosUrl(event.sender.getURL())) startBrowserSignIn();
});

ipcMain.handle("desktop:take-browser-signin", (event) => {
  if (event.sender !== posContents() || !isPosUrl(event.sender.getURL())) return null;
  const ready = readySignIn;
  readySignIn = null; // one use only
  if (!ready || Date.now() - ready.at > 2 * 60 * 1000) return null;
  return { code: ready.code, verifier: ready.verifier };
});

// ---------------------------------------------------------------- print agent

function agentShouldRun() {
  return settings.get("agentEnabled") && agent.hasToken();
}

function applyAgent({ restart = false } = {}) {
  if (agentShouldRun()) {
    agent.saveConfig({ serverUrl: posOrigin() });
    if (restart) agent.restart();
    else agent.start();
  } else {
    agent.stop();
  }
  updateTrayMenu();
  setTimeout(sendTitlebarState, 3000);
}

// ---------------------------------------------------------------- settings window

function openSettings() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 560,
    height: 720,
    resizable: true,
    minimizable: false,
    maximizable: false,
    parent: mainWindow?.isVisible() ? mainWindow : undefined,
    title: "Bong POS Settings",
    icon: ICON,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "settings-preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.setMenu(null);
  settingsWindow.loadFile(path.join(RENDERER, "settings.html"));
  settingsWindow.once("ready-to-show", () => settingsWindow.show());
  settingsWindow.webContents.on("will-navigate", (e) => e.preventDefault());
  settingsWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  settingsWindow.on("closed", () => (settingsWindow = null));
}

function fromSettings(event) {
  return settingsWindow && event.sender === settingsWindow.webContents;
}

async function settingsSnapshot() {
  return {
    posUrl: settings.get("posUrl"),
    posUrlOverride: argPosUrl,
    kiosk: settings.get("kiosk"),
    fullScreen: settings.get("fullScreen"),
    autoStart: settings.get("autoStart"),
    keepAwake: settings.get("keepAwake"),
    agentEnabled: settings.get("agentEnabled"),
    hasToken: agent.hasToken(),
    agentRunning: agent.isRunning(),
    agentStatus: agent.isRunning() ? await agent.status() : null,
    toolsUrl: agent.toolsUrl,
    update: updater.getState(),
    version: app.getVersion(),
    packaged: app.isPackaged,
  };
}

ipcMain.handle("settings:get", async (event) => (fromSettings(event) ? settingsSnapshot() : null));

ipcMain.handle("settings:save", async (event, patch = {}) => {
  if (!fromSettings(event)) return { ok: false, error: "Not allowed." };
  const errors = [];
  const before = settings.load();
  const next = {};

  if (patch.posUrl !== undefined) {
    const url = settings.normalizePosUrl(patch.posUrl);
    if (!url) errors.push("Enter a valid POS address, for example https://pos.allkh.app");
    else next.posUrl = url;
  }
  for (const key of ["kiosk", "fullScreen", "autoStart", "keepAwake", "agentEnabled"]) {
    if (patch[key] !== undefined) next[key] = Boolean(patch[key]);
  }
  const token = typeof patch.token === "string" ? patch.token.trim() : "";
  if (token && !/^rpa_[A-Za-z0-9_-]{8,}$/.test(token)) errors.push('The agent token should start with "rpa_". Copy it again from Settings > Thermal Printers > Print Agents.');
  if (next.agentEnabled && !token && !agent.hasToken()) errors.push("Paste the print agent token to turn on printing.");
  if (errors.length) return { ok: false, error: errors.join("\n") };

  if (token) agent.saveConfig({ token });
  if (patch.removeToken) agent.saveConfig({ token: "" });
  settings.set(next);

  const urlChanged = next.posUrl && next.posUrl !== before.posUrl;
  if (urlChanged && !argPosUrl) {
    updater.configure(next.posUrl);
    loadPos();
  }
  if (next.kiosk !== undefined) setKiosk(next.kiosk);
  if (next.fullScreen !== undefined && mainWindow && !kioskOn() && mainWindow.isFullScreen() !== next.fullScreen) {
    mainWindow.setFullScreen(next.fullScreen);
  }
  if (next.autoStart !== undefined) applyAutoStart();
  if (next.keepAwake !== undefined) applyKeepAwake();
  applyAgent({ restart: Boolean(token) || urlChanged || patch.removeToken });
  buildMenu();
  return { ok: true, settings: await settingsSnapshot() };
});

ipcMain.handle("settings:test-agent", async (event, token) => {
  if (!fromSettings(event)) return { ok: false, message: "Not allowed." };
  const value = String(token || "").trim() || agent.readConfig().token;
  if (!value) return { ok: false, message: "Paste the agent token first." };
  return agent.testConnection(posOrigin(), value);
});

ipcMain.handle("settings:action", (event, action) => {
  if (!fromSettings(event)) return;
  if (action === "printer-tools") openPrinterTools();
  if (action === "check-updates") updater.check({ manual: true });
  if (action === "open-logs") shell.openPath(path.dirname(log.file()));
  if (action === "open-agent-logs") shell.openPath(path.join(agent.agentHome(), "logs"));
});

// From the POS page and the offline page.
ipcMain.on("desktop:info", (event) => {
  event.returnValue = { isDesktop: true, version: app.getVersion(), platform: process.platform, printAgent: agentShouldRun() };
});
ipcMain.on("desktop:retry", (event) => {
  if (event.sender === posContents()) loadPos();
});
ipcMain.on("desktop:open-settings", (event) => {
  if (event.sender === posContents()) openSettings();
});

// ---------------------------------------------------------------- printer tools

let toolsWindow = null;
function openPrinterTools() {
  if (!agent.isRunning()) {
    dialog.showMessageBox(mainWindow || undefined, {
      type: "info",
      title: "Printer Tools",
      message: "The built-in print agent is off.",
      detail: "Open Settings, paste the print agent token and turn on printing first.",
    });
    return;
  }
  if (toolsWindow) return toolsWindow.focus();
  toolsWindow = new BrowserWindow({
    width: 1000,
    height: 780,
    title: "Bong POS Printer Tools",
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  toolsWindow.setMenu(null);
  toolsWindow.loadURL(agent.toolsUrl);
  toolsWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  toolsWindow.on("closed", () => (toolsWindow = null));
}

// ---------------------------------------------------------------- menu & tray

function setZoom(factor) {
  const value = Math.min(2, Math.max(0.5, Math.round(factor * 10) / 10));
  settings.set({ zoomFactor: value });
  posContents()?.setZoomFactor(value);
}

function toggleKiosk() {
  const kiosk = !settings.get("kiosk");
  settings.set({ kiosk });
  setKiosk(kiosk);
  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: "&Bong POS",
      submenu: [
        { label: "Settings...", accelerator: "CmdOrCtrl+,", click: openSettings },
        { label: "Printer Tools", accelerator: "CmdOrCtrl+Shift+P", click: openPrinterTools },
        { label: "Check for Updates...", click: () => updater.check({ manual: true }) },
        { type: "separator" },
        { label: "Quit", accelerator: "CmdOrCtrl+Q", click: quitApp },
      ],
    },
    {
      label: "&View",
      submenu: [
        { label: "Reload", accelerator: "F5", click: () => posContents()?.reload() },
        { label: "Reload", accelerator: "CmdOrCtrl+R", visible: false, click: () => posContents()?.reload() },
        { label: "Clear Cache and Reload", accelerator: "CmdOrCtrl+Shift+R", click: () => loadPos() },
        { type: "separator" },
        { label: "Zoom In", accelerator: "CmdOrCtrl+=", click: () => setZoom((settings.get("zoomFactor") || 1) + 0.1) },
        { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", visible: false, click: () => setZoom((settings.get("zoomFactor") || 1) + 0.1) },
        { label: "Zoom Out", accelerator: "CmdOrCtrl+-", click: () => setZoom((settings.get("zoomFactor") || 1) - 0.1) },
        { label: "Actual Size", accelerator: "CmdOrCtrl+0", click: () => setZoom(1) },
        { type: "separator" },
        { label: "Full Screen", type: "checkbox", checked: Boolean(mainWindow?.isFullScreen()), accelerator: "F11", click: toggleFullScreen },
        { label: "Kiosk Mode", type: "checkbox", checked: Boolean(settings.get("kiosk")), accelerator: "CmdOrCtrl+Shift+K", click: toggleKiosk },
        { type: "separator" },
        { label: "Developer Tools", accelerator: "CmdOrCtrl+Shift+I", click: () => posContents()?.toggleDevTools() },
      ],
    },
    {
      label: "&Help",
      submenu: [
        { label: "Open Log Folder", click: () => shell.openPath(path.dirname(log.file())) },
        {
          label: "About Bong POS",
          click: () =>
            dialog.showMessageBox(mainWindow || undefined, {
              type: "info",
              title: "About Bong POS",
              message: `Bong POS ${app.getVersion()}`,
              detail: `POS address: ${posUrl()}\nElectron ${process.versions.electron} / Chromium ${process.versions.chrome}`,
              icon: nativeImage.createFromPath(ICON),
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const image = nativeImage.createFromPath(path.join(ASSETS, "tray.png")).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip("Bong POS");
  tray.on("click", showMainWindow);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const printing = agentShouldRun();
  tray.setToolTip(printing ? "Bong POS (print agent on)" : "Bong POS");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Bong POS", click: showMainWindow },
      { type: "separator" },
      { label: printing ? "Print agent: on" : "Print agent: off", enabled: false },
      { label: "Printer Tools", click: openPrinterTools, enabled: printing },
      { label: "Settings...", click: openSettings },
      { label: "Check for Updates...", click: () => updater.check({ manual: true }) },
      { type: "separator" },
      { label: "Quit Bong POS", click: quitApp },
    ])
  );
}

function quitApp() {
  quitting = true;
  app.quit();
}

// ---------------------------------------------------------------- system

function applyAutoStart() {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: Boolean(settings.get("autoStart")), args: [] });
}

function applyKeepAwake() {
  const want = Boolean(settings.get("keepAwake"));
  if (want && keepAwakeId === null) keepAwakeId = powerSaveBlocker.start("prevent-display-sleep");
  if (!want && keepAwakeId !== null) {
    powerSaveBlocker.stop(keepAwakeId);
    keepAwakeId = null;
  }
}

function setupPermissions() {
  const allowed = new Set(["notifications", "media", "clipboard-read", "clipboard-sanitized-write", "fullscreen", "speaker-selection"]);
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(allowed.has(permission) && isPosUrl(details.requestingUrl || wc.getURL()));
  });
}

app.on("second-instance", (_event, argv) => {
  showMainWindow();
  const link = findDeepLink(argv);
  if (link) handleDeepLink(link);
});
app.on("before-quit", () => (quitting = true));
app.on("window-all-closed", () => {
  if (!agentShouldRun()) app.quit();
});

process.on("uncaughtException", (err) => log.error("Uncaught:", err));
process.on("unhandledRejection", (err) => log.error("Unhandled:", err));

app.whenReady().then(() => {
  log.info(`Bong POS ${app.getVersion()} starting (POS ${posUrl()})`);
  setupPermissions();
  registerProtocol();
  buildMenu();
  createTray();
  createMainWindow();
  applyAgent();
  applyAutoStart();
  applyKeepAwake();
  updater.init({ posUrl: posUrl(), window: () => mainWindow });
  updater.onState(() => sendTitlebarState());
  // Started by a bongpos:// link while the app was closed.
  const startLink = findDeepLink(process.argv);
  if (startLink) setTimeout(() => handleDeepLink(startLink), 1500);
  setInterval(sendTitlebarState, 10 * 1000);
});
