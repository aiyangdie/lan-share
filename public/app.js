const STORAGE_KEY = 'lan_share_server'
const STORAGE_SHARED_SEEN = 'lan_share_seen_shared'
const DEFAULT_HTTP_PORT = 8787

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => document.querySelectorAll(sel)

const ICONS = {
  folder: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/></svg>',
  file: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  chevron: '<svg class="file-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  empty: '<svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/></svg>',
}

let server = localStorage.getItem(STORAGE_KEY) || ''
let root = 'uploads'
let subPath = '/'
let connected = false
let connectedPeer = null
let activeRemoteClients = []
let loading = false
let seenShared = new Set()

function loadSeenShared() {
  try {
    seenShared = new Set(JSON.parse(localStorage.getItem(STORAGE_SHARED_SEEN) || '[]'))
  } catch {
    seenShared = new Set()
  }
}

function markSharedSeen(key) {
  seenShared.add(key)
  const list = [...seenShared]
  if (list.length > 500) list.splice(0, list.length - 500)
  localStorage.setItem(STORAGE_SHARED_SEEN, JSON.stringify(list))
  seenShared = new Set(list)
}

function normalizeServer(url) {
  let u = (url || '').trim().replace(/\/+$/, '')
  if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'http://' + u
  return u
}

function isDesktopBrowser() {
  if (window.LanShareNative) return false
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

/** 电脑浏览器打开本机服务页时走同源，避免 127.0.0.1 与局域网 IP 跨域 */
function pageServerOrigin() {
  if (!isDesktopBrowser()) return ''
  const { hostname, origin } = window.location
  if (hostname === '127.0.0.1' || hostname === 'localhost') return origin
  return ''
}

window.LanShareEnv = { pageServerOrigin, isDesktopBrowser, DEFAULT_HTTP_PORT }

function getApiBase() {
  return pageServerOrigin() || server
}

function api(path) {
  return `${getApiBase()}${path}`
}

function vibrate(ms = 6) {
  if (navigator.vibrate) navigator.vibrate(ms)
}

function toast(msg, ms = 2000) {
  const el = $('#toast')
  el.textContent = msg
  el.classList.remove('hidden')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => el.classList.add('hidden'), ms)
}

function toastErr(msg) {
  toast(msg, 4500)
}

function fmtSize(n) {
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB'
  return (n / 1073741824).toFixed(2) + ' GB'
}

function setStatus(online, text) {
  const bar = $('#status-bar')
  if (text) $('#top-sub').textContent = text
  bar.classList.toggle('offline', !online)
}

function folderContextLabel() {
  const D = window.LanShareDevice
  const isHost = !!pageServerOrigin()
  const localType = isHost ? 'desktop' : (window.LanShareSettings?.readClientSettings?.()?.deviceType || D?.detectClientDeviceType?.() || 'phone')
  const localLabel = D?.deviceMeta?.(localType)?.label || '本机'
  const remoteLabel = isHost ? '手机/平板' : (connectedPeer ? D?.deviceMeta?.(D.peerDeviceType(connectedPeer))?.label : '对方')
  if (root === 'uploads') {
    return isHost
      ? `${remoteLabel} → 本机 · 对方发来的文件`
      : `本机(${localLabel}) → 对方(${remoteLabel}) · 我发出的文件`
  }
  return isHost
    ? `本机(${localLabel}) → ${remoteLabel} · 共享给对方`
    : `对方(${remoteLabel}) → 本机(${localLabel}) · 发给我的文件`
}

function updatePathBar() {
  const label = folderContextLabel()
  const sub = subPath === '/' ? '' : subPath
  $('#path-label').textContent = label + sub
  $('#btn-back').disabled = subPath === '/'
  const ctx = $('#transfer-context')
  if (ctx && connected) {
    ctx.textContent = label
    ctx.classList.remove('hidden')
  }
}

