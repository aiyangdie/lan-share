/**
 * Generate PNG icons from SVG using minimal PNG builder (solid color + simple design)
 * Run: node scripts/generate-icons.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDirs = [
  path.join(__dirname, '../public/icons'),
  path.join(__dirname, '../mobile-app/icons'),
]

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function pngSolid(size, rgb = [79, 70, 229]) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const r = size * 0.18
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1) + 1
    raw[row - 1] = 0
    for (let x = 0; x < size; x++) {
      const cx = size / 2, cy = size / 2
      const inRound = (x - cx) ** 2 + (y - cy) ** 2 <= (size / 2 - 4) ** 2
      const onCross =
        (Math.abs(x - cx) < size * 0.06 && Math.abs(y - cy) < size * 0.22) ||
        (Math.abs(y - cy) < size * 0.06 && Math.abs(x - cx) < size * 0.22)
      const i = row + x * 4
      if (inRound && (onCross || (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2)) {
        raw[i] = 255; raw[i + 1] = 255; raw[i + 2] = 255; raw[i + 3] = 255
      } else if (inRound) {
        raw[i] = rgb[0]; raw[i + 1] = rgb[1]; raw[i + 2] = rgb[2]; raw[i + 3] = 255
      } else {
        raw[i] = 0; raw[i + 1] = 0; raw[i + 2] = 0; raw[i + 3] = 0
      }
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  const compressed = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const outDir of outDirs) {
  fs.mkdirSync(outDir, { recursive: true })
  for (const size of [192, 512]) {
    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), pngSolid(size))
    console.log(`wrote ${path.relative(path.join(__dirname, '..'), path.join(outDir, `icon-${size}.png`))}`)
  }
}
