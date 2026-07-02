/**
 * 设备类型 · 品牌 · 图标 · 配色（LocalSend 风格）
 */
const DEVICE_TYPES = ['desktop', 'phone', 'tablet']

const DEVICE_META = {
  desktop: {
    label: '电脑',
    color: '#4F46E5',
    soft: 'rgba(79, 70, 229, 0.12)',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
    emptyHint: '未发现电脑，请确认对方已运行 LanShare.exe',
    setupTitle: '连接电脑',
    setupDesc: '同一 WiFi，手机/平板可自动发现附近电脑',
  },
  phone: {
    label: '手机',
    color: '#059669',
    soft: 'rgba(5, 150, 105, 0.12)',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>',
    emptyHint: '未发现手机，请确认对方已安装 LanShare 并打开 App',
    setupTitle: '连接手机',
    setupDesc: '同一 WiFi，可发现附近运行 LanShare 的手机',
  },
  tablet: {
    label: '平板',
    color: '#7C3AED',
    soft: 'rgba(124, 58, 237, 0.12)',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/></svg>',
    emptyHint: '未发现平板，请确认对方已安装 LanShare 并打开 App',
    setupTitle: '连接平板',
    setupDesc: '同一 WiFi，可发现附近运行 LanShare 的平板',
  },
}

const BRAND_META = {
  苹果: { color: '#111827', soft: 'rgba(17, 24, 39, 0.08)', abbr: 'Apple' },
  华为: { color: '#CF0A2C', soft: 'rgba(207, 10, 44, 0.1)', abbr: 'HW' },
  荣耀: { color: '#0066CC', soft: 'rgba(0, 102, 204, 0.1)', abbr: 'Honor' },
  小米: { color: '#FF6900', soft: 'rgba(255, 105, 0, 0.1)', abbr: 'MI' },
  红米: { color: '#FF6900', soft: 'rgba(255, 105, 0, 0.1)', abbr: 'Redmi' },
  三星: { color: '#1428A0', soft: 'rgba(20, 40, 160, 0.1)', abbr: 'Samsung' },
  OPPO: { color: '#1BA784', soft: 'rgba(27, 167, 132, 0.1)', abbr: 'OPPO' },
  vivo: { color: '#415FFF', soft: 'rgba(65, 95, 255, 0.1)', abbr: 'vivo' },
  一加: { color: '#EB0028', soft: 'rgba(235, 0, 40, 0.1)', abbr: '1+' },
  戴尔: { color: '#007DB8', soft: 'rgba(0, 125, 184, 0.1)', abbr: 'Dell' },
  联想: { color: '#E2231A', soft: 'rgba(226, 35, 26, 0.1)', abbr: 'Lenovo' },
  惠普: { color: '#0096D6', soft: 'rgba(0, 150, 214, 0.1)', abbr: 'HP' },
  华硕: { color: '#00529B', soft: 'rgba(0, 82, 155, 0.1)', abbr: 'ASUS' },
  宏碁: { color: '#83B81A', soft: 'rgba(131, 184, 26, 0.1)', abbr: 'Acer' },
  微软: { color: '#0078D4', soft: 'rgba(0, 120, 212, 0.1)', abbr: 'MS' },
  微星: { color: '#FF0000', soft: 'rgba(255, 0, 0, 0.08)', abbr: 'MSI' },
}

const BRAND_ALIASES = {
  apple: '苹果', iphone: '苹果', ipad: '苹果', mac: '苹果',
  huawei: '华为', honor: '荣耀', xiaomi: '小米', redmi: '红米',
  samsung: '三星', oppo: 'OPPO', vivo: 'vivo', oneplus: '一加',
  dell: '戴尔', lenovo: '联想', hp: '惠普', hewlett: '惠普',
  asus: '华硕', acer: '宏碁', microsoft: '微软', msi: '微星',
  google: 'Google', sony: '索尼', realme: '真我', meizu: '魅族',
}

