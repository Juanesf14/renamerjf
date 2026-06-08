const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const isProd = app.isPackaged

/**
 * Points DB_PATH to the OS user-data directory so the database survives
 * app updates (which would otherwise wipe the app bundle's working dir).
 */
function ensureDatabase() {
  const userDataDb = path.join(app.getPath('userData'), 'renamerjf.db')
  process.env.DB_PATH = userDataDb
  fs.mkdirSync(path.dirname(userDataDb), { recursive: true })
}

/**
 * Boots the Express backend in-process. Only runs in packaged (production) builds;
 * in dev the backend is started separately via `npm run dev` in the backend folder.
 *
 * Seed credentials are read from the .env before first launch:
 *   SEED_ADMIN_NAME / EMAIL / PASSWORD
 *   SEED_USER_NAME  / EMAIL / PASSWORD
 */
function startBackend() {
  if (!isProd) return

  ensureDatabase()

  process.env.NODE_ENV = 'production'
  process.env.PORT     = process.env.PORT || '3001'

  // Generate a persistent JWT secret on first launch and reuse it across restarts
  // so existing tokens stay valid after an update.
  if (!process.env.JWT_SECRET) {
    const secretFile = path.join(app.getPath('userData'), '.jwt_secret')
    if (fs.existsSync(secretFile)) {
      process.env.JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim()
    } else {
      const secret = crypto.randomBytes(32).toString('hex')
      fs.writeFileSync(secretFile, secret)
      process.env.JWT_SECRET = secret
    }
  }

  try {
    require('../backend/src/index.js')
    console.log('[backend] started on port', process.env.PORT)
  } catch (err) {
    console.error('[backend] startup error:', err)
    dialog.showErrorBox('Backend startup error', err.message + '\n\n' + err.stack)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,  // renderer cannot access Node APIs directly
      nodeIntegration: false,
    },
  })

  if (isProd) {
    win.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'))
  } else {
    win.loadURL('http://localhost:5173')
  }
}

app.whenReady().then(() => {
  startBackend()
  // In production, give the backend time to bind its port before the window loads.
  const delay = isProd ? 1500 : 0
  setTimeout(createWindow, delay)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Normalise Windows backslashes so the frontend can use the path in string operations.
const normPath = p => (p || '').replace(/\\/g, '/')

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : normPath(result.filePaths[0])
})

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  if (result.canceled) return null
  const filePath = result.filePaths[0]
  const name = path.basename(filePath)
  return { name, path: normPath(filePath) }
})

ipcMain.handle('read-folder', async (_, folderPath) => {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true })
  return entries
    .filter(e => e.isFile())
    .map(e => ({ name: e.name, path: normPath(path.join(folderPath, e.name)) }))
})

ipcMain.handle('rename-file', async (_, { oldPath, newPath }) => {
  fs.renameSync(oldPath, newPath)
  return { success: true }
})
