# Changelog

All notable changes are documented here. **Old release packages are kept in `releases/archive/`.**

## [1.1.0] - 2026-06-25

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
