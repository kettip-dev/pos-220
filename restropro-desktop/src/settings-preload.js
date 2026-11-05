const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsApi", {
  get: () => ipcRenderer.invoke("settings:get"),
  save: (patch) => ipcRenderer.invoke("settings:save", patch),
  testAgent: (token) => ipcRenderer.invoke("settings:test-agent", token),
  action: (name) => ipcRenderer.invoke("settings:action", name),
});
