#!/usr/bin/env node
/**
 * Windows portable: LanShare.exe launcher + bundled node.exe
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import https from 'node:https'
import { createWriteStream } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim()
const TAG = `lan-share-v${version}`
const cache = path.join(ROOT, 'tools/cache')
const stage = path.join(ROOT, 'releases', '.stage-portable')
const outZip = path.join(ROOT, 'releases', `${TAG}-windows-portable.zip`)
const outExe = path.join(ROOT, 'releases', `${TAG}-windows-x64.exe`)

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1_000_000) return resolve()
    console.log(`  download ${path.basename(dest)}...`)
    const file = createWriteStream(dest)
    const req = (u) => {
      https.get(u, (res) => {
        if ([301, 302].includes(res.statusCode)) return req(res.headers.location)
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
      }).on('error', reject)
    }
    req(url)
  })
}

function cpDir(src, dest) {
  ensureDir(dest)
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name)
    const d = path.join(dest, name)
    if (fs.statSync(s).isDirectory()) cpDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

console.log(`\n=== Windows Portable + EXE v${version} ===\n`)

ensureDir(cache)
const nodeZip = path.join(cache, 'node-v20.11.0-win-x64.zip')
const nodeExeCached = path.join(cache, 'node-v20.11.0-win-x64', 'node.exe')

await download('https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip', nodeZip)
if (!fs.existsSync(nodeExeCached)) {
  console.log('  extract node.exe...')
  execSync(`tar -xf "${nodeZip}" -C "${cache}" node-v20.11.0-win-x64/node.exe`, { stdio: 'pipe' })
}

if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true })
ensureDir(path.join(stage, 'node'))
fs.copyFileSync(nodeExeCached, path.join(stage, 'node', 'node.exe'))

for (const item of ['server.mjs', 'package.json', 'LICENSE', 'VERSION']) {
  fs.copyFileSync(path.join(ROOT, item), path.join(stage, item))
}
cpDir(path.join(ROOT, 'node_modules'), path.join(stage, 'node_modules'))
cpDir(path.join(ROOT, 'public'), path.join(stage, 'public'))
cpDir(path.join(ROOT, 'mobile-app'), path.join(stage, 'mobile-app'))
ensureDir(path.join(stage, 'shared'))
ensureDir(path.join(stage, 'uploads'))

fs.writeFileSync(path.join(stage, '使用说明.txt'), `LanShare v${version}\n\n双击 LanShare.exe 启动\n手机连接 http://你的电脑IP:8787\n`)
fs.writeFileSync(path.join(stage, 'start-server.bat'), `@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\nnode\\node.exe server.mjs\r\npause\r\n`)

const csc = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'
const launcherExe = path.join(stage, 'LanShare.exe')
if (fs.existsSync(csc)) {
  execSync(`"${csc}" /nologo /target:exe /out:"${launcherExe}" "${path.join(__dirname, 'LanShareLauncher.cs')}"`, { stdio: 'inherit' })
  console.log('✓ LanShare.exe')
}

if (fs.existsSync(outZip)) fs.unlinkSync(outZip)
console.log('  zip portable package...')
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${stage}\\*' -DestinationPath '${outZip}' -Force"`,
  { stdio: 'inherit' }
)

const mb = (fs.statSync(outZip).size / 1048576).toFixed(1)
console.log(`✓ ${outZip} (${mb} MB)`)

if (fs.existsSync(launcherExe)) {
  fs.copyFileSync(launcherExe, outExe)
  const exeKb = (fs.statSync(outExe).size / 1024).toFixed(0)
  console.log(`✓ ${outExe} (${exeKb} KB launcher — 需与 zip 内文件同目录使用)`)
}

console.log('  Unzip → double-click LanShare.exe\n')

fs.rmSync(stage, { recursive: true, force: true })
