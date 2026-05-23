const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("kanbanAgent", {
  platform: process.platform
});
