import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('LanShareDesktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  openFolder: (p) => ipcRenderer.invoke('app:openFolder', p),
  openMain: () => ipcRenderer.invoke('app:openMain'),
})