function renderPeerCard(role, peer, opts = {}) {
  const D = window.LanShareDevice
  const waiting = !!opts.waiting
  const type = waiting ? 'unknown' : D.peerDeviceType(peer)
  const meta = waiting ? { label: '等待连接', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>' } : D.deviceMeta(type)
  const brand = waiting ? '' : D.peerDeviceBrand(peer)
  const brandMeta = D.brandMeta(brand)
  const name = waiting ? (opts.hint || '暂无设备') : D.deviceDisplayName(peer)
  const subtitle = waiting ? '同一 WiFi 打开 App 即可连入' : D.peerDeviceSubtitle(peer)
  return `
    <div class="transfer-peer ${opts.side || ''} ${waiting ? 'waiting' : `type-${type}`}">
      <span class="transfer-peer-role">${escapeHtml(role)}</span>
      <div class="transfer-peer-body">
        <div class="discover-icon ${waiting ? 'waiting' : `type-${type}`}">${meta.icon}</div>
        <div class="transfer-peer-text">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(subtitle)}</span>
          ${!waiting && brand ? `<span class="brand-chip sm" style="--brand-color:${brandMeta.color};--brand-soft:${brandMeta.soft}">${escapeHtml(brand)}</span>` : ''}
          ${!waiting && peer?.ip ? `<span class="transfer-peer-ip">${escapeHtml(peer.ip)}:${peer.port || DEFAULT_HTTP_PORT}</span>` : ''}
        </div>
      </div>
    </div>
  `
}

function getLocalPeerView() {
  const D = window.LanShareDevice
  const isHost = !!pageServerOrigin()
  if (isHost && connectedPeer) {
    return {
      deviceName: D.deviceDisplayName(connectedPeer),
      deviceType: D.peerDeviceType(connectedPeer),
      deviceBrand: D.peerDeviceBrand(connectedPeer),
      deviceModel: D.peerDeviceModel(connectedPeer),
      ip: connectedPeer.ip,
      port: connectedPeer.port,
    }
  }
  const client = window.LanShareSettings?.readClientSettings?.() || {}
  return {
    deviceName: window.LanShareSettings?.clientDeviceName?.() || '本机',
    deviceType: client.deviceType || D.detectClientDeviceType(),
    deviceBrand: client.deviceBrand || '',
    deviceModel: client.deviceModel || '',
  }
}

function getRemotePeerView() {
  const isHost = !!pageServerOrigin()
  if (isHost) {
    if (activeRemoteClients.length) return activeRemoteClients[0]
    return null
  }
  return connectedPeer
}

function renderTransferBar() {
  const el = $('#connected-device')
  const ctx = $('#transfer-context')
  if (!el) return
  if (!connected) {
    el.classList.add('hidden')
    el.innerHTML = ''
    ctx?.classList.add('hidden')
    return
  }
  const local = getLocalPeerView()
  const remote = getRemotePeerView()
  const isHost = !!pageServerOrigin()
  const switchLabel = isHost ? '刷新连接' : '切换对方'
  el.classList.remove('hidden')
  el.innerHTML = `
    <div class="transfer-bar-inner">
      ${renderPeerCard('本机', local, { side: 'local' })}
      <div class="transfer-arrow" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
      </div>
      ${renderPeerCard('对方', remote, {
        side: 'remote',
        waiting: !remote,
        hint: isHost ? '等待手机/平板' : '未连接',
      })}
    </div>
    <button type="button" class="btn-switch-peer" id="btn-switch-device">${switchLabel}</button>
  `
  if (ctx) {
    ctx.textContent = folderContextLabel()
    ctx.classList.remove('hidden')
  }
  setStatus(true, remote
    ? `与 ${window.LanShareDevice.deviceDisplayName(remote)} 互传中`
    : (isHost ? '服务运行中，等待连接' : '已连接'))
  $('#btn-switch-device')?.addEventListener('click', () => {
    vibrate()
    if (isHost) refreshRemoteClients().then(() => toast(activeRemoteClients.length ? '已更新连接设备' : '暂无手机/平板连入'))
    else showSetup()
  })
}

function renderConnectedDevice(info) {
  connectedPeer = info || connectedPeer
  renderTransferBar()
}

function defaultServerHost() {
  const { hostname, host, port } = window.location
  if (hostname === '127.0.0.1' || hostname === 'localhost') return host
  if (hostname && port === String(DEFAULT_HTTP_PORT)) return host
  return ''
}

function isLocalServerMode() {
  return !!defaultServerHost()
}

function confirmAction(msg) {
  return window.confirm(msg)
}

function clearLocalRecords() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_SHARED_SEEN)
  seenShared = new Set()
  server = ''
  connected = false
  connectedPeer = null
  activeRemoteClients = []
  renderTransferBar()
  root = 'uploads'
  subPath = '/'
  $('#upload-queue').innerHTML = ''
  $('#input-server').value = ''
  setStatus(false, '未连接')
  showSetup()
  toast('已清除本地记录')
}

