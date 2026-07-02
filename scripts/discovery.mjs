/**
 * LAN discovery: UDP broadcast + subnet health probe
 */
import dgram from 'node:dgram'
import http from 'node:http'
import os from 'node:os'

export const DISCOVERY_PORT = 38787
export const MAGIC = 'lanshare'

export function startDiscovery({ port, version, getIp }) {
  const peers = new Map()
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

  socket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString())
      if (data.type !== MAGIC || !data.ip) return
      peers.set(data.ip, { ...data, seenAt: Date.now() })
    } catch { /* ignore */ }
  })

  socket.on('error', (err) => {
    console.warn('  discovery UDP:', err.message)
  })

  socket.bind(DISCOVERY_PORT, () => {
    try { socket.setBroadcast(true) } catch { /* ignore */ }
    const tick = () => {
      const ip = getIp()
      const payload = Buffer.from(JSON.stringify({
        type: MAGIC,
        version,
        port,
        ip,
        hostname: os.hostname(),
      }))
      try { socket.send(payload, 0, payload.length, DISCOVERY_PORT, '255.255.255.255') } catch { /* ignore */ }
      const parts = ip.split('.')
      if (parts.length === 4 && parts[0] !== '127') {
        const bcast = `${parts[0]}.${parts[1]}.${parts[2]}.255`
        try { socket.send(payload, 0, payload.length, DISCOVERY_PORT, bcast) } catch { /* ignore */ }
      }
    }
    tick()
    setInterval(tick, 3000)
  })

  return {
    getPeers(maxAgeMs = 30000) {
      const now = Date.now()
      return [...peers.values()].filter((p) => now - p.seenAt < maxAgeMs)
    },
    close() { socket.close() },
  }
}

export function probeHealth(ip, port = 8787, timeoutMs = 900) {
  return new Promise((resolve) => {
    const req = http.get(`http://${ip}:${port}/api/health`, { timeout: timeoutMs }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          if (j.ok && j.name === 'lan-share') {
            resolve({
              ip: j.ip || ip,
              port: j.port || port,
              version: j.version,
              hostname: j.hostname || ip,
            })
          } else resolve(null)
        } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

export async function scanSubnet(baseIp, port = 8787, timeoutMs = 900) {
  const parts = String(baseIp).split('.')
  if (parts.length !== 4) return []
  const base = `${parts[0]}.${parts[1]}.${parts[2]}`
  const found = new Map()
  const batch = 32
  for (let start = 1; start < 255; start += batch) {
    const jobs = []
    for (let i = start; i < Math.min(start + batch, 255); i++) {
      jobs.push(probeHealth(`${base}.${i}`, port, timeoutMs))
    }
    const results = await Promise.all(jobs)
    for (const r of results) {
      if (r) found.set(r.ip, r)
    }
  }
  return [...found.values()]
}
