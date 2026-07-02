/**
 * 客户端系统设置（手机 / 平板 / 浏览器）· LocalSend 风格
 * 服务端路径设置走 /api/settings
 */
const CLIENT_SETTINGS_KEY = 'lan_share_client_settings'

function defaultClientSettings() {
  const type = window.LanShareDevice?.detectClientDeviceType?.() || 'phone'
  return {
    deviceName: '',
    deviceType: type,
    autoSaveIncoming: true,
    showDeviceTypeBadge: true,
    quickConnect: true,
    updatedAt: Date.now(),
  }
}

function readClientSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(CLIENT_SETTINGS_KEY) || '{}')
    return { ...defaultClientSettings(), ...raw, deviceType: window.LanShareDevice?.normalizeDeviceType?.(raw.deviceType || defaultClientSettings().deviceType) }
  } catch {
    return defaultClientSettings()
  }
}

function writeClientSettings(patch) {
  const next = {
    ...readClientSettings(),
    ...patch,
    deviceName: String(patch.deviceName ?? readClientSettings().deviceName ?? '').slice(0, 32),
    deviceType: window.LanShareDevice?.normalizeDeviceType?.(patch.deviceType || readClientSettings().deviceType),
    updatedAt: Date.now(),
  }
  localStorage.setItem(CLIENT_SETTINGS_KEY, JSON.stringify(next))
  return next
}

function clientDeviceName() {
  const s = readClientSettings()
  if (s.deviceName.trim()) return s.deviceName.trim()
  const type = window.LanShareDevice?.deviceMeta?.(s.deviceType)?.label || '设备'
  return `我的${type}`
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
  const client = readClientSettings()
  $('#set-device-name') && ($('#set-device-name').value = client.deviceName)
  $('#set-device-type') && ($('#set-device-type').value = client.deviceType)
  $('#set-auto-save') && ($('#set-auto-save').checked = client.autoSaveIncoming)
  $('#set-quick-connect') && ($('#set-quick-connect').checked = client.quickConnect)

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
  }).catch(() => {})
}

async function saveAllSettings() {
  const client = writeClientSettings({
    deviceName: $('#set-device-name')?.value?.trim() || '',
    deviceType: $('#set-device-type')?.value || readClientSettings().deviceType,
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
}
