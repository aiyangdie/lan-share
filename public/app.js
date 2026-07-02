const STORAGE_KEY = 'lan_share_server'
const STORAGE_SHARED_SEEN = 'lan_share_seen_shared'

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

/** 电脑浏览器直接打开本机 8787 时，始终走当前页面同源，避免跨域 */
function pageServerOrigin() {
  if (window.location.port === '8787') return window.location.origin
  return ''
}

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
  server = pageServerOrigin() || normalizeServer(url)
  const info = await ping()
  localStorage.setItem(STORAGE_KEY, server)
  connected = true
  const label = pageServerOrigin() ? `本机 · ${info.ip}:${info.port}` : `${info.ip}:${info.port}`
  setStatus(true, label)
  showMain()
  root = 'uploads'
  subPath = '/'
  syncTabs('browse')
  updateTitle()
  await loadFiles()
  window.LanShareAds?.refresh?.()
  window.LanShareUpdate?.refresh?.()
  return info
}

function showSetup() {
  $('#screen-setup').classList.remove('hidden')
  $('#screen-main').classList.add('hidden')
  const saved = server.replace(/^https?:\/\//, '')
  $('#input-server').value = saved || defaultServerHost()
  $('#pc-settings')?.classList.toggle('hidden', !pageServerOrigin())
  if (pageServerOrigin()) loadPcSettings()
  discoverServers()
}

async function loadPcSettings() {
  try {
    const res = await fetch(api('/api/settings'))
    const data = await res.json()
    if (!res.ok) return
    const s = data.settings
    $('#pc-upload-dir').value = s.uploadDir || ''
    $('#pc-shared-dir').value = s.sharedDir || ''
    $('#pc-port').value = s.port || 8787
  } catch { /* ignore */ }
}

async function savePcSettings() {
  try {
    const body = {
      uploadDir: $('#pc-upload-dir').value.trim(),
      sharedDir: $('#pc-shared-dir').value.trim(),
      port: Number($('#pc-port').value),
    }
    const res = await fetch(api('/api/settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '保存失败')
    toast(data.restartRequired ? '已保存，请重启 LanShare 服务' : '电脑设置已保存')
  } catch (e) {
    toastErr(e.message || '保存失败')
  }
}

function showMain() {
  $('#screen-setup').classList.add('hidden')
  $('#screen-main').classList.remove('hidden')
}

function updateTitle() {
  $('#top-title').textContent = root === 'uploads' ? '手机上传' : '电脑共享'
  const hint = $('#shared-hint')
  if (hint) hint.classList.toggle('hidden', root !== 'shared')
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
  const label = root === 'uploads' ? '手机上传' : '电脑共享'
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
    xhr.onerror = () => reject(new Error('网络错误：无法连接电脑，请检查 WiFi 与防火墙 8787 端口'))
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

async function pollSharedIncoming() {
  if (!connected || !getApiBase()) return
  try {
    const res = await fetch(api('/api/browse/shared'), { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) return
    for (const it of data.items) {
      if (it.isDir) continue
      const key = `${it.rel}:${it.mtime}`
      if (seenShared.has(key)) continue
      markSharedSeen(key)
      await downloadFile(it.downloadUrl || `/api/download/shared?p=${encodeURIComponent(it.rel)}`, it.name, true)
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
$('#btn-save-pc-settings').onclick = () => { vibrate(); savePcSettings() }

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
    setStatus(true, `${info.ip}:${info.port}`)
  } catch {
    setStatus(false, '连接断开')
    connected = false
  }
}, 15000)

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
  discoverServers()
})()
