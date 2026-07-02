/**
 * VERSION → package.json / Android / PWA / version.js
 * 版本格式: major.minor.micro（micro 三位，每 +1 = +0.001）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseVersion, formatVersion, versionCode } from './parse-version.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const raw = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim()
const parts = parseVersion(raw)
const version = formatVersion(parts)
const code = versionCode(parts)

const pkgPath = path.join(ROOT, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
pkg.version = version
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

const gradlePath = path.join(ROOT, 'android/app/build.gradle')
let gradle = fs.readFileSync(gradlePath, 'utf8')
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${code}`)
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`)
fs.writeFileSync(gradlePath, gradle)

const manifestPath = path.join(ROOT, 'public/manifest.webmanifest')
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  manifest.version = version
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

const versionJs = `window.__LANSHARE_VERSION__ = '${version}'\nwindow.__LANSHARE_VERSION_CODE__ = ${code}\n`
fs.writeFileSync(path.join(ROOT, 'mobile-app/version.js'), versionJs)

const desktopPkg = path.join(ROOT, 'desktop/package.json')
if (fs.existsSync(desktopPkg)) {
  const dp = JSON.parse(fs.readFileSync(desktopPkg, 'utf8'))
  dp.version = version
  fs.writeFileSync(desktopPkg, JSON.stringify(dp, null, 2) + '\n')
}

console.log(`Synced version ${version} (versionCode ${code})`)
