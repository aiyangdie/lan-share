<p align="center">
  <img src="public/icons/icon.svg" width="80" alt="LanShare">
</p>

<h1 align="center">LanShare</h1>

<p align="center">
  <strong>Transfer files between your phone and PC over local WiFi</strong><br>
  No cloud · No account · Open source
</p>

<p align="center">
  <a href="#downloads">Downloads</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="README.zh-CN.md">中文</a> ·
  <a href="LICENSE">MIT License</a>
</p>

---

## Why LanShare?

- **Private** — files never leave your LAN
- **Simple** — one server on PC, one app on phone
- **Cross-platform** — Android APK, iOS PWA, any browser
- **Bidirectional** — upload from phone, browse PC folders

## Downloads

| Platform | Package | How to install |
|----------|---------|----------------|
| 🤖 **Android** | [`lan-share-v1.0.0-android.apk`](releases/lan-share-v1.0.0-android.apk) | Sideload APK |
| 🪟 **Windows** | [`server-windows-x64.zip`](releases/) | Unzip → `start-server.bat` |
| 🍎 **macOS** | [`server-macos.zip`](releases/) | Unzip → `./start-server.sh` |
| 🐧 **Linux** | [`server-linux-x64.tar.gz`](releases/) | Extract → `./start-server.sh` |
| 📱 **iPhone/iPad** | [PWA guide](releases/lan-share-v1.0.0-ios-pwa.txt) | Safari → Add to Home Screen |

> Upload packages to **GitHub Releases** for large binaries. See [`releases/README.md`](releases/README.md).

## Quick Start

### 1. Start PC server

**Windows** — double-click `start-server.bat`  
**macOS/Linux** — `./start-server.sh`  
**From source** — `npm install && npm start`

### 2. Connect phone

Open LanShare app (or browser) and enter:

```
http://YOUR_PC_IP:8787
```

Find your IP: `ipconfig` (Windows) / `ifconfig` (Mac/Linux)

### 3. Transfer files

| Tab | Action |
|-----|--------|
| **Upload** | Phone → PC `uploads/` folder |
| **Browse** | View uploaded files |
| **Shared** | Download from PC `shared/` folder |

## Project structure

```
lan-share/
├── server.mjs          # PC server (Node.js)
├── mobile-app/         # Web UI (also bundled in APK)
├── android/            # Android WebView shell
├── public/             # Static web + PWA
├── shared/             # Put files here for phone to download
├── uploads/            # Phone uploads land here
├── scripts/            # Build scripts
└── releases/           # Pre-built packages
```

## Build from source

```bash
# Server only
npm install
npm start

# All release packages (APK + server zips)
npm run build:release

# Android APK only (requires JDK 8 + Android SDK)
npm run build:apk
```

## Requirements

- **PC**: Node.js 18+ (bundled in release zips)
- **Phone**: Android 7+ (APK) or any modern browser (PWA)
- **Network**: Same WiFi / LAN

## Contributing

PRs welcome! See [issues](https://github.com/YOUR_USERNAME/lan-share/issues) for ideas.

## License

[MIT](LICENSE) — free for personal and commercial use.
