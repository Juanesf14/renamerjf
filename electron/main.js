const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const isProd = app.isPackaged

// En la versión pública no hay DB pre-cargada — se crea vacía en userData
function ensureDatabase() {
  const userDataDb = path.join(app.getPath('userData'), 'renamerjf.db')
  process.env.DB_PATH = userDataDb
  fs.mkdirSync(path.dirname(userDataDb), { recursive: true })
}

function startBackend() {
  if (!isProd) return

  ensureDatabase()

  process.env.NODE_ENV = 'production'
  process.env.PORT     = process.env.PORT || '3001'

  // Credenciales seed (solo se usan si la DB está vacía en el primer inicio)
  process.env.SEED_ADMIN_NAME     = 'Corina Ortega'
  process.env.SEED_ADMIN_EMAIL    = 'cortega@kpattorney.com'
  process.env.SEED_ADMIN_PASSWORD = 'BossMR2026'
  process.env.SEED_USER_NAME      = 'Juan Fajardo'
  process.env.SEED_USER_EMAIL     = 'juanesf14@gmail.com'
  process.env.SEED_USER_PASSWORD  = 'Saravalentina146*'
  process.env.SEED_USER2_NAME     = 'Juan Fajardo'
  process.env.SEED_USER2_EMAIL    = 'jfajardo@kpattorney.com'
  process.env.SEED_USER2_PASSWORD = 'Saravalentina146*'

  // JWT_SECRET: usa variable de entorno si existe, si no genera uno persistente
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
    console.log('[backend] iniciado en puerto', process.env.PORT)
  } catch (err) {
    console.error('[backend] error al iniciar:', err)
    dialog.showErrorBox('Error al iniciar backend', err.message + '\n\n' + err.stack)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
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
  const delay = isProd ? 1500 : 0
  setTimeout(createWindow, delay)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Normaliza separadores de path para Windows
const normPath = p => (p || '').replace(/\\/g, '/')

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : normPath(result.filePaths[0])
})

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Documentos', extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] },
      { name: 'Todos los archivos', extensions: ['*'] },
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