function guessSubnets() {
  try {
    const native = window.LanShareNative?.getWifiIp?.()
    if (native) {
      const p = native.split('.')
      if (p.length === 4) return [`${p[0]}.${p[1]}.${p[2]}`]
    }
  } catch { /* ignore */ }
  return ['192.168.1', '192.168.0', '192.168.31', '10.0.0']
}

async function probeServer(ip, port = DEFAULT_HTTP_PORT) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 1200)
    const res = await fetch(`http://${ip}:${port}/api/health`, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) return null
    const j = await res.json()
    if (j.ok && j.name === 'lan-share') {
      return {
        ip: j.ip || ip,
        port: j.port || port,
        version: j.version,
        hostname: j.hostname || ip,
        deviceName: j.deviceName || j.hostname || ip,
        deviceType: j.deviceType || 'desktop',
        deviceBrand: j.deviceBrand || '',
        deviceModel: j.deviceModel || '',
      }
    }
    return null
  } catch {
    return null
  }
}

async function scanSubnetClient(base) {
  const found = new Map()
  const batch = 24
  for (let start = 1; start < 255; start += batch) {
    const jobs = []
    for (let i = start; i < Math.min(start + batch, 255); i++) {
      jobs.push(probeServer(`${base}.${i}`))
    }
    const results = await Promise.all(jobs)
    for (const r of results) {
      if (r) found.set(r.ip, r)
    }
    if (found.size) break
  }
  return [...found.values()]
}

function renderDiscoverList(peers) {
  const list = $('#discover-list')
  const D = window.LanShareDevice
  const ctx = D?.clientContextMeta?.() || D?.deviceMeta?.('phone')
  if (!peers.length) {
    list.innerHTML = `<div class="discover-empty">${escapeHtml(ctx.emptyHint || '未发现设备')}</div>`
    $('#setup-help').classList.remove('hidden')
    return
  }
  $('#setup-help').classList.add('hidden')
  list.innerHTML = ''
  for (const peer of peers) {
    const type = D.peerDeviceType(peer)
    const meta = D.deviceMeta(type)
    const brandMeta = D.brandMeta(D.peerDeviceBrand(peer))
    const name = D.deviceDisplayName(peer)
    const subtitle = D.peerDeviceSubtitle(peer)
    const brand = D.peerDeviceBrand(peer)
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `discover-item type-${type}`
    btn.innerHTML = `
      <div class="discover-icon type-${type}">${meta.icon}</div>
      <div class="discover-meta">
        <div class="discover-name">${escapeHtml(name)}</div>
        <div class="discover-sub">
          <span class="device-badge ${type}">${meta.label}</span>
          ${brand ? `<span class="brand-chip sm" style="--brand-color:${brandMeta.color};--brand-soft:${brandMeta.soft}">${escapeHtml(brand)}</span>` : ''}
          <span>${escapeHtml(subtitle)}</span>
        </div>
        <div class="discover-sub discover-sub-ip">
          <span>${escapeHtml(peer.ip)}:${peer.port || DEFAULT_HTTP_PORT}</span>
          ${peer.version ? `<span>v${escapeHtml(peer.version)}</span>` : ''}
        </div>
      </div>
      <span class="discover-action">连接</span>
    `
    btn.onclick = async () => {
      $('#input-server').value = `${peer.ip}:${peer.port || DEFAULT_HTTP_PORT}`
      const quick = window.LanShareSettings?.readClientSettings?.()?.quickConnect !== false
      if (quick) await connectFromSetup()
    }
    list.appendChild(btn)
  }
}

let discovering = false
let discoveredPeers = []

function mergePeers(list) {
  const map = new Map(discoveredPeers.map((p) => [p.ip, p]))
  for (const p of list) map.set(p.ip, p)
  discoveredPeers = [...map.values()]
  return discoveredPeers
}

