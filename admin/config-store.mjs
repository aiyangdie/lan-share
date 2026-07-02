import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')

function defaultConfig() {
  return {
    updatedAt: Date.now(),
    announcement: {
      enabled: false,
      title: '',
      message: '',
      linkUrl: '',
      level: 'info',
    },
    android: {
      version: '1.4.0',
      versionCode: 10400,
      url: '',
      mandatory: false,
      changelog: '',
    },
    windows: {
      version: '1.4.0',
      url: '',
      mandatory: false,
      changelog: '',
    },
  }
}

export function readConfig() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(CONFIG_FILE)) {
    const cfg = defaultConfig()
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n')
    return cfg
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
    return { ...defaultConfig(), ...cfg, announcement: { ...defaultConfig().announcement, ...cfg.announcement }, android: { ...defaultConfig().android, ...cfg.android }, windows: { ...defaultConfig().windows, ...cfg.windows } }
  } catch {
    return defaultConfig()
  }
}

export function writeConfig(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  data.updatedAt = Date.now()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2) + '\n')
  return data
}

export function parseVersion(v) {
  const parts = String(v || '0').split('.').map((n) => parseInt(n, 10) || 0)
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 }
}

export function compareVersion(a, b) {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  if (va.major !== vb.major) return va.major - vb.major
  if (va.minor !== vb.minor) return va.minor - vb.minor
  return va.patch - vb.patch
}

export function normalizeAnnouncement(raw, fallback) {
  const base = { ...fallback, ...raw }
  const level = ['info', 'warn', 'urgent'].includes(base.level) ? base.level : 'info'
  return {
    enabled: !!base.enabled,
    title: String(base.title || '').slice(0, 80),
    message: String(base.message || '').slice(0, 500),
    linkUrl: String(base.linkUrl || '').slice(0, 2048),
    level,
  }
}

export function normalizePlatformUpdate(raw, fallback) {
  const base = { ...fallback, ...raw }
  return {
    version: String(base.version || '0.0.0').slice(0, 32),
    versionCode: Math.max(0, parseInt(base.versionCode, 10) || 0),
    url: String(base.url || '').slice(0, 2048),
    mandatory: !!base.mandatory,
    changelog: String(base.changelog || '').slice(0, 2000),
  }
}

export function publicUpdatePayload(cfg, platform, currentVersion, currentCode) {
  const out = {
    ok: true,
    updatedAt: cfg.updatedAt,
    announcement: null,
    update: null,
  }
  if (cfg.announcement?.enabled) {
    out.announcement = {
      title: cfg.announcement.title,
      message: cfg.announcement.message,
      linkUrl: cfg.announcement.linkUrl,
      level: cfg.announcement.level,
    }
  }
  const key = platform === 'windows' ? 'windows' : 'android'
  const remote = cfg[key]
  if (!remote?.url || !remote?.version) return out
  let available = false
  if (key === 'android' && currentCode) {
    available = remote.versionCode > Number(currentCode)
  } else if (currentVersion) {
    available = compareVersion(remote.version, currentVersion) > 0
  } else {
    available = true
  }
  if (available) {
    out.update = {
      platform: key,
      version: remote.version,
      versionCode: remote.versionCode || 0,
      url: remote.url,
      mandatory: remote.mandatory,
      changelog: remote.changelog,
    }
  }
  return out
}

export function checkWindowsUpdate(localVersion) {
  const cfg = readConfig()
  const remote = cfg.windows
  if (!remote?.url || !remote?.version) return null
  if (compareVersion(remote.version, localVersion) <= 0) return null
  return remote
}
