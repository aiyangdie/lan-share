/**
 * 客户端系统设置（手机 / 平板 / 浏览器）· LocalSend 风格
 * 服务端路径设置走 /api/settings
 */
const CLIENT_SETTINGS_KEY = 'lan_share_client_settings'

function defaultClientSettings() {
  const detected = window.LanShareDevice?.detectClientDeviceInfo?.() || {}
  const type = detected.deviceType || window.LanShareDevice?.detectClientDeviceType?.() || 'phone'
  return {
    deviceName: detected.deviceName || '',
    deviceType: type,
    deviceBrand: detected.deviceBrand || '',
    deviceModel: detected.deviceModel || '',
    autoDetected: true,
    autoSaveIncoming: true,
    showDeviceTypeBadge: true,
    quickConnect: true,
    updatedAt: Date.now(),
  }
}

function readClientSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(CLIENT_SETTINGS_KEY) || '{}')
    const base = defaultClientSettings()
    const merged = { ...base, ...raw }
    if (raw.autoDetected === false) {
      merged.deviceType = window.LanShareDevice?.normalizeDeviceType?.(raw.deviceType || base.deviceType)
    } else {
      merged.deviceType = base.deviceType
      merged.deviceBrand = base.deviceBrand || merged.deviceBrand
      merged.deviceModel = base.deviceModel || merged.deviceModel
      if (!raw.deviceName?.trim() && base.deviceName) merged.deviceName = base.deviceName
    }
    return merged
  } catch {
    return defaultClientSettings()
  }
}

function writeClientSettings(patch) {
  const prev = readClientSettings()
  const next = {
    ...prev,
    ...patch,
    deviceName: String(patch.deviceName ?? prev.deviceName ?? '').slice(0, 32),
    deviceType: window.LanShareDevice?.normalizeDeviceType?.(patch.deviceType || prev.deviceType),
    deviceBrand: String(patch.deviceBrand ?? prev.deviceBrand ?? '').slice(0, 32),
    deviceModel: String(patch.deviceModel ?? prev.deviceModel ?? '').slice(0, 64),
    autoDetected: patch.autoDetected ?? (patch.deviceType ? false : prev.autoDetected),
    updatedAt: Date.now(),
  }
  localStorage.setItem(CLIENT_SETTINGS_KEY, JSON.stringify(next))
  return next
}

function clientDeviceName() {
  const s = readClientSettings()
  if (s.deviceName.trim()) return s.deviceName.trim()
  const type = window.LanShareDevice?.deviceMeta?.(s.deviceType)?.label || '设备'
  if (s.deviceBrand && s.deviceModel) return `${s.deviceBrand} ${s.deviceModel}`.slice(0, 32)
  return `我的${type}`
}

function applyDeviceTypeSelectOptions() {
  const sel = $('#set-device-type')
  if (!sel) return
  const allowed = window.LanShareDevice?.allowedClientTypes?.() || ['phone', 'tablet', 'desktop']
  const current = readClientSettings().deviceType
  sel.innerHTML = ''
  for (const t of ['phone', 'tablet', 'desktop']) {
    if (!allowed.includes(t)) continue
    const meta = window.LanShareDevice.deviceMeta(t)
    const opt = document.createElement('option')
    opt.value = t
    opt.textContent = meta.label
    sel.appendChild(opt)
  }
  sel.value = allowed.includes(current) ? current : allowed[0]
  sel.disabled = window.LanShareNative && allowed.length === 1
}

function renderDetectedDeviceCard() {
  const card = $('#detected-device-card')
  if (!card) return
  const s = readClientSettings()
  const meta = window.LanShareDevice?.deviceMeta?.(s.deviceType)
  const brandMeta = window.LanShareDevice?.brandMeta?.(s.deviceBrand)
  const subtitle = window.LanShareDevice?.peerDeviceSubtitle?.({
    deviceType: s.deviceType,
    deviceBrand: s.deviceBrand,
    deviceModel: s.deviceModel,
  })
  card.innerHTML = `
    <div class="detected-device-inner type-${s.deviceType}">
      <div class="discover-icon type-${s.deviceType}">${meta?.icon || ''}</div>
      <div class="detected-device-text">
        <strong>${escapeHtml(clientDeviceName())}</strong>
        <span>${escapeHtml(subtitle || meta?.label || '')}</span>
      </div>
      ${s.deviceBrand ? `<span class="brand-chip" style="--brand-color:${brandMeta.color};--brand-soft:${brandMeta.soft}">${escapeHtml(s.deviceBrand)}</span>` : ''}
    </div>
  `
}

