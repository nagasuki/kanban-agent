const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kanbanAgent", {
  platform: process.platform,
  secureKeys: {
    set: (key, value) => ipcRenderer.invoke("secure-key:set", key, value),
    get: (key) => ipcRenderer.invoke("secure-key:get", key),
    delete: (key) => ipcRenderer.invoke("secure-key:delete", key),
    has: (key) => ipcRenderer.invoke("secure-key:has", key)
  },
  updates: {
    getInfo: () => ipcRenderer.invoke("updates:get-info"),
    check: (options) => ipcRenderer.invoke("updates:check", options)
  },
  repo: {
    selectFolder: () => ipcRenderer.invoke("repo:select-folder"),
    inspect: (options) => ipcRenderer.invoke("repo:inspect", options),
    switchBranch: (options) => ipcRenderer.invoke("repo:switch-branch", options),
    readFile: (options) => ipcRenderer.invoke("repo:read-file", options),
    applyPatch: (options) => ipcRenderer.invoke("repo:apply-patch", options),
    runCommand: (options) => ipcRenderer.invoke("repo:run-command", options),
    gitCommit: (options) => ipcRenderer.invoke("repo:git-commit", options),
    commitChanges: (options) => ipcRenderer.invoke("repo:commit-changes", options),
    gitCheckoutFiles: (options) => ipcRenderer.invoke("repo:git-checkout-files", options),
    rollbackFiles: (options) => ipcRenderer.invoke("repo:rollback-files", options),
    githubPr: (options) => ipcRenderer.invoke("repo:github-pr", options)
  },
  cli: {
    run: (options) => ipcRenderer.invoke("cli:run", options),
    sendInput: (options) => ipcRenderer.invoke("cli:input", options),
    cancel: (options) => ipcRenderer.invoke("cli:cancel", options),
    test: (options) => ipcRenderer.invoke("cli:test", options),
    onOutput: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("cli:output", listener);
      return () => ipcRenderer.removeListener("cli:output", listener);
    }
  }
});
