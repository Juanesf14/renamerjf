const { contextBridge, ipcRenderer } = require('electron')

// Expose a minimal, explicit API surface to the renderer process.
// contextIsolation (set in main.js) ensures the renderer cannot reach
// raw ipcRenderer or any other Node/Electron internals.
contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: ()      => ipcRenderer.invoke('select-folder'),
  selectFile:   ()      => ipcRenderer.invoke('select-file'),
  readFolder:   (path)  => ipcRenderer.invoke('read-folder', path),
  renameFile:   (paths) => ipcRenderer.invoke('rename-file', paths),
})