async function discoverServers() {
  if (discovering) return
  discovering = true
  const list = $('#discover-list')
  list.innerHTML = '<div class="discover-scanning">正在搜索附近设备…</div>'
  $('#setup-help').classList.add('hidden')
  try {
    if (window.LanShareNative?.getDiscoveredPeers) {
      try {
        mergePeers(JSON.parse(window.LanShareNative.getDiscoveredPeers() || '[]'))
      } catch { /* ignore */ }
    }

    if (discoveredPeers.length) {
      renderDiscoverList(discoveredPeers)
    }

    if (window.LanShareNative?.getDiscoveredPeers) {
      setTimeout(() => {
        try {
          const later = JSON.parse(window.LanShareNative.getDiscoveredPeers() || '[]')
          if (later.length) renderDiscoverList(mergePeers(later))
        } catch { /* ignore */ }
      }, 2500)
    }

    const local = defaultServerHost()
    if (local) {
      try {
        const res = await fetch(`http://${local}/api/discover/peers`, { cache: 'no-store' })
        const data = await res.json()
        const peers = [data.self, ...(data.peers || [])].filter(Boolean)
        if (peers.length) {
          renderDiscoverList(mergePeers(peers))
          return
        }
      } catch { /* fall through */ }
    }

    const found = new Map()
    for (const base of guessSubnets()) {
      for (const peer of await scanSubnetClient(base)) {
        found.set(peer.ip, peer)
      }
      if (found.size) break
    }
    renderDiscoverList(mergePeers([...found.values()]))
  } finally {
    discovering = false
  }
}

window.__onLanShareDiscovered = (peer) => {
  try {
    const p = typeof peer === 'string' ? JSON.parse(peer) : peer
    if (!p?.ip) return
    renderDiscoverList(mergePeers([p]))
  } catch { /* ignore */ }
}

function connectErrorMessage(err) {
  const msg = err?.message || ''
  if (err?.name === 'AbortError' || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return '无法连接电脑'
  }
  return msg || '无法连接'
}

function showConnectHelp(show = true) {
  $('#setup-help').classList.toggle('hidden', !show)
}

async function connectFromSetup() {
  const btn = $('#btn-connect')
  btn.disabled = true
  btn.textContent = '连接中'
  showConnectHelp(false)
  try {
    await connect($('#input-server').value)
    vibrate(12)
    toast('已连接')
  } catch (e) {
    toast(connectErrorMessage(e))
    showConnectHelp(true)
  }
  btn.disabled = false
  btn.textContent = '连接'
}

async function ping() {
  const res = await fetch(api('/api/health'), { cache: 'no-store' })
  if (!res.ok) throw new Error('连接失败')
  return res.json()
}

async function announceClientSession() {
  if (pageServerOrigin()) return
  const client = window.LanShareSettings?.readClientSettings?.() || {}
  try {
    await fetch(api('/api/session/hello'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceName: window.LanShareSettings?.clientDeviceName?.() || '',
        deviceType: client.deviceType,
        deviceBrand: client.deviceBrand || '',
        deviceModel: client.deviceModel || '',
      }),
    })
  } catch { /* ignore */ }
}

async function refreshRemoteClients() {
  if (!pageServerOrigin() || !connected) return
  try {
    const res = await fetch(api('/api/session/peers'), { cache: 'no-store' })
    const data = await res.json()
    if (res.ok && data.peers) {
      activeRemoteClients = data.peers
      renderTransferBar()
    }
  } catch { /* ignore */ }
}

async function connect(url) {
  server = pageServerOrigin() || normalizeServer(url)
  const info = await ping()
  connectedPeer = info
  localStorage.setItem(STORAGE_KEY, server)
  connected = true
  await announceClientSession()
  renderTransferBar()
  showMain()
  root = 'uploads'
  subPath = '/'
  syncTabs('browse')
  updateTitle()
  updatePathBar()
  await loadFiles()
  await refreshRemoteClients()
  window.LanShareAds?.refresh?.()
  window.LanShareUpdate?.refresh?.()
  return info
}

function applyClientContextUI() {
  const D = window.LanShareDevice
  if (!D) return
  const ctx = D.clientContextMeta()
  const client = window.LanShareSettings?.readClientSettings?.()
  const brand = $('#client-device-badge')
  if (brand && client) {
    const bm = D.brandMeta(client.deviceBrand)
    brand.className = `client-device-badge type-${client.deviceType}`
    brand.innerHTML = `
      <span class="device-badge ${client.deviceType}">${ctx.label}</span>
      ${client.deviceBrand ? `<span class="brand-chip sm" style="--brand-color:${bm.color};--brand-soft:${bm.soft}">${escapeHtml(client.deviceBrand)}</span>` : ''}
      <span class="client-device-name">${escapeHtml(window.LanShareSettings.clientDeviceName())}</span>
    `
  }
  const title = $('.brand h1')
  const desc = $('.brand p')
  if (title) title.textContent = ctx.setupTitle || '电脑互传'
  if (desc) desc.textContent = ctx.setupDesc || '同一 WiFi，手机与电脑互传文件'
  document.documentElement.style.setProperty('--accent', ctx.color)
  document.documentElement.style.setProperty('--accent-soft', ctx.soft)
  const discoverSub = $('.discover-subtitle')
  if (discoverSub) {
    discoverSub.textContent = typeof isDesktopBrowser === 'function' && isDesktopBrowser()
      ? '手机/平板安装 App 后可发现本电脑'
      : '点选附近电脑即可连接并传输'
  }
}

