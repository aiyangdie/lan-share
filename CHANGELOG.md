# Changelog

All notable changes are documented here. **Old release packages are kept in `releases/archive/`.**

## 细粒度更新留痕

- **1.5.005** (2026-07-02) — 性能优化、已下载标记、完整路径、简洁传输条 UI

- **1.5.004** (2026-07-02) — 主界面本机↔对方关系条，可切换对端设备

- **1.5.003** (2026-07-02) — 设备品牌识别、类型自动匹配、全平台安装包优化

- **1.5.002** (2026-07-02) — v1.6 系统设置：设备名/类型/路径/LocalSend风格UI

- **1.5.001** (2026-07-02) — 综合修复：IP/设置/发现/传输/同步/Electron重启/admin版本号

> 每次代码修改版本 **+0.001**（改 10 次 +0.01）。完整记录在 `docs/changelog.json` 与 [GitHub Commits](https://github.com/aiyangdie/lan-share/commits/main)。规范见 `VERSIONING.md`。

## [1.5.000] - 2026-07-02

### Added
- Electron 电脑端雏形（托盘、开机自启、React 设置窗）
- `server/settings-store.mjs` + `GET/PUT /api/settings`（路径、端口）
- 细粒度版本脚本 `bump-version.mjs`、官网「更新足迹」区块
- `VERSIONING.md` Git 留痕规范

### Includes (from 1.4.x)
- 运营后台 `/admin`：广告、公告、APK/EXE 在线更新
- 文件删除/清空、传输错误提示、共享自动保存

## [1.4.0] - 2026-07-02

### Added
- Single `VERSION` file as source of truth
- `releases/archive/vX.Y.Z/` — all versions preserved, never deleted
- `releases/VERSION_HISTORY.md` — version index and rollback guide
- Windows standalone `.exe` (double-click, no Node required)
- Version badge in mobile UI (APK + web unified)
- `scripts/sync-version.mjs` / `scripts/sync-mobile.mjs` — keep platforms in sync

### Fixed
- APK and web UI forced identical via sync script
- Android WebView compatibility (`touch-action`, safe-area)
- Server reads version from `package.json` (no hardcode drift)

### Archived
- v0.9.0-beta (internal beta APK)
- v1.0.0 (first open-source release)

## [1.0.0] - 2026-06-25

### Added
- LAN file transfer server (Node.js)
- Android APK (WebView shell)
- PWA support for iOS / browser
- Upload, browse, shared folder download
- Chinese filename mojibake fix
- Release packages: Windows zip, macOS zip, Linux tar.gz, Android APK
- MIT license

## [0.9.0-beta] - 2026-06-25

### Added
- Initial prototype (dark theme, `电脑互传.bat`, Chinese folder names)
- Basic upload / browse / download
