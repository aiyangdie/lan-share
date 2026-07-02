/**
 * 设备类型 · 图标 · 配色（类似 LocalSend 设备区分）
 */
const DEVICE_TYPES = ['desktop', 'phone', 'tablet']

const DEVICE_META = {
  desktop: {
    label: '电脑',
    color: '#4F46E5',
    soft: 'rgba(79, 70, 229, 0.12)',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  },
  phone: {
    label: '手机',
    color: '#059669',
    soft: 'rgba(5, 150, 105, 0.12)',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>',
  },
  tablet: {
    label: '平板',
    color: '#7C3AED',
    soft: 'rgba(124, 58, 237, 0.12)',
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/></svg>',
  },
}

function detectClientDeviceType() {
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

function normalizeDeviceType(t) {
  return DEVICE_TYPES.includes(t) ? t : 'desktop'
}

function deviceDisplayName(peer) {
  return peer?.deviceName || peer?.hostname || peer?.ip || '未知设备'
}

function peerDeviceType(peer) {
  return normalizeDeviceType(peer?.deviceType || 'desktop')
}

function deviceMeta(type) {
  return DEVICE_META[normalizeDeviceType(type)] || DEVICE_META.desktop
}

window.LanShareDevice = {
  DEVICE_TYPES,
  detectClientDeviceType,
  normalizeDeviceType,
  deviceDisplayName,
  peerDeviceType,
  deviceMeta,
}
