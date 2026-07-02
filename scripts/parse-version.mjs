/**
 * 版本号解析 · 格式 major.minor.micro
 * micro 每 +1 = 用户可见 +0.001（如 1.5.000 → 1.5.001）
 * micro +10 = +0.01（1.5.000 → 1.5.010）
 */
export function parseVersion(raw) {
  const s = String(raw || '0.0.0').trim()
  const m = s.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!m) throw new Error(`无效版本号: ${s}，请使用 major.minor.micro 如 1.5.000`)
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    micro: Number(m[3]),
  }
}

export function formatVersion({ major, minor, micro }) {
  return `${major}.${minor}.${String(micro).padStart(3, '0')}`
}

export function bumpMicro(v) {
  return { ...v, micro: v.micro + 1 }
}

export function versionCode({ major, minor, micro }) {
  return major * 1_000_000 + minor * 1_000 + micro
}

export function readVersionFile(root, fs) {
  const raw = fs.readFileSync(`${root}/VERSION`, 'utf8').trim()
  return formatVersion(parseVersion(raw))
}