function normalizeBrand(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const key = s.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const [k, label] of Object.entries(BRAND_ALIASES)) {
    if (key.includes(k)) return label
  }
  if (/^[\u4e00-\u9fff]/.test(s)) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function parseUaBrand(ua) {
  if (/iPhone/i.test(ua)) return { brand: '苹果', model: 'iPhone' }
  if (/iPad/i.test(ua)) return { brand: '苹果', model: 'iPad' }
  if (/Macintosh|Mac OS X/i.test(ua)) return { brand: '苹果', model: 'Mac' }
  const android = ua.match(/;\s*([^;]+)\s+Build\//i)
  if (android) {
    const chunk = android[1].trim()
    const parts = chunk.split(/\s+/)
    if (parts.length >= 2) return { brand: normalizeBrand(parts[0]), model: parts.slice(1).join(' ') }
    return { brand: normalizeBrand(chunk), model: chunk }
  }
  if (/Windows NT/i.test(ua)) return { brand: '', model: 'Windows PC' }
  return { brand: '', model: '' }
}

function detectClientDeviceType() {
  if (window.LanShareNative?.getDeviceInfo) {
    try {
      const info = JSON.parse(window.LanShareNative.getDeviceInfo())
      if (DEVICE_TYPES.includes(info.deviceType)) return info.deviceType
    } catch { /* ignore */ }
  }
  if (window.LanShareNative) {
    const ua = navigator.userAgent
    if (/Tablet|iPad|PlayBook|Silk/i.test(ua) || (navigator.maxTouchPoints > 1 && /Android/i.test(ua) && !/Mobile/i.test(ua))) {
      return 'tablet'
    }
    return 'phone'
  }
  if (typeof isDesktopBrowser === 'function' && isDesktopBrowser()) return 'desktop'
  const ua = navigator.userAgent
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  if (/Android|iPhone|Mobile/i.test(ua)) return 'phone'
  return 'desktop'
}

function detectClientDeviceInfo() {
  if (window.LanShareNative?.getDeviceInfo) {
    try {
      const info = JSON.parse(window.LanShareNative.getDeviceInfo())
      return {
        deviceType: normalizeDeviceType(info.deviceType),
        deviceBrand: normalizeBrand(info.deviceBrand || info.brand),
        deviceModel: String(info.deviceModel || info.model || '').trim(),
        deviceName: String(info.deviceName || '').trim(),
      }
    } catch { /* ignore */ }
  }
  const type = detectClientDeviceType()
  const ua = navigator.userAgent
  const parsed = parseUaBrand(ua)
  const brand = parsed.brand
  const model = parsed.model || (type === 'desktop' ? '电脑' : type === 'tablet' ? '平板' : '手机')
  const typeLabel = DEVICE_META[type]?.label || '设备'
  const deviceName = brand && model ? `${brand} ${model}` : (brand || `我的${typeLabel}`)
  return {
    deviceType: type,
    deviceBrand: brand,
    deviceModel: model,
    deviceName: deviceName.slice(0, 32),
  }
}

function normalizeDeviceType(t) {
  return DEVICE_TYPES.includes(t) ? t : 'desktop'
}

function deviceDisplayName(peer) {
  return peer?.deviceName || peer?.hostname || peer?.ip || '未知设备'
}

function peerDeviceType(peer) {
  return normalizeDeviceType(peer?.deviceType || 'desktop')
}

function peerDeviceBrand(peer) {
  return normalizeBrand(peer?.deviceBrand || '')
}

function peerDeviceModel(peer) {
  return String(peer?.deviceModel || '').trim()
}

function deviceMeta(type) {
  return DEVICE_META[normalizeDeviceType(type)] || DEVICE_META.desktop
}

function brandMeta(brand) {
  const b = normalizeBrand(brand)
  return BRAND_META[b] || { color: '#64748B', soft: 'rgba(100, 116, 139, 0.12)', abbr: b ? b.slice(0, 2) : '?' }
}

function peerDeviceSubtitle(peer) {
  const type = peerDeviceType(peer)
  const meta = deviceMeta(type)
  const brand = peerDeviceBrand(peer)
  const model = peerDeviceModel(peer)
  if (brand && model) return `${brand} · ${model} · ${meta.label}`
  if (brand) return `${brand} · ${meta.label}`
  if (model) return `${model} · ${meta.label}`
  return meta.label
}

function clientContextMeta() {
  const type = detectClientDeviceType()
  return deviceMeta(type)
}

function allowedClientTypes() {
  const type = detectClientDeviceType()
  if (window.LanShareNative) {
    return type === 'tablet' ? ['tablet', 'phone'] : ['phone']
  }
  if (typeof isDesktopBrowser === 'function' && isDesktopBrowser()) return ['desktop', 'phone', 'tablet']
  return [type]
}

window.LanShareDevice = {
  DEVICE_TYPES,
  detectClientDeviceType,
  detectClientDeviceInfo,
  normalizeDeviceType,
  deviceDisplayName,
  peerDeviceType,
  peerDeviceBrand,
  peerDeviceModel,
  deviceMeta,
  brandMeta,
  peerDeviceSubtitle,
  clientContextMeta,
  allowedClientTypes,
  normalizeBrand,
}
