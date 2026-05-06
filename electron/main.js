const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadURL('http://localhost:5173')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('read-folder', async (_, folderPath) => {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true })
  return entries
    .filter(e => e.isFile())
    .map(e => ({ name: e.name, path: path.join(folderPath, e.name) }))
})

ipcMain.handle('rename-file', async (_, { oldPath, newPath }) => {
  fs.renameSync(oldPath, newPath)
  return { success: true }
})