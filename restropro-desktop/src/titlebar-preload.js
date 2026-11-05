const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("titlebar", {
  openMenu: (x, y) => ipcRenderer.send("titlebar:menu", { x, y }),
  action: (name) => ipcRenderer.send("titlebar:action", name),
  reveal: (show) => ipcRenderer.send("titlebar:reveal", Boolean(show)),
  onState: (fn) => ipcRenderer.on("titlebar:state", (_e, state) => fn(state)),
});
