const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kanbanAgent", {
  platform: process.platform,
  secureKeys: {
    set: (key, value) => ipcRenderer.invoke("secure-key:set", key, value),
    get: (key) => ipcRenderer.invoke("secure-key:get", key),
    delete: (key) => ipcRenderer.invoke("secure-key:delete", key),
    has: (key) => ipcRenderer.invoke("secure-key:has", key)
  },
  repo: {
    selectFolder: () => ipcRenderer.invoke("repo:select-folder"),
    inspect: (options) => ipcRenderer.invoke("repo:inspect", options),
    readFile: (options) => ipcRenderer.invoke("repo:read-file", options)
  }
});
