/**
 * LanShare 后台 · 广告 / 公告 / 在线更新
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  readConfig,
  writeConfig,
  normalizeAnnouncement,
  normalizePlatformUpdate,
  publicUpdatePayload,
} from './config-store.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ADMIN_DIR = __dirname
const DATA_DIR = path.join(ADMIN_DIR, 'data')
const PUBLIC_DIR = path.join(ADMIN_DIR, 'public')
const ADS_FILE = path.join(DATA_DIR, 'ads.json')

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lanshare2026'
const sessions = new Map()

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(ADS_FILE)) {
    fs.writeFileSync(ADS_FILE, JSON.stringify(defaultAds(), null, 2) + '\n')
  }
  readConfig()
}

function defaultAds() {
  return {
    version: 1,
    updatedAt: Date.now(),
    slots: {
      banner: emptySlot('广告', '#4F46E5', '#FFFFFF'),
      setup: emptySlot('推荐', '#EEF2FF', '#4338CA'),
    },
  }
}

function emptySlot(badge, bgColor, textColor) {
  return { enabled: false, title: '', subtitle: '', imageUrl: '', linkUrl: '', bgColor, textColor, badge }
}

function readAds() {
  ensureData()
  try {
    return JSON.parse(fs.readFileSync(ADS_FILE, 'utf8'))
  } catch {
    return defaultAds()
  }
}

function writeAds(data) {
  ensureData()
  data.updatedAt = Date.now()
  fs.writeFileSync(ADS_FILE, JSON.stringify(data, null, 2) + '\n')
  return data
}

function json(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('JSON 格式错误'))
      }
    })
    req.on('error', reject)
  })
}

function createToken() {
  const token = crypto.randomBytes(24).toString('hex')
  sessions.set(token, Date.now() + 86400000)
  return token
}

function authToken(req) {
  const raw = req.headers.authorization || ''
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : ''
  if (!token || !sessions.has(token)) return null
  const exp = sessions.get(token)
  if (Date.now() > exp) {
    sessions.delete(token)
    return null
  }
  return token
}

function normalizeSlot(slot, fallback) {
  const base = { ...fallback, ...slot }
  return {
    enabled: !!base.enabled,
    title: String(base.title || '').slice(0, 80),
    subtitle: String(base.subtitle || '').slice(0, 160),
    imageUrl: String(base.imageUrl || '').slice(0, 2048),
    linkUrl: String(base.linkUrl || '').slice(0, 2048),
    bgColor: String(base.bgColor || '#4F46E5').slice(0, 32),
    textColor: String(base.textColor || '#FFFFFF').slice(0, 32),
    badge: String(base.badge || '广告').slice(0, 12),
  }
}

function publicAdsPayload(data) {
  const out = { version: data.version, updatedAt: data.updatedAt, slots: {} }
  for (const [key, slot] of Object.entries(data.slots || {})) {
    if (!slot?.enabled) continue
    out.slots[key] = {
      title: slot.title,
      subtitle: slot.subtitle,
      imageUrl: slot.imageUrl,
      linkUrl: slot.linkUrl,
      bgColor: slot.bgColor,
      textColor: slot.textColor,
      badge: slot.badge,
    }
  }
  return out
}

function serveStatic(res, rel) {
  const file = path.join(PUBLIC_DIR, rel.replace(/^\//, ''))
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
  return true
}

function corsOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end()
}

/** @returns {boolean} handled */
export async function handleAdminRequest(req, res, url) {
  ensureData()

  const isPublicApi = url.pathname === '/api/ads' || url.pathname === '/api/update'
  if (req.method === 'OPTIONS' && (url.pathname.startsWith('/admin') || isPublicApi)) {
    corsOptions(res)
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/ads') {
    json(res, 200, { ok: true, ...publicAdsPayload(readAds()) })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/update') {
    const platform = url.searchParams.get('platform') || 'android'
    const version = url.searchParams.get('version') || ''
    const versionCode = url.searchParams.get('versionCode') || ''
    const cfg = readConfig()
    json(res, 200, publicUpdatePayload(cfg, platform, version, versionCode))
    return true
  }

  if (req.method === 'POST' && url.pathname === '/admin/api/login') {
    try {
      const body = await readBody(req)
      if (body.password !== ADMIN_PASSWORD) {
        json(res, 401, { error: '密码错误' })
        return true
      }
      json(res, 200, { ok: true, token: createToken() })
    } catch (e) {
      json(res, 400, { error: e.message })
    }
    return true
  }

  if (url.pathname.startsWith('/admin/api/')) {
    if (!authToken(req)) {
      json(res, 401, { error: '未登录或登录已过期' })
      return true
    }

    if (req.method === 'GET' && url.pathname === '/admin/api/ads') {
      json(res, 200, { ok: true, data: readAds() })
      return true
    }

    if (req.method === 'PUT' && url.pathname === '/admin/api/ads') {
      try {
        const body = await readBody(req)
        const current = readAds()
        const merged = {
          version: current.version,
          slots: {
            banner: normalizeSlot(body.slots?.banner, current.slots.banner),
            setup: normalizeSlot(body.slots?.setup, current.slots.setup),
          },
        }
        writeAds(merged)
        json(res, 200, { ok: true, data: merged })
      } catch (e) {
        json(res, 400, { error: e.message })
      }
      return true
    }

    if (req.method === 'GET' && url.pathname === '/admin/api/config') {
      json(res, 200, { ok: true, data: readConfig() })
      return true
    }

    if (req.method === 'PUT' && url.pathname === '/admin/api/config') {
      try {
        const body = await readBody(req)
        const current = readConfig()
        const merged = {
          announcement: normalizeAnnouncement(body.announcement, current.announcement),
          android: normalizePlatformUpdate(body.android, current.android),
          windows: normalizePlatformUpdate(body.windows, current.windows),
        }
        writeConfig(merged)
        json(res, 200, { ok: true, data: merged })
      } catch (e) {
        json(res, 400, { error: e.message })
      }
      return true
    }

    if (req.method === 'POST' && url.pathname === '/admin/api/logout') {
      const token = authToken(req)
      if (token) sessions.delete(token)
      json(res, 200, { ok: true })
      return true
    }

    json(res, 404, { error: 'Not found' })
    return true
  }

  if (req.method === 'GET' && url.pathname.startsWith('/admin')) {
    const rel = url.pathname === '/admin' || url.pathname === '/admin/'
      ? '/index.html'
      : url.pathname.replace(/^\/admin/, '')
    if (serveStatic(res, rel)) return true
    if (serveStatic(res, '/index.html')) return true
  }

  return false
}

export { PUBLIC_DIR as ADMIN_PUBLIC_DIR, ADS_FILE }
