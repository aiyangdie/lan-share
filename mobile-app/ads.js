/**
 * LanShare 广告位 · 从后台 /api/ads 拉取并渲染
 */
const ADS_CACHE_KEY = 'lan_share_ads_cache'
const ADS_CACHE_TTL = 30 * 60 * 1000

let adsConfig = null

function adsApiBase() {
  const fixed = (window.__LANSHARE_ADS_API__ || '').trim().replace(/\/+$/, '')
  if (fixed) return fixed.replace(/\/api\/ads$/, '')
  if (typeof getApiBase === 'function') {
    const base = getApiBase()
    if (base) return base
  }
  if (window.location.port === '8787') return window.location.origin
  return ''
}

function readAdsCache() {
  try {
    const raw = localStorage.getItem(ADS_CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.fetchedAt || Date.now() - data.fetchedAt > ADS_CACHE_TTL) return null
    return data.payload
  } catch {
    return null
  }
}

function writeAdsCache(payload) {
  localStorage.setItem(ADS_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), payload }))
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderAdSlot(slotKey, slot, container) {
  if (!container || !slot) {
    container?.classList.add('hidden')
    return
  }
  const img = slot.imageUrl
    ? `<img class="ad-slot-img" src="${escapeHtml(slot.imageUrl)}" alt="" loading="lazy" onerror="this.classList.add('hidden')" />`
    : ''
  const tag = slot.linkUrl ? 'a' : 'div'
  const attrs = slot.linkUrl
    ? ` href="${escapeHtml(slot.linkUrl)}" target="_blank" rel="noopener noreferrer"`
    : ''
  container.innerHTML = `
    <${tag} class="ad-slot-inner"${attrs} style="background:${escapeHtml(slot.bgColor || '#4F46E5')};color:${escapeHtml(slot.textColor || '#fff')}">
      ${img}
      <div class="ad-slot-meta">
        <div class="ad-slot-title">${escapeHtml(slot.title || '')}</div>
        <div class="ad-slot-sub">${escapeHtml(slot.subtitle || '')}</div>
      </div>
      <span class="ad-slot-badge">${escapeHtml(slot.badge || '广告')}</span>
    </${tag}>`
  container.classList.remove('hidden')
}

function applyAds() {
  const slots = adsConfig?.slots || {}
  renderAdSlot('banner', slots.banner, document.getElementById('ad-banner'))
  renderAdSlot('setup', slots.setup, document.getElementById('ad-setup'))
  document.body.classList.toggle('has-ad-banner', !!slots.banner)
}

async function fetchAds(force = false) {
  if (!force) {
    const cached = readAdsCache()
    if (cached) {
      adsConfig = cached
      applyAds()
    }
  }
  const base = adsApiBase()
  if (!base) {
    applyAds()
    return adsConfig
  }
  try {
    const res = await fetch(`${base}/api/ads`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error('ads fetch failed')
    adsConfig = { slots: data.slots || {}, updatedAt: data.updatedAt }
    writeAdsCache(adsConfig)
    applyAds()
  } catch {
    if (!adsConfig) applyAds()
  }
  return adsConfig
}

window.LanShareAds = { fetchAds, refresh: () => fetchAds(true) }

document.addEventListener('DOMContentLoaded', () => {
  const cached = readAdsCache()
  if (cached) {
    adsConfig = cached
    applyAds()
  }
  fetchAds()
})
