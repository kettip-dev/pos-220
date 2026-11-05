const { contextBridge, ipcRenderer } = require("electron");

/**
 * Exposed to the POS website (and the offline page) as window.bongDesktop, so
 * the web app can tell it runs inside the desktop app. Nothing here reads or
 * changes settings or the print agent token.
 */
const info = ipcRenderer.sendSync("desktop:info") || {};

contextBridge.exposeInMainWorld("bongDesktop", {
  isDesktop: true,
  version: info.version,
  platform: info.platform,
  printAgent: Boolean(info.printAgent),
  retry: () => ipcRenderer.send("desktop:retry"),
  openSettings: () => ipcRenderer.send("desktop:open-settings"),
  // "Sign in with your browser" (like VS Code): opens the POS sign-in page in
  // the system browser; it comes back through a bongpos:// link.
  signInWithBrowser: () => ipcRenderer.send("desktop:browser-signin"),
  // Used once by /desktop-login/complete to finish that sign-in.
  takeBrowserSignIn: () => ipcRenderer.invoke("desktop:take-browser-signin"),
});
