const electron = require("electron");

electron.contextBridge.exposeInMainWorld("api", {
  processVideo(data) {
    electron.ipcRenderer.send("ipc-process-video", data);
  },
  on(channel, fn) {
    electron.ipcRenderer.on(channel, (event, ...args) => {
      fn(...args);
    });
  },
});
