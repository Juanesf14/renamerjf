const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFolder:   (path) => ipcRenderer.invoke('read-folder', path),
  renameFile:   (paths) => ipcRenderer.invoke('rename-file', paths)
})