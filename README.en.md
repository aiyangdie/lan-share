<h1 align="center">LanShare</h1>

<p align="center">
  Transfer files between phone and PC over local WiFi · No cloud · No account · MIT open source
</p>

<p align="center">
  <a href="https://aiyangdie.github.io/lan-share/"><strong>Website & Downloads</strong></a> ·
  <a href="https://github.com/aiyangdie/lan-share/releases">Releases</a> ·
  <a href="README.md">中文</a>
</p>

<p align="center">
  <a href="https://aiyangdie.github.io/lan-share/"><img src="https://img.shields.io/website?url=https%3A%2F%2Faiyangdie.github.io%2Flan-share%2F&label=website&style=flat-square" alt="website"></a>
  <a href="https://github.com/aiyangdie/lan-share/releases"><img src="https://img.shields.io/github/v/release/aiyangdie/lan-share?style=flat-square" alt="release"></a>
  <img src="https://img.shields.io/github/license/aiyangdie/lan-share?style=flat-square" alt="MIT">
</p>

<p align="center">
  <img src="docs/images/architecture.svg" alt="LanShare architecture" width="720">
</p>

---

## Download

👉 **https://aiyangdie.github.io/lan-share/**

| Platform | Notes |
|----------|-------|
| Windows | Unzip → run `LanShare.exe` → opens `http://127.0.0.1:8787/` |
| Android | Install APK → auto-discover PC on same WiFi (v1.2+) |
| iOS | Safari → `http://PC_IP:8787` → Add to Home Screen |

---

## Quick start

1. **PC** — Run LanShare (`npm start` or double-click exe)
2. **Phone** — Same WiFi as PC
3. **Transfer** — Upload to `uploads/`; put files in `shared/` for phone download

<p align="center">
  <img src="docs/images/flow-upload.svg" alt="File transfer flow" width="680">
</p>

---

## Mind map

```mermaid
mindmap
  root((LanShare v1.2))
    Product
      Phone PC transfer
      Same WiFi
      No account
      Local only
    PC side
      server.mjs 8787
      discovery UDP 38787
      shared folder
      uploads folder
      LanShare.exe
    Mobile
      mobile-app UI
      public static
      Android WebView
      DiscoveryBridge
    Distribution
      GitHub Pages
      GitHub Releases
    Build
      sync-version
      sync-mobile
      build-exe
      build-apk
      build-release
```

---

## Architecture

```mermaid
flowchart TB
  subgraph PC["PC :8787"]
    SRV["server.mjs"]
    UDP["discovery.mjs UDP :38787"]
    SHARED["shared/"]
    UPLOADS["uploads/"]
    SRV --> UDP
    SRV --> SHARED
    SRV --> UPLOADS
  end

  subgraph Client["Mobile"]
    UI["mobile-app/app.js"]
    APK["Android WebView"]
    BRIDGE["DiscoveryBridge.java"]
    APK --> UI
    APK --> BRIDGE
  end

  UI -->|"HTTP REST"| SRV
  BRIDGE -->|"UDP listen"| UDP
  BRIDGE -->|"HTTP probe"| SRV
```

---

## Source layout

```
lan-share/
├── server.mjs              # HTTP server
├── scripts/discovery.mjs   # UDP discovery + subnet scan
├── mobile-app/             # ★ UI source (edit here)
├── public/                 # synced for browser
├── android/                # WebView APK + native discovery
└── docs/                   # GitHub Pages site
```

---

## Discovery flow (v1.2+)

```mermaid
sequenceDiagram
  participant PC as server.mjs
  participant UDP as UDP :38787
  participant Phone as DiscoveryBridge
  participant UI as app.js

  PC->>UDP: Broadcast every 3s type=lanshare
  Phone->>UDP: Listen
  UDP->>Phone: peer packet
  Phone->>UI: __onLanShareDiscovered
  UI->>PC: GET /api/health fallback scan
```

---

## HTTP API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/discover/peers` | UDP-discovered peers |
| `GET` | `/api/discover/scan` | Active subnet scan |
| `GET` | `/api/browse/{root}/{path}` | List directory |
| `GET` | `/api/download/{root}?p=...` | Download file |
| `POST` | `/api/upload?target=&path=` | Upload file |

**Ports:** HTTP `8787` · UDP discovery `38787` · Magic string `lanshare`

---

## Development

```bash
npm install && npm start
npm run sync          # after editing mobile-app/
npm run build:release # full release build
```

---

## Open source

- **Repo:** https://github.com/aiyangdie/lan-share
- **License:** [MIT](LICENSE)
- **Author:** [aiyangdie](https://github.com/aiyangdie)

See [README.md](README.md) for the full Chinese documentation with all diagrams.
