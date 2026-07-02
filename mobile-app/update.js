/**
 * LanShare 在线更新 + 系统公告
 */
const UPDATE_CACHE_KEY = 'lan_share_update_cache'
const ANNOUNCE_SEEN_KEY = 'lan_share_announce_seen'
const UPDATE_DISMISS_KEY = 'lan_share_update_dismiss'

function updateApiBase() {
  const fixed = (window.__LANSHARE_UPDATE_API__ || '').trim().replace(/\/+$/, '')
  if (fixed) return fixed.replace(/\/api\/update$/, '')
  if (typeof getApiBase === 'function') {
    const base = getApiBase()
    if (base) return base
  }
  if (window.location.port === '8787') return window.location.origin
  return ''
}

function currentPlatform() {
  if (window.LanShareNative) return 'android'
  if (window.location.port === '8787') return 'windows'
  return 'android'
}

function currentVersion() {
  return window.__LANSHARE_VERSION__ || '0.0.0'
}

function currentVersionCode() {
  return window.__LANSHARE_VERSION_CODE__ || 0
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function showUpdateModal(info) {
  const modal = document.getElementById('update-modal')
  if (!modal || !info) return
  $('#update-title').textContent = `发现新版本 v${info.version}`
  $('#update-changelog').textContent = info.changelog || '建议更新到最新版本'
  $('#update-mandatory').classList.toggle('hidden', !info.mandatory)
  const btnLater = $('#btn-update-later')
  if (btnLater) btnLater.classList.toggle('hidden', !!info.mandatory)
  modal.dataset.url = info.url || ''
  modal.classList.remove('hidden')
}

function hideUpdateModal() {
  document.getElementById('update-modal')?.classList.add('hidden')
}

function showAnnouncement(a) {
  const bar = document.getElementById('announce-bar')
  if (!bar || !a) { bar?.classList.add('hidden'); return }
  const key = `${a.title}:${a.message}:${a.level}`
  if (localStorage.getItem(ANNOUNCE_SEEN_KEY) === key) {
    bar.classList.add('hidden')
    return
  }
  bar.className = `announce-bar level-${a.level || 'info'}`
  bar.innerHTML = `
    <div class="announce-inner">
      <strong>${escapeHtml(a.title || '公告')}</strong>
      <span>${escapeHtml(a.message || '')}</span>
      ${a.linkUrl ? `<a href="${escapeHtml(a.linkUrl)}" target="_blank" rel="noopener">查看</a>` : ''}
    </div>
    <button type="button" class="announce-close" id="btn-announce-close" aria-label="关闭">×</button>`
  bar.classList.remove('hidden')
  $('#btn-announce-close')?.addEventListener('click', () => {
    localStorage.setItem(ANNOUNCE_SEEN_KEY, key)
    bar.classList.add('hidden')
  })
}

async function checkUpdate(force = false) {
  const base = updateApiBase()
  if (!base) return null
  const platform = currentPlatform()
  const q = new URLSearchParams({
    platform,
    version: currentVersion(),
    versionCode: String(currentVersionCode()),
  })
  try {
    const res = await fetch(`${base}/api/update?${q}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok || !data.ok) return null
    localStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }))
    if (data.announcement) showAnnouncement(data.announcement)
    if (data.update) {
      const dismissed = localStorage.getItem(UPDATE_DISMISS_KEY)
      if (!force && !data.update.mandatory && dismissed === data.update.version) return data
      showUpdateModal(data.update)
    }
    return data
  } catch {
    return null
  }
}

function startUpdateDownload() {
  const modal = document.getElementById('update-modal')
  const url = modal?.dataset?.url
  if (!url) return
  const platform = currentPlatform()
  if (platform === 'android' && window.LanShareNative?.downloadFile) {
    const name = url.split('/').pop()?.split('?')[0] || 'lanshare-update.apk'
    const result = window.LanShareNative.downloadFile(url, name)
    if (result === 'ok' && typeof toast === 'function') toast('已开始下载 APK，请查看通知栏')
    else if (typeof toastErr === 'function') toastErr(result || '下载失败')
  } else {
    window.open(url, '_blank', 'noopener')
    if (typeof toast === 'function') toast('已在浏览器打开下载页面')
  }
}

window.LanShareUpdate = { check: checkUpdate, refresh: () => checkUpdate(true) }

document.addEventListener('DOMContentLoaded', () => {
  $('#btn-update-now')?.addEventListener('click', startUpdateDownload)
  $('#btn-update-later')?.addEventListener('click', () => {
    const ver = document.getElementById('update-modal')?.querySelector('#update-title')?.textContent?.match(/v([\d.]+)/)?.[1]
    if (ver) localStorage.setItem(UPDATE_DISMISS_KEY, ver)
    hideUpdateModal()
  })
  setTimeout(() => checkUpdate(), 800)
})