async function loadServerSettings() {
  if (typeof api !== 'function') return null
  try {
    const res = await fetch(api('/api/settings'), { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) return null
    return data.settings
  } catch {
    return null
  }
}

async function saveServerSettings(patch) {
  const res = await fetch(api('/api/settings'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '保存失败')
  return data
}

function bindSettingsForm() {
  applyDeviceTypeSelectOptions()
  const client = readClientSettings()
  $('#set-device-name') && ($('#set-device-name').value = client.deviceName)
  $('#set-device-type') && ($('#set-device-type').value = client.deviceType)
  $('#set-auto-save') && ($('#set-auto-save').checked = client.autoSaveIncoming)
  $('#set-quick-connect') && ($('#set-quick-connect').checked = client.quickConnect)
  renderDetectedDeviceCard()

  const typeHint = $('#device-type-hint')
  if (typeHint) {
    const meta = window.LanShareDevice?.deviceMeta?.(client.deviceType)
    if (window.LanShareNative) {
      typeHint.textContent = `已自动识别为${meta?.label || '设备'}，与系统类型一致`
    } else if (typeof isDesktopBrowser === 'function' && isDesktopBrowser()) {
      typeHint.textContent = '电脑浏览器：可修改对外显示的设备类型'
    } else {
      typeHint.textContent = `浏览器识别为${meta?.label || '设备'}，可手动调整`
    }
  }

  const serverPanel = $('#server-settings-panel')
  if (!serverPanel || serverPanel.classList.contains('hidden')) return
  loadServerSettings().then((s) => {
    if (!s) return
    $('#set-upload-dir') && ($('#set-upload-dir').value = s.uploadDir || '')
    $('#set-shared-dir') && ($('#set-shared-dir').value = s.sharedDir || '')
    $('#set-server-name') && ($('#set-server-name').value = s.deviceName || '')
    $('#set-server-type') && ($('#set-server-type').value = s.deviceType || 'desktop')
    $('#set-port') && ($('#set-port').value = s.port || 8787)
    $('#set-auto-save-server') && ($('#set-auto-save-server').checked = s.autoSaveIncoming !== false)
    const serverInfo = $('#server-device-info')
    if (serverInfo) {
      const sub = window.LanShareDevice?.peerDeviceSubtitle?.(s) || '电脑'
      serverInfo.textContent = s.deviceBrand ? `已识别：${sub}` : `本机：${sub}`
    }
  }).catch(() => {})
}

async function saveAllSettings() {
  const client = writeClientSettings({
    deviceName: $('#set-device-name')?.value?.trim() || '',
    deviceType: $('#set-device-type')?.value || readClientSettings().deviceType,
    autoDetected: false,
    autoSaveIncoming: !!$('#set-auto-save')?.checked,
    quickConnect: !!$('#set-quick-connect')?.checked,
  })

  const serverPanel = $('#server-settings-panel')
  if (serverPanel && !serverPanel.classList.contains('hidden')) {
    const data = await saveServerSettings({
      deviceName: $('#set-server-name')?.value?.trim() || client.deviceName,
      deviceType: $('#set-server-type')?.value || 'desktop',
      uploadDir: $('#set-upload-dir')?.value?.trim(),
      sharedDir: $('#set-shared-dir')?.value?.trim(),
      port: Number($('#set-port')?.value),
      autoSaveIncoming: !!$('#set-auto-save-server')?.checked,
    })
    return { client, server: data }
  }
  return { client }
}

function showSettingsScreen() {
  $('#screen-main')?.classList.add('hidden')
  $('#screen-setup')?.classList.add('hidden')
  $('#screen-settings')?.classList.remove('hidden')
  const isServer = typeof pageServerOrigin === 'function' && !!pageServerOrigin()
  $('#server-settings-panel')?.classList.toggle('hidden', !isServer)
  $('#client-settings-hint')?.classList.toggle('hidden', isServer)
  bindSettingsForm()
}

function hideSettingsScreen() {
  $('#screen-settings')?.classList.add('hidden')
  if (connected) {
    $('#screen-main')?.classList.remove('hidden')
  } else {
    $('#screen-setup')?.classList.remove('hidden')
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

window.LanShareSettings = {
  readClientSettings,
  writeClientSettings,
  clientDeviceName,
  loadServerSettings,
  saveServerSettings,
  bindSettingsForm,
  saveAllSettings,
  showSettingsScreen,
  hideSettingsScreen,
  renderDetectedDeviceCard,
}
