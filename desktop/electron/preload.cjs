/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "akisDesktop",
  Object.freeze({
    loadWorkspace: () => ipcRenderer.invoke("workspace:load"),
    saveWorkspace: (data) => ipcRenderer.invoke("workspace:save", data),
    getSaveInfo: () => ipcRenderer.invoke("workspace:info"),
    openSaveFolder: () => ipcRenderer.invoke("workspace:open-folder"),
  }),
);
