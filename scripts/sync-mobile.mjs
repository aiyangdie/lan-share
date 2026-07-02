/**
 * Keep mobile-app / public / android assets identical
 * Run: node scripts/sync-mobile.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'mobile-app')
const PUBLIC = path.join(ROOT, 'public')
const ANDROID_MOBILE = path.join(ROOT, 'android/app/src/main/assets/mobile')

/** public/ 下由 generate-icons 等维护、不应被整目录删除的资源 */
const PUBLIC_PRESERVE = ['icons']

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name)
    const d = path.join(dest, name)
    if (fs.statSync(s).isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

function syncPublic() {
  fs.mkdirSync(PUBLIC, { recursive: true })
  for (const name of fs.readdirSync(PUBLIC)) {
    if (PUBLIC_PRESERVE.includes(name)) continue
    fs.rmSync(path.join(PUBLIC, name), { recursive: true, force: true })
  }
  copyDir(SRC, PUBLIC)
  for (const name of PUBLIC_PRESERVE) {
    const dir = path.join(PUBLIC, name)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}

function syncAndroidAssets() {
  if (fs.existsSync(ANDROID_MOBILE)) fs.rmSync(ANDROID_MOBILE, { recursive: true, force: true })
  copyDir(SRC, ANDROID_MOBILE)
}

syncPublic()
syncAndroidAssets()

console.log('Synced mobile-app → public + android/assets (preserved public/icons)')