function showSetup() {
  $('#screen-setup').classList.remove('hidden')
  $('#screen-main').classList.add('hidden')
  $('#screen-settings')?.classList.add('hidden')
  applyClientContextUI()
  const saved = server.replace(/^https?:\/\//, '')
  $('#input-server').value = saved || defaultServerHost()
  discoverServers()
}

function showMain() {
  $('#screen-setup').classList.add('hidden')
  $('#screen-settings')?.classList.add('hidden')
  $('#screen-main').classList.remove('hidden')
}

function updateTitle() {
  $('#top-title').textContent = connected ? folderContextLabel() : '互传文件'
  const hint = $('#shared-hint')
  if (hint) {
    const isHost = !!pageServerOrigin()
    hint.textContent = isHost
      ? '对方设备可在 shared 文件夹取文件；新文件会自动出现在列表'
      : '电脑放入 shared 文件夹的新文件会自动保存到本机「下载」'
    hint.classList.toggle('hidden', root !== 'shared')
  }
}

function syncTabs(tab, rootOverride) {
  $$('.tab').forEach((n) => {
    const match = rootOverride
      ? n.dataset.root === rootOverride
      : n.dataset.tab === tab
    n.classList.toggle('active', match)
  })
  $('#panel-browse').classList.toggle('hidden', tab !== 'browse')
  $('#panel-upload').classList.toggle('hidden', tab !== 'upload')
}

function showSkeleton() {
  $('#file-list').innerHTML = Array.from({ length: 5 }, () =>
    '<div class="file-item skeleton-row"><div class="sk-icon"></div><div class="sk-lines"><div class="sk-line"></div><div class="sk-line short"></div></div></div>'
  ).join('')
}

function renderEmpty(msg, retry) {
  return `<div class="empty-state">${ICONS.empty}<p>${escapeHtml(msg)}</p>${retry ? '<button class="btn primary retry-btn" id="btn-retry">重新连接</button>' : ''}</div>`
}

function encodePathSegments(p) {
  if (!p || p === '/') return ''
  return p.replace(/^\//, '').split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

function currentBrowsePath() {
  if (subPath === '/') return ''
  return subPath.replace(/^\//, '').replace(/\/$/, '')
}

async function deleteItem(rel, name, isDir) {
  const kind = isDir ? '文件夹' : '文件'
  if (!confirmAction(`确定删除${kind}「${name}」？\n删除后电脑上的该${kind}将不可恢复。`)) return false
  try {
    const res = await fetch(api(`/api/delete/${root}?p=${encodeURIComponent(rel)}`), { method: 'POST' })
    let data = {}
    try {
      data = await res.json()
    } catch { /* ignore */ }
    if (res.status === 404) {
      throw new Error('删除接口不可用，请关闭后重新启动电脑端 LanShare')
    }
    if (!res.ok) throw new Error(data.error || '删除失败')
    toast(`已删除：${name}`)
    vibrate(8)
    await loadFiles()
    return true
  } catch (e) {
    toastErr(e.message || '删除失败')
    return false
  }
}

async function clearCurrentFolder() {
  const label = folderContextLabel()
  const folder = subPath === '/' ? label : `${label}${subPath}`
  if (!confirmAction(`确定清空「${folder}」下的全部内容？\n此操作会删除电脑上的文件，不可恢复。`)) return
  try {
    const q = subPath === '/' ? '' : `?path=${encodeURIComponent(currentBrowsePath())}`
    const res = await fetch(api(`/api/clear/${root}${q}`), { method: 'POST' })
    let data = {}
    try {
      data = await res.json()
    } catch { /* ignore */ }
    if (res.status === 404) {
      throw new Error('清空接口不可用，请关闭后重新启动电脑端 LanShare')
    }
    if (!res.ok) throw new Error(data.error || '清空失败')
    toast(data.count ? `已清空 ${data.count} 项` : '当前文件夹已为空')
    vibrate(10)
    await loadFiles()
  } catch (e) {
    toastErr(e.message || '清空失败')
  }
}

function updateClearFolderBtn(hasItems) {
  const btn = $('#btn-clear-folder')
  if (!btn) return
  btn.classList.toggle('hidden', !connected || !hasItems)
}

async function loadFiles() {
  if (loading) return
  loading = true
  showSkeleton()
  updatePathBar()
  try {
    const q = subPath === '/' ? '' : encodePathSegments(subPath)
    const res = await fetch(api(`/api/browse/${root}${q ? '/' + q : ''}`))
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '加载失败')

    const list = $('#file-list')
    if (!data.items.length) {
      list.innerHTML = renderEmpty('暂无文件')
      updateClearFolderBtn(false)
      return
    }

    updateClearFolderBtn(true)
    list.innerHTML = ''
    const frag = document.createDocumentFragment()
    for (const it of data.items) {
      const row = document.createElement('div')
      row.className = 'file-item'
      const rel = it.rel || it.path.replace(`/browse/${root}`, '').replace(/^\//, '')
      const isDir = it.isDir

      row.innerHTML = `
        <div class="file-icon ${isDir ? 'dir' : 'file'}">${isDir ? ICONS.folder : ICONS.file}</div>
        <div class="file-meta">
          <div class="file-name">${escapeHtml(it.name)}</div>
          <div class="file-size">${isDir ? '文件夹' : fmtSize(it.size)}</div>
        </div>
      `

      if (isDir) {
        row.insertAdjacentHTML('beforeend', ICONS.chevron)
        row.onclick = () => {
          vibrate()
          subPath = rel.endsWith('/') ? rel : rel + '/'
          if (!subPath.startsWith('/')) subPath = '/' + subPath
          loadFiles()
        }
        const actions = document.createElement('div')
        actions.className = 'file-actions'
        const delBtn = document.createElement('button')
        delBtn.className = 'file-action danger'
        delBtn.textContent = '删除'
        delBtn.onclick = async (e) => {
          e.stopPropagation()
          await deleteItem(rel, it.name, true)
        }
        actions.appendChild(delBtn)
        row.appendChild(actions)
      } else {
        const actions = document.createElement('div')
        actions.className = 'file-actions'
        const btn = document.createElement('button')
        btn.className = 'file-action'
        btn.textContent = root === 'shared' ? '保存' : '下载'
        btn.onclick = async (e) => {
          e.stopPropagation()
          vibrate()
          const dl = it.downloadUrl || `/api/download/${root}?p=${encodeURIComponent(rel)}`
          markSharedSeen(`${rel}:${it.mtime}`)
          await downloadFile(dl, it.name)
        }
        const delBtn = document.createElement('button')
        delBtn.className = 'file-action danger'
        delBtn.textContent = '删除'
        delBtn.onclick = async (e) => {
          e.stopPropagation()
          await deleteItem(rel, it.name, false)
        }
        actions.appendChild(btn)
        actions.appendChild(delBtn)
        row.appendChild(actions)
      }
      frag.appendChild(row)
    }
    list.appendChild(frag)
    connected = true
    $('#status-bar').classList.remove('offline')
  } catch (e) {
    $('#file-list').innerHTML = renderEmpty(e.message, true)
    $('#btn-retry')?.addEventListener('click', showSetup)
    setStatus(false, '连接断开')
    connected = false
    updateClearFolderBtn(false)
  } finally {
    loading = false
  }
}

async function downloadFile(path, name, auto = false) {
  const url = path.startsWith('http') ? path : api(path)
  const fname = name || 'download'

  if (window.LanShareNative?.downloadFile) {
    const result = window.LanShareNative.downloadFile(url, fname)
    if (result === 'ok') {
      toast(auto ? `已自动保存：${fname}` : `已保存到「下载」：${fname}`, auto ? 2500 : 3000)
      return true
    }
    if (!auto) toastErr(result || '下载失败')
    return false
  }

  if (!auto) toast('下载中…')
  if (url.startsWith('http')) {
    const a = document.createElement('a')
    a.href = url
    a.download = fname
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    toast(auto ? `已开始保存：${fname}` : '已开始下载，请查看通知栏')
    return true
  }

  try {
    const res = await fetch(url)
    if (!res.ok) {
      const reason = res.status === 404 ? '文件不存在或已被删除' : `下载失败 (HTTP ${res.status})`
      throw new Error(reason)
    }
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fname
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl)
      a.remove()
    }, 1000)
    toast(auto ? `已自动保存：${fname}` : '已保存')
    return true
  } catch (e) {
    if (!auto) toastErr(e.message || '下载失败')
    return false
  }
}

function uploadErrorFromXhr(xhr) {
  if (xhr.status === 0) {
    if (!connected || !server) return '未连接电脑，请先在首页连接'
    return '网络中断：请确认手机与电脑在同一 WiFi，且电脑 LanShare 正在运行'
  }
  let data = {}
  try {
    data = JSON.parse(xhr.responseText || '{}')
  } catch { /* ignore */ }
  if (xhr.status === 413) return '文件过大，电脑端无法接收'
  if (xhr.status === 400) return data.error || '请求无效，请重试'
  if (xhr.status === 404) return '上传接口不存在，请更新电脑端 LanShare 到最新版'
  if (xhr.status >= 500) return data.error ? `电脑端保存失败：${data.error}` : '电脑端保存失败，请查看电脑窗口日志'
  if (data.error) return data.error
  return `上传失败 (HTTP ${xhr.status})`
}

function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    fd.append('files', file)
    const q = subPath === '/' ? '' : `&path=${encodeURIComponent(subPath)}`
    const xhr = new XMLHttpRequest()
    xhr.open('POST', api(`/api/upload?target=uploads${q}`))
    xhr.timeout = 600000
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300 && data.ok) resolve(data)
        else reject(new Error(uploadErrorFromXhr(xhr)))
      } catch {
        reject(new Error(uploadErrorFromXhr(xhr)))
      }
    }
    xhr.onerror = () => reject(new Error(`网络错误：无法连接电脑，请检查 WiFi 与防火墙 ${DEFAULT_HTTP_PORT} 端口`))
    xhr.ontimeout = () => reject(new Error('上传超时：文件过大或网络不稳定，请靠近路由器后重试'))
    xhr.onabort = () => reject(new Error('上传已取消'))
    xhr.send(fd)
  })
}

