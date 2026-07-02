# 版本归档说明

**原则：只增不删。** 每次发版复制到 `archive/vX.Y.Z/`，旧版本永久保留，方便回滚。

## 版本列表

| 版本 | 日期 | 说明 | 路径 |
|------|------|------|------|
| v0.9.0-beta | 2026-06-25 | 内测：深色 UI、`电脑互传.bat` | [archive/v0.9.0-beta/](archive/v0.9.0-beta/) |
| v1.0.0 | 2026-06-25 | 开源首版：浅色 UI、PWA、多平台 zip | [archive/v1.0.0/](archive/v1.0.0/) |
| **v1.1.0** | 2026-06-25 | **当前**：Windows 便携 exe、版本统一、归档机制 | [archive/v1.1.0/](archive/v1.1.0/) |

## 回滚示例

```bash
# 回滚 Android APK 到 v1.0.0
adb install -r releases/archive/v1.0.0/lan-share-v1.0.0-android.apk

# 回滚 Windows 服务
# 解压 releases/archive/v1.0.0/lan-share-v1.0.0-server-windows-x64.zip
```

## 发版检查清单

- [ ] 修改 `VERSION` 文件
- [ ] 更新 `CHANGELOG.md`
- [ ] `npm run build:release`
- [ ] 确认 `releases/archive/vX.Y.Z/` 已生成
- [ ] APK 与网页 UI 一致（`npm run sync` 自动处理）
- [ ] Git tag + GitHub Releases 上传

## 版本号同步位置

`VERSION` → `package.json` → `server` API → `android versionCode` → `mobile version.js`
