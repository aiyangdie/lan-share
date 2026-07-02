# 版本归档说明

**原则：只增不删。** 每次发版复制到 `archive/vX.Y.Z/`，旧版本永久保留，方便回滚。

## 版本列表

| 版本 | 日期 | 说明 | 路径 |
|------|------|------|------|
| v0.9.0-beta | 2026-06-25 | 内测：深色 UI、`电脑互传.bat` | [archive/v0.9.0-beta/](archive/v0.9.0-beta/) |
| v1.0.0 | 2026-06-25 | 开源首版：浅色 UI、PWA、多平台 zip | [archive/v1.0.0/](archive/v1.0.0/) |
| v1.1.0 | 2026-06-25 | Windows 便携 exe、版本统一 | [archive/v1.1.0/](archive/v1.1.0/) |
| v1.2.0 | 2026-07-02 | UDP 自动发现、官网 | GitHub Release |
| **v1.5.001** | 2026-07-02 | **当前**：综合修复、运营后台、Electron 设置、全平台安装包 | [archive/v1.5.001/](archive/v1.5.001/) · [GitHub Release](https://github.com/aiyangdie/lan-share/releases/tag/v1.5.001) |

## 发版命令

```bash
node scripts/build-release.mjs    # 本地打包全部安装包
node scripts/publish-release.mjs  # 打 tag + 上传 GitHub Release
```

## 回滚示例

```bash
adb install -r releases/archive/v1.0.0/lan-share-v1.0.0-android.apk
```

## 版本号同步位置

`VERSION` → `package.json` → `server` API → `android versionCode` → `mobile version.js` → `admin/config.json`
