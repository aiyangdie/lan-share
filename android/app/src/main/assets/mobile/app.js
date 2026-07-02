const STORAGE_KEY = 'lan_share_server'

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
let loading = false

function normalizeServer(url) {
  let u = (url || '').trim().replace(/\/+$/, '')
  if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'http://' + u
  return u
}

function api(path) {
  return `${server}${path}`
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

function fmtSize(n) {
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB'
  return (n / 1073741824).toFixed(2) + ' GB'
}

function setStatus(online, text) {
  const bar = $('#status-bar')
  $('#top-sub').textContent = text
  bar.classList.toggle('offline', !online)
}

function updatePathBar() {
  const label = root === 'uploads' ? '手机上传' : '电脑共享'
  const sub = subPath === '/' ? '' : subPath
  $('#path-label').textContent = label + sub
  $('#btn-back').disabled = subPath === '/'
}

function defaultServerHost() {
  const { hostname, host, port } = window.location
  if (hostname && port === '8787') return host
  return ''
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

async function probeServer(ip, port = 8787) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 1200)
    const res = await fetch(`http://${ip}:${port}/api/health`, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) return null
    const j = await res.json()
    if (j.ok && j.name === 'lan-share') {
      return { ip: j.ip || ip, port: j.port || port, version: j.version, hostname: j.hostname || ip }
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
  if (!peers.length) {
    list.innerHTML = '<div class="discover-empty">未发现电脑，请确认电脑已启动 LanShare</div>'
    $('#setup-help').classList.remove('hidden')
    return
  }
  $('#setup-help').classList.add('hidden')
  list.innerHTML = ''
  for (const peer of peers) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'discover-item'
    const host = peer.hostname || peer.ip
    btn.innerHTML = `
      <div class="discover-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
      </div>
      <div class="discover-meta">
        <div class="discover-name">${escapeHtml(host)}</div>
        <div class="discover-sub">${escapeHtml(peer.ip)}:${peer.port || 8787}${peer.version ? ` · v${escapeHtml(peer.version)}` : ''}</div>
      </div>
    `
    btn.onclick = async () => {
      $('#input-server').value = `${peer.ip}:${peer.port || 8787}`
      await connectFromSetup()
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
  list.innerHTML = '<div class="discover-scanning">正在搜索附近电脑…</div>'
  $('#setup-help').classList.add('hidden')
  try {
    if (window.LanShareNative?.getDiscoveredPeers) {
      const raw = window.LanShareNative.getDiscoveredPeers()
      const peers = JSON.parse(raw || '[]')
      if (peers.length) {
        renderDiscoverList(mergePeers(peers))
        return
      }
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

async function connect(url) {
  server = normalizeServer(url)
  const info = await ping()
  localStorage.setItem(STORAGE_KEY, server)
  connected = true
  setStatus(true, `${info.ip}:${info.port}`)
  showMain()
  root = 'uploads'
  subPath = '/'
  syncTabs('browse')
  updateTitle()
  await loadFiles()
  return info
}

function showSetup() {
  $('#screen-setup').classList.remove('hidden')
  $('#screen-main').classList.add('hidden')
  const saved = server.replace(/^https?:\/\//, '')
  $('#input-server').value = saved || defaultServerHost()
  discoverServers()
}

function showMain() {
  $('#screen-setup').classList.add('hidden')
  $('#screen-main').classList.remove('hidden')
}

function updateTitle() {
  $('#top-title').textContent = root === 'uploads' ? '手机上传' : '电脑共享'
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
      return
    }

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
      } else {
        const btn = document.createElement('button')
        btn.className = 'file-action'
        btn.textContent = '下载'
        btn.onclick = (e) => {
          e.stopPropagation()
          vibrate()
          downloadFile(it.downloadUrl || `/api/download/${root}?p=${encodeURIComponent(rel)}`, it.name)
        }
        row.appendChild(btn)
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
  } finally {
    loading = false
  }
}

async function downloadFile(path, name) {
  toast('下载中…')
  try {
    const res = await fetch(api(path))
    if (!res.ok) throw new Error('下载失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name || 'download'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(url)
      a.remove()
    }, 1000)
    toast('已保存')
  } catch (e) {
    toast(e.message || '下载失败')
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    fd.append('files', file)
    const q = subPath === '/' ? '' : `&path=${encodeURIComponent(subPath)}`
    const xhr = new XMLHttpRequest()
    xhr.open('POST', api(`/api/upload?target=${root}${q}`))
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && data.ok) resolve(data)
        else reject(new Error(data.error || '上传失败'))
      } catch {
        reject(new Error('上传失败'))
      }
    }
    xhr.onerror = () => reject(new Error('网络错误'))
    xhr.send(fd)
  })
}

async function handleFiles(files) {
  vibrate(10)
  const queue = $('#upload-queue')
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
      status.textContent = '完成'
      status.style.color = 'var(--ok)'
    } catch (e) {
      status.textContent = e.message
      status.style.color = 'var(--err)'
    }
  }
  toast('上传完成')
  if (!$('#panel-browse').classList.contains('hidden')) loadFiles()
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

$('#btn-settings').onclick = showSetup

$('#btn-back').onclick = () => {
  if (subPath === '/') return
  vibrate()
  const parts = subPath.replace(/\/$/, '').split('/').filter(Boolean)
  parts.pop()
  subPath = parts.length ? '/' + parts.join('/') + '/' : '/'
  loadFiles()
}

$('#btn-refresh').onclick = () => { vibrate(); loadFiles() }

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
    setStatus(true, `${info.ip}:${info.port}`)
  } catch {
    setStatus(false, '连接断开')
    connected = false
  }
}, 15000)

;(async () => {
  const ver = window.__LANSHARE_VERSION__ || ''
  if (ver) {
    $('#ver-tag').textContent = `LanShare v${ver}`
    $('#ver-bar').textContent = `v${ver}`
  }
  if (server) {
    try {
      await connect(server)
      return
    } catch {
      showSetup()
    }
  } else {
    const local = defaultServerHost()
    if (local) {
      try {
        await connect(`http://${local}`)
        return
      } catch {
        /* fall through to setup */
      }
    }
    showSetup()
    discoverServers()
  }
})()
