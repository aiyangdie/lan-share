/**
 * 本机硬件信息：品牌 / 型号 / 设备类型（服务端启动时检测）
 */
import fs from 'node:fs'
import os from 'node:os'
import { execSync } from 'node:child_process'

const BRAND_ALIASES = {
  dell: '戴尔',
  lenovo: '联想',
  hp: '惠普',
  hewlett: '惠普',
  asus: '华硕',
  acer: '宏碁',
  microsoft: '微软',
  apple: '苹果',
  huawei: '华为',
  honor: '荣耀',
  xiaomi: '小米',
  redmi: '红米',
  oppo: 'OPPO',
  vivo: 'vivo',
  samsung: '三星',
  oneplus: '一加',
  realme: '真我',
  meizu: '魅族',
  google: 'Google',
  sony: '索尼',
  msi: '微星',
  gigabyte: '技嘉',
}

function normalizeBrand(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const key = s.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const [k, label] of Object.entries(BRAND_ALIASES)) {
    if (key.includes(k)) return label
  }
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function runQuiet(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 4000, windowsHide: true }).trim()
  } catch {
    return ''
  }
}

function readLinuxDmi(field) {
  try {
    return fs.readFileSync(`/sys/class/dmi/id/${field}`, 'utf8').trim()
  } catch {
    return ''
  }
}

function detectWindows() {
  const ps = runQuiet(
    'powershell -NoProfile -Command "Get-CimInstance Win32_ComputerSystem | Select-Object -ExpandProperty Manufacturer; Get-CimInstance Win32_ComputerSystem | Select-Object -ExpandProperty Model"'
  )
  if (ps) {
    const lines = ps.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length >= 2) return { brand: lines[0], model: lines.slice(1).join(' ') }
    if (lines.length === 1) return { brand: lines[0], model: '' }
  }
  const wmic = runQuiet('wmic computersystem get manufacturer,model /format:list')
  const brand = wmic.match(/Manufacturer=(.+)/i)?.[1]?.trim() || ''
  const model = wmic.match(/Model=(.+)/i)?.[1]?.trim() || ''
  return { brand, model }
}

function detectMac() {
  const raw = runQuiet('system_profiler SPHardwareDataType')
  const model = raw.match(/Model Name:\s*(.+)/i)?.[1]?.trim()
    || raw.match(/Model Identifier:\s*(.+)/i)?.[1]?.trim()
    || ''
  return { brand: 'Apple', model: model || os.hostname() }
}

function detectLinux() {
  const vendor = readLinuxDmi('sys_vendor') || readLinuxDmi('board_vendor')
  const product = readLinuxDmi('product_name') || readLinuxDmi('board_name')
  return { brand: vendor, model: product }
}

export function detectHostDeviceInfo() {
  const platform = os.platform()
  let raw = { brand: '', model: '' }
  if (platform === 'win32') raw = detectWindows()
  else if (platform === 'darwin') raw = detectMac()
  else if (platform === 'linux') raw = detectLinux()

  const brand = normalizeBrand(raw.brand)
  let model = String(raw.model || '').trim()
  if (/system manufacturer|to be filled|default string|not available/i.test(model)) model = ''
  if (/system manufacturer|to be filled|default string|not applicable/i.test(raw.brand)) {
    raw.brand = ''
  }

  const hostname = os.hostname()
  const deviceName = model
    ? (brand ? `${brand} ${model}` : model)
    : (brand || hostname)

  return {
    deviceType: 'desktop',
    deviceBrand: brand,
    deviceModel: model || hostname,
    deviceName: String(deviceName).slice(0, 32),
    platform,
  }
}
