/**
 * Single source of truth: VERSION file → all project version fields
 * Run: node scripts/sync-version.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim()
const [major, minor, patch] = version.split('.').map(Number)
const versionCode = major * 10000 + minor * 100 + patch

// package.json
const pkgPath = path.join(ROOT, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
pkg.version = version
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

// Android build.gradle
const gradlePath = path.join(ROOT, 'android/app/build.gradle')
let gradle = fs.readFileSync(gradlePath, 'utf8')
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`)
fs.writeFileSync(gradlePath, gradle)

// PWA manifest + mobile version.js
const manifestPath = path.join(ROOT, 'public/manifest.webmanifest')
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  manifest.version = version
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

const versionJs = `window.__LANSHARE_VERSION__ = '${version}'\nwindow.__LANSHARE_VERSION_CODE__ = ${versionCode}\n`
fs.writeFileSync(path.join(ROOT, 'mobile-app/version.js'), versionJs)

console.log(`Synced version ${version} (versionCode ${versionCode})`)
