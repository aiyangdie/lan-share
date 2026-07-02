import React, { useEffect, useState } from 'react'

const api = window.LanShareDesktop

export default function App() {
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api?.getSettings().then(setForm).catch(() => setMsg('无法读取设置'))
  }, [])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setMsg('')
    try {
      const res = await api.saveSettings(form)
      setMsg(res.restartRequired ? '已保存，服务已重启使端口/路径生效' : '已保存')
    } catch (e) {
      setMsg(e.message || '保存失败')
    }
    setSaving(false)
  }

  if (!form) {
    return <div className="wrap"><p className="muted">加载中…</p></div>
  }

  return (
    <div className="wrap">
      <header className="hero">
        <div className="logo">LS</div>
        <div>
          <h1>LanShare 设置</h1>
          <p>电脑端全自动运行，手机同一 WiFi 即可传文件</p>
        </div>
      </header>

      <section className="card">
        <h2>本机设备</h2>
        <label className="field">
          <span>设备名称（附近设备列表显示）</span>
          <input value={form.deviceName || ''} onChange={(e) => set('deviceName', e.target.value)} placeholder="例如：客厅电脑" />
        </label>
        <label className="field">
          <span>设备类型</span>
          <select value={form.deviceType || 'desktop'} onChange={(e) => set('deviceType', e.target.value)}>
            <option value="desktop">电脑</option>
          </select>
        </label>
        {(form.deviceBrand || form.deviceModel) && (
          <p className="muted">已识别：{[form.deviceBrand, form.deviceModel].filter(Boolean).join(' · ')}</p>
        )}
      </section>

      <section className="card">
        <h2>文件夹路径</h2>
        <label className="field">
          <span>手机上传保存到（uploads）</span>
          <input value={form.uploadDir} onChange={(e) => set('uploadDir', e.target.value)} />
        </label>
        <label className="field">
          <span>电脑共享给手机（shared）</span>
          <input value={form.sharedDir} onChange={(e) => set('sharedDir', e.target.value)} />
        </label>
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => api.openFolder(form.uploadDir)}>打开上传目录</button>
          <button type="button" className="btn ghost" onClick={() => api.openFolder(form.sharedDir)}>打开共享目录</button>
        </div>
      </section>

      <section className="card">
        <h2>网络</h2>
        <label className="field">
          <span>服务端口</span>
          <input type="number" min="1024" max="65535" value={form.port} onChange={(e) => set('port', Number(e.target.value))} />
        </label>
      </section>

      <section className="card">
        <h2>启动行为</h2>
        <label className="check"><input type="checkbox" checked={form.openAtLogin} onChange={(e) => set('openAtLogin', e.target.checked)} />开机自动启动（默认开启）</label>
        <label className="check"><input type="checkbox" checked={form.minimizeToTray} onChange={(e) => set('minimizeToTray', e.target.checked)} />关闭窗口后保留托盘运行</label>
        <label className="check"><input type="checkbox" checked={form.startMinimized} onChange={(e) => set('startMinimized', e.target.checked)} />启动时只显示托盘（不弹设置窗）</label>
        <label className="check"><input type="checkbox" checked={form.autoOpenBrowser} onChange={(e) => set('autoOpenBrowser', e.target.checked)} />启动后自动打开主界面</label>
      </section>

      <div className="actions">
        <button type="button" className="btn primary" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存设置'}</button>
        <button type="button" className="btn ghost" onClick={() => api.openMain()}>打开主界面</button>
      </div>
      {msg && <p className="msg">{msg}</p>}
      <p className="foot">运营后台：http://127.0.0.1:{form.port}/admin</p>
    </div>
  )
}
