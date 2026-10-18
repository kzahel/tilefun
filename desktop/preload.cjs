const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("tilefunDesktop", {
  quit: () => ipcRenderer.send("tilefun-quit"),
  onPrepareQuit: (callback) => ipcRenderer.on("tilefun-prepare-quit", () => callback()),
  finishQuit: (error) =>
    ipcRenderer.send("tilefun-finish-quit", typeof error === "string" ? error : null),
});