async function handleFiles(files) {
  vibrate(10)
  const queue = $('#upload-queue')
  let ok = 0
  let fail = 0
  let lastErr = ''
  for (const file of files) {
    const job = document.createElement('div')
    job.className = 'upload-job'
    job.innerHTML = `
      <div class="upload-job-name">${escapeHtml(file.name)}</div>
      <div class="progress"><div class="progress-bar"></div></div>
      <div class="upload-status">准备中</div>
    `
    queue.prepend(job)
    const bar = job.querySelector('.progress-bar')
    const status = job.querySelector('.upload-status')
    try {
      await uploadFile(file, (pct) => {
        bar.style.width = pct + '%'
        status.textContent = `${pct}%`
      })
      bar.style.width = '100%'
      status.textContent = '已保存到电脑'
      status.style.color = 'var(--ok)'
      ok++
    } catch (e) {
      const msg = e.message || '上传失败'
      status.textContent = msg
      status.style.color = 'var(--err)'
      fail++
      lastErr = msg
    }
  }
  if (fail && ok) toastErr(`部分失败：${ok} 个成功，${fail} 个失败。原因：${lastErr}`)
  else if (fail) toastErr(`上传失败：${lastErr}`)
  else toast(`已上传到电脑（${ok} 个文件）`)
  if (!$('#panel-browse').classList.contains('hidden')) loadFiles()
}

