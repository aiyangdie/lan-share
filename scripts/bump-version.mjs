#!/usr/bin/env node
/**
 * 细粒度版本 +1（+0.001）并写入更新日志
 * 用法: node scripts/bump-version.mjs "本次改了什么"
 * 可选: --no-bump 只记日志不升版本（用于文档-only）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseVersion, formatVersion, bumpMicro, versionCode } from './parse-version.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const VERSION_FILE = path.join(ROOT, 'VERSION')
const CHANGELOG_JSON = path.join(ROOT, 'docs/changelog.json')
const CHANGELOG_MD = path.join(ROOT, 'CHANGELOG.md')

const args = process.argv.slice(2).filter((a) => a !== '--no-bump')
const message = args.join(' ').trim()
if (!message) {
  console.error('用法: node scripts/bump-version.mjs "描述本次修改"')
  console.error('示例: node scripts/bump-version.mjs "修复手机端删除文件 404"')
  process.exit(1)
}

const noBump = process.argv.includes('--no-bump')
const oldRaw = fs.readFileSync(VERSION_FILE, 'utf8').trim()
const oldV = parseVersion(oldRaw)
const newV = noBump ? oldV : bumpMicro(oldV)
const newVersion = formatVersion(newV)

if (!noBump) {
  fs.writeFileSync(VERSION_FILE, newVersion + '\n')
}

const entry = {
  version: newVersion,
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toISOString(),
  summary: message,
  versionCode: versionCode(newV),
  components: detectComponents(message),
}

let log = { schema: 1, description: 'LanShare 细粒度更新留痕，每条 +0.001', entries: [] }
if (fs.existsSync(CHANGELOG_JSON)) {
  try {
    log = JSON.parse(fs.readFileSync(CHANGELOG_JSON, 'utf8'))
  } catch { /* reset */ }
}
log.entries.unshift(entry)
if (log.entries.length > 500) log.entries.length = 500
fs.writeFileSync(CHANGELOG_JSON, JSON.stringify(log, null, 2) + '\n')

prependChangelogMd(entry)

console.log('')
console.log(`  版本 ${oldRaw} → ${newVersion}  (+0.001)`)
console.log(`  versionCode: ${versionCode(newV)}`)
console.log(`  说明: ${message}`)
console.log('')
console.log('  下一步:')
console.log('    node scripts/sync-version.mjs')
console.log('    node scripts/sync-mobile.mjs   # 若改了 mobile-app')
console.log('    git add -A && git commit -m "v' + newVersion + ': ' + message + '"')
console.log('')

function detectComponents(msg) {
  const m = msg.toLowerCase()
  const out = []
  if (/apk|android|手机|mobile/.test(m)) out.push('android')
  if (/electron|desktop|电脑端|exe|托盘/.test(m)) out.push('desktop')
  if (/admin|后台|广告|公告/.test(m)) out.push('admin')
  if (/官网|website|docs|网站/.test(m)) out.push('website')
  if (/server|api|服务端/.test(m)) out.push('server')
  if (!out.length) out.push('core')
  return out
}

function prependChangelogMd(entry) {
  const line = `- **${entry.version}** (${entry.date}) — ${entry.summary}`
  let md = fs.existsSync(CHANGELOG_MD) ? fs.readFileSync(CHANGELOG_MD, 'utf8') : '# Changelog\n\n'
  const marker = '## 细粒度更新留痕'
  if (md.includes(marker)) {
    md = md.replace(marker, `${marker}\n\n${line}`)
  } else {
    md = md.replace(
      '# Changelog',
      `# Changelog\n\n${marker}\n\n> 每次代码修改 +0.001，改 10 次 +0.01。完整记录在 \`docs/changelog.json\` 与 GitHub Commits。\n\n${line}`
    )
  }
  fs.writeFileSync(CHANGELOG_MD, md)
}
