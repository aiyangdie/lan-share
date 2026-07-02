import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { detectHostDeviceInfo } from './device-info.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

export function getDataBase() {
  if (process.env.LANSHARE_DATA_DIR) return process.env.LANSHARE_DATA_DIR
  if (process.env.CAXA_EXECUTABLE) return path.dirname(process.env.CAXA_EXECUTABLE)
  if (typeof process.pkg !== 'undefined') return path.dirname(process.execPath)
  return ROOT
}

const SETTINGS_FILE = () => process.env.SETTINGS_FILE || path.join(getDataBase(), 'settings.json')

export function defaultSettings(dataBase = getDataBase()) {
  const host = detectHostDeviceInfo()
  return {
    version: 3,
    port: 8787,
    deviceName: host.deviceName,
    deviceType: host.deviceType,
    deviceBrand: host.deviceBrand,
    deviceModel: host.deviceModel,
    uploadDir: path.join(dataBase, 'uploads'),
    sharedDir: path.join(dataBase, 'shared'),
    autoSaveIncoming: true,
    openAtLogin: true,
    minimizeToTray: true,
    startMinimized: false,
    autoOpenBrowser: true,
    updatedAt: Date.now(),
  }
}

function normalizeDeviceType(t) {
  return ['desktop', 'phone', 'tablet'].includes(t) ? t : 'desktop'
}

function normalizeSettings(raw, dataBase) {
  const base = defaultSettings(dataBase)
  const merged = { ...base, ...raw }
  const host = detectHostDeviceInfo()
  const deviceBrand = String(merged.deviceBrand || '').trim() || host.deviceBrand
  const deviceModel = String(merged.deviceModel || '').trim() || host.deviceModel
  let deviceName = String(merged.deviceName || base.deviceName).slice(0, 32)
  if (deviceName === os.hostname() && host.deviceName && host.deviceName !== deviceName) {
    deviceName = host.deviceName.slice(0, 32)
  }
  return {
    version: 3,
    port: Math.min(65535, Math.max(1024, Number(merged.port) || 8787)),
    deviceName,
    deviceType: normalizeDeviceType(merged.deviceType || host.deviceType),
    deviceBrand: String(deviceBrand).slice(0, 32),
    deviceModel: String(deviceModel).slice(0, 64),
    uploadDir: String(merged.uploadDir || base.uploadDir),
    sharedDir: String(merged.sharedDir || base.sharedDir),
    autoSaveIncoming: merged.autoSaveIncoming !== false,
    openAtLogin: merged.openAtLogin !== false,
    minimizeToTray: merged.minimizeToTray !== false,
    startMinimized: !!merged.startMinimized,
    autoOpenBrowser: merged.autoOpenBrowser !== false,
    updatedAt: Date.now(),
  }
}

export function readSettings() {
  const dataBase = getDataBase()
  const file = SETTINGS_FILE()
  fs.mkdirSync(dataBase, { recursive: true })
  if (!fs.existsSync(file)) {
    const cfg = defaultSettings(dataBase)
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n')
    return cfg
  }
  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(file, 'utf8')), dataBase)
  } catch {
    return defaultSettings(dataBase)
  }
}

export function writeSettings(patch) {
  const current = readSettings()
  const next = normalizeSettings({ ...current, ...patch }, getDataBase())
  fs.mkdirSync(path.dirname(next.uploadDir), { recursive: true })
  fs.mkdirSync(path.dirname(next.sharedDir), { recursive: true })
  fs.mkdirSync(next.uploadDir, { recursive: true })
  fs.mkdirSync(next.sharedDir, { recursive: true })
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(next, null, 2) + '\n')
  return next
}

export function resolveLegacyDir(primary, legacyName, configured) {
  if (configured && fs.existsSync(configured)) return configured
  const dataBase = getDataBase()
  const primaryPath = path.join(dataBase, primary)
  fs.mkdirSync(primaryPath, { recursive: true })
  if (legacyName) {
    const leg = path.join(dataBase, legacyName)
    if (fs.existsSync(leg)) return leg
  }
  return configured || primaryPath
}

export function devicePayload(settings) {
  const s = settings || readSettings()
  return {
    deviceName: s.deviceName,
    deviceType: s.deviceType,
    deviceBrand: s.deviceBrand || '',
    deviceModel: s.deviceModel || '',
  }
}

export { SETTINGS_FILE }