async function collectSharedFiles(rel = '') {
  const norm = String(rel || '').replace(/^\/+/, '').replace(/\/+$/, '')
  const browsePath = norm ? `/api/browse/shared/${norm}` : '/api/browse/shared'
  const res = await fetch(api(browsePath), { cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '读取共享目录失败')
  const files = []
  for (const it of data.items || []) {
    if (it.isDir) {
      files.push(...await collectSharedFiles(it.rel || norm))
    } else {
      files.push(it)
    }
  }
  return files
}

async function pollSharedIncoming() {
  if (!connected || !getApiBase()) return
  const autoSave = window.LanShareSettings?.readClientSettings?.()?.autoSaveIncoming !== false
  if (!autoSave) return
  try {
    const items = await collectSharedFiles()
    for (const it of items) {
      const key = `${it.rel}:${it.mtime}`
      if (seenShared.has(key)) continue
      const ok = await downloadFile(it.downloadUrl || `/api/download/shared?p=${encodeURIComponent(it.rel)}`, it.name, true)
      if (ok) markSharedSeen(key)
    }
  } catch { /* ignore */ }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

window.__pullRefresh = () => {
  if ($('#screen-main').classList.contains('hidden')) return
  if (!$('#panel-browse').classList.contains('hidden')) loadFiles()
}

window.__onBack = () => {
  if ($('#screen-setup').classList.contains('hidden') && subPath !== '/') {
    const parts = subPath.replace(/\/$/, '').split('/').filter(Boolean)
    parts.pop()
    subPath = parts.length ? '/' + parts.join('/') + '/' : '/'
    loadFiles()
    return true
  }
  return false
}

$('#btn-connect').onclick = connectFromSetup
$('#btn-rescan').onclick = () => { vibrate(); discoverServers() }
$('#btn-clear-local').onclick = () => {
  vibrate()
  if (confirmAction('清除本地记录？\n将断开连接并清除保存的电脑地址与自动下载记忆。')) clearLocalRecords()
}

$('#btn-open-settings')?.addEventListener('click', () => { vibrate(); window.LanShareSettings?.showSettingsScreen?.() })
$('#btn-settings-back')?.addEventListener('click', () => { vibrate(); window.LanShareSettings?.hideSettingsScreen?.() })
$('#btn-save-settings')?.addEventListener('click', async () => {
  vibrate()
  try {
    const data = await window.LanShareSettings.saveAllSettings()
    toast(data.restartRequired ? '已保存，请重启服务使端口/路径生效' : '设置已保存')
    window.LanShareSettings.hideSettingsScreen()
    if (connected && connectedPeer) renderConnectedDevice(connectedPeer)
  } catch (e) {
    toastErr(e.message || '保存失败')
  }
})

$('#btn-settings').onclick = () => { vibrate(); window.LanShareSettings?.showSettingsScreen?.() }

$('#btn-back').onclick = () => {
  if (subPath === '/') return
  vibrate()
  const parts = subPath.replace(/\/$/, '').split('/').filter(Boolean)
  parts.pop()
  subPath = parts.length ? '/' + parts.join('/') + '/' : '/'
  loadFiles()
}

$('#btn-refresh').onclick = () => { vibrate(); loadFiles() }
$('#btn-clear-folder').onclick = () => { vibrate(); clearCurrentFolder() }

$('#btn-pick').onclick = () => $('#file-input').click()
$('#upload-zone').onclick = (e) => {
  if (e.target.id !== 'btn-pick') $('#file-input').click()
}

$('#file-input').onchange = (e) => {
  if (e.target.files?.length) handleFiles([...e.target.files])
  e.target.value = ''
}

$$('.tab').forEach((btn) => {
  btn.onclick = () => {
    vibrate()
    if (btn.dataset.root) {
      root = btn.dataset.root
      subPath = '/'
      updateTitle()
      syncTabs('browse', 'shared')
      loadFiles()
      return
    }
    if (btn.dataset.tab === 'browse') {
      root = 'uploads'
      subPath = '/'
      updateTitle()
      syncTabs('browse')
      loadFiles()
      return
    }
    syncTabs('upload')
  }
})

setInterval(async () => {
  if (!connected || !server) return
  try {
    const info = await ping()
    connectedPeer = info
    await announceClientSession()
    await refreshRemoteClients()
    renderTransferBar()
  } catch {
    setStatus(false, '连接断开')
    connected = false
    activeRemoteClients = []
    renderTransferBar()
  }
}, 15000)

setInterval(() => {
  if (connected && pageServerOrigin()) refreshRemoteClients()
}, 5000)

setInterval(pollSharedIncoming, 4000)

;(async () => {
  loadSeenShared()
  const ver = window.__LANSHARE_VERSION__ || ''
  if (ver) {
    $('#ver-tag').textContent = `LanShare v${ver}`
    $('#ver-bar').textContent = `v${ver}`
  }
  const localOrigin = pageServerOrigin()
  if (localOrigin) {
    try {
      await connect(localOrigin)
      return
    } catch {
      showSetup()
      return
    }
  }
  if (server) {
    try {
      await connect(server)
      return
    } catch {
      showSetup()
      return
    }
  }
  showSetup()
  applyClientContextUI()
  discoverServers()
})()
