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
const TARGETS = [
  path.join(ROOT, 'public'),
  path.join(ROOT, 'android/app/src/main/assets/mobile'),
]

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name)
    const d = path.join(dest, name)
    if (fs.statSync(s).isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

for (const t of TARGETS) {
  if (fs.existsSync(t)) fs.rmSync(t, { recursive: true, force: true })
  copyDir(SRC, t)
}

// Copy PWA extras into public only
const icons = path.join(ROOT, 'public/icons')
if (fs.existsSync(icons)) {
  // manifest stays in public root
}

console.log('Synced mobile-app → public + android/assets')
