import { app, BrowserWindow, Tray, Menu, shell, nativeImage, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', '..')

let tray = null
let settingsWin = null
let serverProc = null

async function loadSettingsModule() {
  const modPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'server', 'settings-store.mjs')
    : path.join(ROOT, 'server', 'settings-store.mjs')
  return import(`file://${modPath}`)
}

function appRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'app') : ROOT
}

function startServer() {
  if (serverProc) return
  const root = appRoot()
  const serverScript = path.join(root, 'server.mjs')
  const settingsPath = path.join(app.getPath('userData'), 'settings.json')
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    LANSHARE_DATA_DIR: app.getPath('userData'),
    SETTINGS_FILE: settingsPath,
  }
  serverProc = spawn(process.execPath, [serverScript], {
    cwd: root,
    env,
    stdio: 'ignore',
    windowsHide: true,
  })
  serverProc.on('exit', () => { serverProc = null })
}

function stopServer() {
  if (serverProc) {
    serverProc.kill()
    serverProc = null
  }
}

async function applyLoginItem() {
  try {
    const { readSettings } = await loadSettingsModule()
    process.env.LANSHARE_DATA_DIR = app.getPath('userData')
    const s = readSettings()
    app.setLoginItemSettings({
      openAtLogin: !!s.openAtLogin,
      path: process.execPath,
      args: app.isPackaged ? [] : ['.'],
    })
  } catch { /* ignore */ }
}

function openSettingsWindow() {
  if (settingsWin) {
    settingsWin.show()
    settingsWin.focus()
    return
  }
  settingsWin = new BrowserWindow({
    width: 520,
    height: 640,
    resizable: false,
    autoHideMenuBar: true,
    title: 'LanShare 设置',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (process.env.VITE_DEV_SERVER_URL) {
    settingsWin.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    settingsWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
  settingsWin.on('closed', () => { settingsWin = null })
}

function openMainUi() {
  const settings = { port: 8787 }
  shell.openExternal(`http://127.0.0.1:${settings.port}/`)
}

function buildTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,' + Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#4F46E5"/><path d="M10 16h12M16 10v12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>'
    ).toString('base64')
  )
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('LanShare 电脑互传')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开主界面', click: openMainUi },
    { label: '设置', click: openSettingsWindow },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit() } },
  ]))
  tray.on('double-click', openMainUi)
}

ipcMain.handle('settings:get', async () => {
  const { readSettings } = await loadSettingsModule()
  process.env.LANSHARE_DATA_DIR = app.getPath('userData')
  return readSettings()
})

ipcMain.handle('settings:save', async (_e, patch) => {
  const { writeSettings } = await loadSettingsModule()
  process.env.LANSHARE_DATA_DIR = app.getPath('userData')
  const next = writeSettings(patch)
  await applyLoginItem()
  return { ok: true, settings: next, restartRequired: true }
})

ipcMain.handle('app:openFolder', async (_e, folderPath) => {
  if (folderPath && fs.existsSync(folderPath)) await shell.openPath(folderPath)
})

ipcMain.handle('app:openMain', openMainUi)

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    openSettingsWindow()
  })

  app.whenReady().then(async () => {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    process.env.LANSHARE_DATA_DIR = app.getPath('userData')
    startServer()
    await applyLoginItem()
    buildTray()
    const { readSettings } = await loadSettingsModule()
    const s = readSettings()
    if (!s.startMinimized) openSettingsWindow()
    if (s.autoOpenBrowser) setTimeout(openMainUi, 1500)
  })

  app.on('before-quit', stopServer)
  app.on('window-all-closed', (e) => {
    e.preventDefault()
  })
}
