/**
 * 局域网文件互传 · PC 端服务
 * API 供手机 APK / 浏览器调用
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import Busboy from 'busboy'
import { startDiscovery, scanSubnet } from './scripts/discovery.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// exe/pkg 模式：数据目录在 exe 旁边，静态资源在打包快照内
const IS_PKG = typeof process.pkg !== 'undefined'
const APP_BASE = __dirname
const DATA_BASE = IS_PKG || process.env.CAXA_EXECUTABLE
  ? path.dirname(process.env.CAXA_EXECUTABLE || process.execPath)
  : __dirname

let VERSION = '0.0.0'
try {
  VERSION = JSON.parse(fs.readFileSync(path.join(APP_BASE, 'package.json'), 'utf8')).version
} catch { /* dev fallback */ }

const PORT = Number(process.env.PORT || 8787)
const HOST = '0.0.0.0'

function resolveDataDir(primary, legacy) {
  const dir = path.join(DATA_BASE, primary)
  fs.mkdirSync(dir, { recursive: true })
  if (legacy) {
    const leg = path.join(DATA_BASE, legacy)
    if (fs.existsSync(leg)) return leg
  }
  return dir
}

const SHARED_DIR = resolveDataDir('shared', '共享给手机')
const UPLOAD_DIR = resolveDataDir('uploads', '手机上传')
const PUBLIC_DIR = path.join(APP_BASE, 'public')
const MOBILE_DIR = path.join(APP_BASE, 'mobile-app')

for (const dir of [SHARED_DIR, UPLOAD_DIR, PUBLIC_DIR, MOBILE_DIR]) {
  fs.mkdirSync(dir, { recursive: true })
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.apk': 'application/vnd.android.package-archive',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#4F46E5"/><path d="M10 16h12M16 10v12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')
}

function json(res, code, data) {
  cors(res)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function rootDir(key) {
  if (key === 'shared') return SHARED_DIR
  if (key === 'uploads') return UPLOAD_DIR
  throw new Error('invalid root')
}

function safeResolve(base, rel) {
  const resolved = path.resolve(base, rel || '.')
  if (!resolved.startsWith(path.resolve(base))) throw new Error('路径非法')
  return resolved
}

/** 修复 UTF-8 被当成 Latin-1 再编码一次的乱码 */
function fixMojibake(str) {
  if (!str || /[\u4e00-\u9fff]/.test(str)) return str
  try {
    const fixed = Buffer.from(str, 'latin1').toString('utf8')
    if (/[\u4e00-\u9fff]/.test(fixed)) return fixed
  } catch { /* ignore */ }
  return str
}

function decodeRelPath(raw) {
  if (!raw) return ''
  const once = decodeURIComponent(String(raw).replace(/\+/g, ' '))
  return fixMojibake(once)
}

function resolveFile(base, sub) {
  const attempts = [sub, fixMojibake(sub)]
  for (const rel of attempts) {
    if (!rel) continue
    const abs = safeResolve(base, rel)
    if (fs.existsSync(abs)) return abs
  }
  const parent = safeResolve(base, path.dirname(sub || '.'))
  const wanted = path.basename(sub)
  if (fs.existsSync(parent) && fs.statSync(parent).isDirectory()) {
    for (const name of fs.readdirSync(parent)) {
      if (name === wanted || fixMojibake(name) === wanted || name === fixMojibake(wanted)) {
        return path.join(parent, name)
      }
    }
  }
  return null
}

function contentDisposition(name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

function fmtItem(abs, relFromRoot, rootKey) {
  const st = fs.statSync(abs)
  const diskName = path.basename(abs)
  const name = fixMojibake(diskName)
  const rel = relFromRoot.split(path.sep).join('/')
  return {
    name,
    path: `/browse/${rootKey}/${rel}`,
    rel,
    downloadUrl: `/api/download/${rootKey}?p=${encodeURIComponent(rel)}`,
    isDir: st.isDirectory(),
    size: st.isFile() ? st.size : 0,
    mtime: st.mtimeMs,
  }
}

function listDir(absDir, relSub, rootKey) {
  if (!fs.existsSync(absDir)) return []
  return fs
    .readdirSync(absDir)
    .map((name) => {
      const abs = path.join(absDir, name)
      const relFromRoot = relSub ? path.join(relSub, name) : name
      return fmtItem(abs, relFromRoot, rootKey)
    })
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
}

function parseUpload(req, destDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true })
    const saved = []
    const bb = Busboy({ headers: req.headers })
    bb.on('file', (_name, stream, info) => {
      const filename = path.basename(info.filename || `file-${Date.now()}`)
      const dest = path.join(destDir, filename)
      const ws = fs.createWriteStream(dest)
      stream.pipe(ws)
      saved.push(filename)
    })
    bb.on('error', reject)
    bb.on('finish', () => resolve(saved))
    req.pipe(bb)
  })
}

function getLanIpSync() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal && /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(ni.address)) {
        return ni.address
      }
    }
  }
  return '127.0.0.1'
}

