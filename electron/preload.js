const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile:   () => ipcRenderer.invoke('select-file'),
  readFolder:   (path) => ipcRenderer.invoke('read-folder', path),
  renameFile:   (paths) => ipcRenderer.invoke('rename-file', paths)
})