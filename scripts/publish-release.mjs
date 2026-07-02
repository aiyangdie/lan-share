#!/usr/bin/env node
/**
 * Create GitHub Release v{VERSION} and upload all artifacts from releases/
 * Auth: git credential-manager (same as git push)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawnSync } from 'node:child_process'
import https from 'node:https'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const REPO = 'aiyangdie/lan-share'

const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim()
const TAG = `v${version}`
const RELEASES = path.join(ROOT, 'releases')

function getGitToken() {
  const git = process.env.GIT_EXE || 'C:\\Users\\aike1\\Documents\\_dev_tools\\PortableGit\\bin\\git.exe'
  const input = 'protocol=https\nhost=github.com\n\n'
  const r = spawnSync(git, ['credential', 'fill'], { input, encoding: 'utf8' })
  if (r.status !== 0) throw new Error('无法读取 GitHub 凭据，请先 git push 登录一次')
  const out = r.stdout || ''
  const pass = out.match(/^password=(.+)$/m)?.[1]
  const user = out.match(/^username=(.+)$/m)?.[1]
  if (!pass) throw new Error('未找到 GitHub token，请配置 Git Credential Manager')
  return { user, token: pass }
}

function api(method, apiPath, body, token, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body))
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${REPO}${apiPath}`,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'lan-share-publish',
        ...(data ? { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        let json = null
        try { json = raw ? JSON.parse(raw) : null } catch { /* ignore */ }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ status: res.statusCode, json, headers: res.headers })
        else reject(new Error(`${method} ${apiPath} → ${res.statusCode}: ${json?.message || raw}`))
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function uploadAsset(uploadUrl, filePath, token) {
  return new Promise((resolve, reject) => {
    const name = path.basename(filePath)
    const buf = fs.readFileSync(filePath)
    const baseUrl = uploadUrl.replace(/\{\?name,label\}/, '')
    const url = new URL(`${baseUrl}?name=${encodeURIComponent(name)}`)
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/octet-stream',
        'Content-Length': buf.length,
        'User-Agent': 'lan-share-publish',
      },
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(name)
        else reject(new Error(`upload ${name} → ${res.statusCode}: ${Buffer.concat(chunks).toString()}`))
      })
    })
    req.on('error', reject)
    req.write(buf)
    req.end()
  })
}

function collectAssets() {
  const names = [
    `lan-share-v${version}-android.apk`,
    `lan-share-v${version}-android-phone.apk`,
    `lan-share-v${version}-android-tablet.apk`,
    `lan-share-v${version}-windows-portable.zip`,
    `lan-share-v${version}-windows.zip`,
    `lan-share-v${version}-windows-desktop.exe`,
    `lan-share-v${version}-server-windows-x64.zip`,
    `lan-share-v${version}-linux-x64.tar.gz`,
    `lan-share-v${version}-macos-x64.tar.gz`,
    `lan-share-v${version}-ios-iphone.txt`,
    `lan-share-v${version}-ios-ipad.txt`,
    `lan-share-v${version}-ios-pwa.txt`,
  ]
  const files = []
  for (const name of names) {
    const p = path.join(RELEASES, name)
    const alt = path.join(RELEASES, 'archive', `v${version}`, name)
    if (fs.existsSync(p)) files.push(p)
    else if (fs.existsSync(alt)) files.push(alt)
    else console.warn(`⚠ 缺少: ${name}`)
  }
  return files
}

function ensureTag() {
  const git = process.env.GIT_EXE || 'C:\\Users\\aike1\\Documents\\_dev_tools\\PortableGit\\bin\\git.exe'
  const safe = `-c safe.directory=${ROOT.replace(/\\/g, '/')}`
  try {
    execSync(`"${git}" ${safe} -C "${ROOT}" rev-parse ${TAG}`, { stdio: 'pipe' })
    console.log(`Tag ${TAG} 已存在`)
  } catch {
    execSync(`"${git}" ${safe} -C "${ROOT}" tag -a ${TAG} -m "LanShare ${TAG}"`, { stdio: 'inherit' })
    console.log(`Created tag ${TAG}`)
  }
  try {
    execSync(`"${git}" ${safe} -C "${ROOT}" push origin ${TAG}`, { stdio: 'pipe' })
  } catch {
    console.log(`Tag ${TAG} 已在远程`)
  }
}

const bodyText = `## LanShare ${TAG}

### 更新内容（v1.5.004）
- **主界面本机 ↔ 对方关系条**：传文件时一眼看出「我是手机/平板/电脑」和「对方是谁」
- **切换对方**：手机/平板可换连另一台电脑；电脑端可刷新查看连入的设备
- **电脑可见连入手机**：手机 App 连接后，电脑浏览器「对方」卡片显示手机型号与类型
- 设备品牌识别、LocalSend 风格 UI（延续 v1.5.003）

### 下载
| 平台 | 文件 |
|------|------|
| Windows 电脑 | \`lan-share-v${version}-windows-portable.zip\` 解压后双击 **LanShare.exe** |
| Android 手机 | \`lan-share-v${version}-android-phone.apk\` |
| Android 平板 | \`lan-share-v${version}-android-tablet.apk\` |
| Linux | \`lan-share-v${version}-linux-x64.tar.gz\` |
| macOS | \`lan-share-v${version}-macos-x64.tar.gz\` |
| iPhone / iPad | 见 \`ios-iphone.txt\` / \`ios-ipad.txt\`（Safari 添加到主屏幕） |

官网：https://aiyangdie.github.io/lan-share/
`

async function main() {
  const files = collectAssets()
  if (files.length < 2) throw new Error('安装包不足，请先 npm run build:release')

  console.log(`\n=== Publish ${TAG} (${files.length} assets) ===\n`)
  ensureTag()

  const { token } = getGitToken()

  let release
  try {
    const { json } = await api('GET', `/releases/tags/${TAG}`, null, token)
    release = json
    console.log(`Release 已存在: ${json.html_url}`)
  } catch {
    const { json } = await api('POST', '/releases', {
      tag_name: TAG,
      name: `LanShare ${TAG}`,
      body: bodyText,
      draft: false,
      prerelease: false,
    }, token)
    release = json
    console.log(`Created release: ${json.html_url}`)
  }

  const existing = new Set((release.assets || []).map((a) => a.name))
  for (const file of files) {
    const name = path.basename(file)
    if (existing.has(name)) {
      console.log(`skip (exists): ${name}`)
      continue
    }
    process.stdout.write(`upload ${name} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)... `)
    await uploadAsset(release.upload_url, file, token)
    console.log('ok')
  }

  console.log(`\n✓ https://github.com/${REPO}/releases/tag/${TAG}\n`)
}

main().catch((e) => {
  console.error('\n发布失败:', e.message)
  process.exit(1)
})