const server = http.createServer(async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`)

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, {
        ok: true,
        name: 'lan-share',
        version: VERSION,
        ip: getLanIpSync(),
        port: PORT,
        hostname: os.hostname(),
        time: Date.now(),
      })
    }

    if (req.method === 'GET' && url.pathname === '/api/discover/peers') {
      const self = {
        ip: getLanIpSync(),
        port: PORT,
        version: VERSION,
        hostname: os.hostname(),
        self: true,
      }
      const peers = discovery.getPeers().filter((p) => p.ip !== self.ip)
      return json(res, 200, { ok: true, self, peers })
    }

    if (req.method === 'GET' && url.pathname === '/api/discover/scan') {
      const ip = getLanIpSync()
      const scanned = await scanSubnet(ip, PORT)
      const self = { ip, port: PORT, version: VERSION, hostname: os.hostname(), self: true }
      const peers = scanned.filter((p) => p.ip !== ip)
      return json(res, 200, { ok: true, self, peers, scanned: peers.length + 1 })
    }

    if (req.method === 'GET' && url.pathname === '/api/roots') {
      return json(res, 200, {
        roots: [
          { id: 'uploads', label: '手机上传', icon: 'upload' },
          { id: 'shared', label: '电脑共享', icon: 'folder' },
        ],
      })
    }

    if (req.method === 'GET' && url.pathname === '/favicon.ico') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' })
      return res.end(FAVICON_SVG)
    }

    const browseMatch = url.pathname.match(/^\/api\/browse\/(shared|uploads)(\/.*)?$/)
    if (req.method === 'GET' && browseMatch) {
      const key = browseMatch[1]
      const sub = decodeRelPath((browseMatch[2] || '').replace(/^\//, ''))
      const base = rootDir(key)
      const abs = safeResolve(base, sub)
      if (!fs.existsSync(abs)) return json(res, 404, { error: '不存在' })
      if (!fs.statSync(abs).isDirectory()) return json(res, 400, { error: '不是文件夹' })
      const parent = sub ? '/' + sub.split(/[/\\]/).slice(0, -1).join('/') : '/'
      return json(res, 200, {
        root: key,
        path: sub ? '/' + sub.split(path.sep).join('/') : '/',
        parent: parent === '/' ? '/' : parent,
        items: listDir(abs, sub, key),
      })
    }

    const dlMatch = url.pathname.match(/^\/api\/download\/(shared|uploads)$/)
    if (req.method === 'GET' && dlMatch) {
      const key = dlMatch[1]
      const sub = decodeRelPath(url.searchParams.get('p') || '')
      if (!sub) {
        res.writeHead(400)
        return res.end('missing path')
      }
      const abs = resolveFile(rootDir(key), sub)
      if (!abs || !fs.statSync(abs).isFile()) {
        res.writeHead(404)
        return res.end('Not found')
      }
      const stat = fs.statSync(abs)
      const ext = path.extname(abs).toLowerCase()
      const fname = fixMojibake(path.basename(abs))
      const range = req.headers.range
      if (range) {
        const m = range.match(/bytes=(\d+)-(\d*)/)
        if (m) {
          const start = Number(m[1])
          const end = m[2] ? Number(m[2]) : stat.size - 1
          res.writeHead(206, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Disposition': contentDisposition(fname),
          })
          return fs.createReadStream(abs, { start, end }).pipe(res)
        }
      }
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': contentDisposition(fname),
      })
      return fs.createReadStream(abs).pipe(res)
    }

    // 兼容旧版路径式下载
    const dlLegacy = url.pathname.match(/^\/api\/download\/(shared|uploads)(\/.*)$/)
    if (req.method === 'GET' && dlLegacy) {
      const key = dlLegacy[1]
      const sub = decodeRelPath(dlLegacy[2].replace(/^\//, ''))
      const abs = resolveFile(rootDir(key), sub)
      if (!abs || !fs.statSync(abs).isFile()) {
        res.writeHead(404)
        return res.end('Not found')
      }
      const stat = fs.statSync(abs)
      const ext = path.extname(abs).toLowerCase()
      const fname = fixMojibake(path.basename(abs))
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': contentDisposition(fname),
      })
      return fs.createReadStream(abs).pipe(res)
    }

    if (req.method === 'POST' && url.pathname === '/api/upload') {
      const target = url.searchParams.get('target') || 'uploads'
      const sub = decodeRelPath(url.searchParams.get('path') || '').replace(/^\//, '')
      const dir = safeResolve(rootDir(target), sub)
      const saved = await parseUpload(req, dir)
      return json(res, 200, { ok: true, saved, count: saved.length })
    }

    // 静态页（浏览器备用）
    const staticRoots = [PUBLIC_DIR, MOBILE_DIR]
    if (req.method === 'GET') {
      let rel = url.pathname === '/' ? '/index.html' : url.pathname
      for (const root of staticRoots) {
        const file = path.join(root, rel.replace(/^\//, ''))
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
          const ext = path.extname(file).toLowerCase()
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
          return fs.createReadStream(file).pipe(res)
        }
      }
    }

    json(res, 404, { error: 'Not found' })
  } catch (e) {
    json(res, 500, { error: e.message })
  }
})

const discovery = startDiscovery({ port: PORT, version: VERSION, getIp: getLanIpSync })

server.listen(PORT, HOST, () => {
  const ip = getLanIpSync()
  console.log('')
  console.log(`  LanShare Server v${VERSION}`)
  console.log(`  API:     http://${ip}:${PORT}/api/health`)
  console.log(`  Web UI:  http://${ip}:${PORT}/`)
  console.log(`  Connect: http://${ip}:${PORT}`)
  console.log('')
  console.log(`  Uploads  → ${UPLOAD_DIR}`)
  console.log(`  Shared   → ${SHARED_DIR}`)
  console.log('')
})
