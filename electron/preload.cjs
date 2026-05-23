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
    readFile: (options) => ipcRenderer.invoke("repo:read-file", options),
    applyPatch: (options) => ipcRenderer.invoke("repo:apply-patch", options),
    runCommand: (options) => ipcRenderer.invoke("repo:run-command", options),
    gitCommit: (options) => ipcRenderer.invoke("repo:git-commit", options),
    gitCheckoutFiles: (options) => ipcRenderer.invoke("repo:git-checkout-files", options),
    githubPr: (options) => ipcRenderer.invoke("repo:github-pr", options)
  },
  cli: {
    run: (options) => ipcRenderer.invoke("cli:run", options)
  }
});
