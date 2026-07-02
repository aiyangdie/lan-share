const TOKEN_KEY = 'lanshare_admin_token'
const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]

let adsData = null
let configData = null

function token() { return localStorage.getItem(TOKEN_KEY) || '' }
function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) }

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (token()) headers.Authorization = `Bearer ${token()}`
  const res = await fetch(path, { ...opts, headers })
  let data = {}
  try { data = await res.json() } catch { /* ignore */ }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function showLogin() {
  $('#screen-login').classList.remove('hidden')
  $('#screen-dashboard').classList.add('hidden')
}

function showDashboard() {
  $('#screen-login').classList.add('hidden')
  $('#screen-dashboard').classList.remove('hidden')
}

function setStatus(text) { $('#save-status').textContent = text }

function switchTab(name) {
  $$('.tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name))
  $$('.main .panel').forEach((p) => p.classList.add('hidden'))
  $(`#panel-${name}`).classList.remove('hidden')
}

function renderPreview(slotKey, slot) {
  const card = $(`.slot-card[data-slot="${slotKey}"]`)
  const box = $('[data-preview]', card)
  if (!box) return
  if (!slot.enabled) {
    box.innerHTML = '<div style="padding:18px;color:#9ca3af;text-align:center;font-size:.875rem">未启用</div>'
    return
  }
  const img = slot.imageUrl ? `<img src="${escapeHtml(slot.imageUrl)}" alt="" onerror="this.style.display='none'" />` : ''
  box.innerHTML = `<a class="ad-preview" href="${escapeHtml(slot.linkUrl || '#')}" target="_blank" rel="noopener" style="background:${escapeHtml(slot.bgColor)};color:${escapeHtml(slot.textColor)}">${img}<div class="meta"><div class="title">${escapeHtml(slot.title || '标题')}</div><div class="sub">${escapeHtml(slot.subtitle || '')}</div></div><span class="badge">${escapeHtml(slot.badge || '广告')}</span></a>`
}

function fillAdForm(slotKey, slot) {
  const card = $(`.slot-card[data-slot="${slotKey}"]`)
  for (const input of $$('[data-field]', card)) {
    const field = input.dataset.field
    if (field === 'enabled') input.checked = !!slot.enabled
    else input.value = slot[field] ?? ''
  }
  renderPreview(slotKey, slot)
}

function readAdForm(slotKey) {
  const card = $(`.slot-card[data-slot="${slotKey}"]`)
  const slot = {}
  for (const input of $$('[data-field]', card)) {
    const field = input.dataset.field
    slot[field] = field === 'enabled' ? input.checked : input.value.trim()
  }
  return slot
}

function fillConfigForm(key, data) {
  const card = $(`.slot-card[data-config="${key}"]`)
  if (!card) return
  for (const input of $$('[data-field]', card)) {
    const field = input.dataset.field
    if (field === 'enabled' || field === 'mandatory') input.checked = !!data[field]
    else input.value = data[field] ?? ''
  }
}

function readConfigForm(key) {
  const card = $(`.slot-card[data-config="${key}"]`)
  const data = {}
  for (const input of $$('[data-field]', card)) {
    const field = input.dataset.field
    if (field === 'enabled' || field === 'mandatory') data[field] = input.checked
    else if (field === 'versionCode') data[field] = parseInt(input.value, 10) || 0
    else data[field] = input.value.trim()
  }
  return data
}

async function loadAll() {
  const [adsRes, cfgRes] = await Promise.all([api('/admin/api/ads'), api('/admin/api/config')])
  adsData = adsRes.data
  configData = cfgRes.data
  for (const key of ['banner', 'setup']) fillAdForm(key, adsData.slots[key])
  fillConfigForm('announcement', configData.announcement)
  fillConfigForm('android', configData.android)
  fillConfigForm('windows', configData.windows)
  const t = configData.updatedAt ? new Date(configData.updatedAt).toLocaleString() : '尚未保存'
  setStatus(`上次保存：${t}`)
}

async function saveAds() {
  const payload = { slots: { banner: readAdForm('banner'), setup: readAdForm('setup') } }
  const res = await api('/admin/api/ads', { method: 'PUT', body: JSON.stringify(payload) })
  adsData = res.data
  setStatus(`广告已保存：${new Date().toLocaleString()}`)
}

async function saveConfig() {
  const payload = {
    announcement: readConfigForm('announcement'),
    android: readConfigForm('android'),
    windows: readConfigForm('windows'),
  }
  const res = await api('/admin/api/config', { method: 'PUT', body: JSON.stringify(payload) })
  configData = res.data
  setStatus(`配置已保存：${new Date(configData.updatedAt).toLocaleString()}`)
}

$$('.slot-card[data-slot]').forEach((card) => {
  card.addEventListener('input', () => renderPreview(card.dataset.slot, readAdForm(card.dataset.slot)))
})

$$('.tabs .tab').forEach((btn) => btn.onclick = () => switchTab(btn.dataset.tab))

$('#btn-login').onclick = async () => {
  try {
    const res = await api('/admin/api/login', { method: 'POST', body: JSON.stringify({ password: $('#input-password').value }) })
    setToken(res.token)
    showDashboard()
    await loadAll()
  } catch (e) { alert(e.message || '登录失败') }
}

$('#btn-logout').onclick = async () => {
  try { await api('/admin/api/logout', { method: 'POST', body: '{}' }) } catch { /* ignore */ }
  setToken('')
  showLogin()
}

$('#btn-save-ads').onclick = async () => { try { await saveAds() } catch (e) { alert(e.message) } }
$('#btn-save-config').onclick = async () => { try { await saveConfig() } catch (e) { alert(e.message) } }
$('#btn-save-config2').onclick = async () => { try { await saveConfig() } catch (e) { alert(e.message) } }

$('#input-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-login').click() })

;(async () => {
  if (!token()) { showLogin(); return }
  try { showDashboard(); await loadAll() } catch { setToken(''); showLogin() }
})()
