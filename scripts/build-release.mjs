#!/usr/bin/env node
/**
 * Build all release packages — NEVER deletes old versions in archive/
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const RELEASES = path.join(ROOT, 'releases')
const ARCHIVE = path.join(RELEASES, 'archive')

const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim()
const TAG = `lan-share-v${version}`
const archiveDir = path.join(ARCHIVE, `v${version}`)

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, shell: true, ...opts })
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) return false
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
  return true
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  ensureDir(dest)
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name)
    const d = path.join(dest, name)
    if (fs.statSync(s).isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

function writeFile(p, content) {
  ensureDir(path.dirname(p))
  fs.writeFileSync(p, content)
}

console.log(`\n=== LanShare Release v${version} ===\n`)

// 0. Sync version + mobile assets
run('node scripts/sync-version.mjs')
run('node scripts/generate-icons.mjs')
run('node scripts/sync-mobile.mjs')
run('npm install --omit=dev')

// 1. Android APK
const assetsDir = path.join(ROOT, 'android/app/src/main/assets/mobile')
ensureDir(assetsDir)
copyDir(path.join(ROOT, 'mobile-app'), assetsDir)

const gradle = path.join(ROOT, 'tools/gradle-6.7.1/bin/gradle.bat')
const apkSrc = path.join(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk')
if (fs.existsSync(gradle)) {
  try {
    run(`"${gradle}" assembleDebug --no-daemon -q`, { cwd: path.join(ROOT, 'android') })
  } catch {
    console.warn('⚠ APK build failed — using existing apk if any')
  }
}

// 3. Windows portable exe + zip
try {
  run('node scripts/build-exe.mjs')
} catch (e) {
  console.warn('⚠ Windows exe build failed:', e.message)
}

// 3. Server zip stage
const serverStage = path.join(RELEASES, '.stage-server')
if (fs.existsSync(serverStage)) fs.rmSync(serverStage, { recursive: true, force: true })
ensureDir(serverStage)

for (const f of ['server.mjs', 'package.json', 'package-lock.json', 'LICENSE', 'README.md', 'README.zh-CN.md', 'VERSION', 'CHANGELOG.md']) {
  copyFile(path.join(ROOT, f), path.join(serverStage, f))
}
copyDir(path.join(ROOT, 'node_modules'), path.join(serverStage, 'node_modules'))
copyDir(path.join(ROOT, 'public'), path.join(serverStage, 'public'))
copyDir(path.join(ROOT, 'mobile-app'), path.join(serverStage, 'mobile-app'))
ensureDir(path.join(serverStage, 'shared'))
ensureDir(path.join(serverStage, 'uploads'))

writeFile(path.join(serverStage, 'start-server.bat'), `@echo off
chcp 65001 >nul
title LanShare v${version}
cd /d "%~dp0"
if not exist "node_modules\\busboy" call npm install --omit=dev >nul 2>&1
if not exist "shared" mkdir shared
if not exist "uploads" mkdir uploads
echo.
echo  LanShare Server v${version}
echo  Phone: http://YOUR_PC_IP:8787
echo.
node server.mjs
pause
`)

writeFile(path.join(serverStage, 'start-server.sh'), `#!/bin/sh
cd "$(dirname "$0")"
[ -d node_modules/busboy ] || npm install --omit=dev >/dev/null 2>&1
mkdir -p shared uploads
echo ""
echo "  LanShare Server v${version}"
echo "  Phone: http://YOUR_PC_IP:8787"
echo ""
exec node server.mjs
`)

const isWin = process.platform === 'win32'
function zipDir(src, out) {
  if (fs.existsSync(out)) fs.unlinkSync(out)
  if (isWin) {
    run(`powershell -NoProfile -Command "Compress-Archive -Path '${src}\\*' -DestinationPath '${out}' -Force"`)
  } else {
    run(`tar -czf "${out}" -C "${src}" .`)
  }
}

ensureDir(RELEASES)
const artifacts = []

const apkOut = path.join(RELEASES, `${TAG}-android.apk`)
if (copyFile(apkSrc, apkOut)) artifacts.push(path.basename(apkOut))

const portableZip = path.join(RELEASES, `${TAG}-windows-portable.zip`)
if (fs.existsSync(portableZip)) {
  copyFile(portableZip, path.join(archiveDir, path.basename(portableZip)))
  artifacts.push(path.basename(portableZip))
}
// 删除无效的单文件 exe（必须用 portable zip）
const badExe = path.join(RELEASES, `${TAG}-windows-x64.exe`)
if (fs.existsSync(badExe)) fs.unlinkSync(badExe)

const winZip = path.join(RELEASES, `${TAG}-server-windows-x64.zip`)
zipDir(serverStage, winZip)
artifacts.push(path.basename(winZip))

const linuxTar = path.join(RELEASES, `${TAG}-server-linux-x64.tar.gz`)
try {
  run(`tar -czf "${linuxTar}" -C "${serverStage}" .`)
  artifacts.push(path.basename(linuxTar))
} catch {
  copyFile(winZip, path.join(RELEASES, `${TAG}-server-linux-x64.zip`))
  artifacts.push(`${TAG}-server-linux-x64.zip`)
}

const macZip = path.join(RELEASES, `${TAG}-server-macos.zip`)
copyFile(winZip, macZip)
artifacts.push(path.basename(macZip))

writeFile(path.join(RELEASES, `${TAG}-ios-pwa.txt`), `LanShare v${version} — iPhone / iPad (PWA)
==========================================

1. Start LanShare on PC (run .exe or start-server script)
2. Same WiFi → Safari open http://YOUR_PC_IP:8787
3. Share → Add to Home Screen
`)

artifacts.push(`${TAG}-ios-pwa.txt`)

// 4. Archive this version (never delete old archives)
ensureDir(archiveDir)
for (const name of artifacts) {
  copyFile(path.join(RELEASES, name), path.join(archiveDir, name))
}
writeFile(path.join(archiveDir, 'BUILD_INFO.txt'), [
  `LanShare v${version}`,
  `Built: ${new Date().toISOString()}`,
  `Artifacts:`,
  ...artifacts.map((a) => `  - ${a}`),
].join('\n'))

// 5. Latest pointer
writeFile(path.join(RELEASES, 'LATEST.txt'), `v${version}\n${new Date().toISOString()}\n`)

const allVersions = fs.existsSync(ARCHIVE)
  ? fs.readdirSync(ARCHIVE).filter((d) => d.startsWith('v')).sort()
  : []
writeFile(path.join(RELEASES, 'manifest.json'), JSON.stringify({
  latest: version,
  built: new Date().toISOString(),
  current: artifacts,
  archivedVersions: allVersions,
}, null, 2))

fs.rmSync(serverStage, { recursive: true, force: true })

console.log(`\n=== Done v${version} ===`)
console.log(`Archive: releases/archive/v${version}/`)
console.log(`Files: ${artifacts.join(', ')}\n`)
