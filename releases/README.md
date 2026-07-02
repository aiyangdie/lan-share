# Release Packages

## Latest: v1.1.0

| File | Platform | 说明 |
|------|----------|------|
| **`lan-share-v1.1.0-windows-portable.zip`** | **Windows** | 解压 → 双击 `LanShare.exe`，无需安装 Node |
| `lan-share-v1.1.0-android.apk` | Android | 侧载安装 |
| `lan-share-v1.1.0-server-windows-x64.zip` | Windows | 需 Node.js，zip 版 |
| `lan-share-v1.1.0-server-macos.zip` | macOS | 需 Node.js |
| `lan-share-v1.1.0-server-linux-x64.tar.gz` | Linux | 需 Node.js |
| `lan-share-v1.1.0-ios-pwa.txt` | iPhone/iPad | Safari 添加到主屏幕 |

## 版本归档（永不删除）

[`archive/`](archive/) · [`VERSION_HISTORY.md`](VERSION_HISTORY.md)

```
archive/
├── v0.9.0-beta/   内测版 APK
├── v1.0.0/        首个开源版
└── v1.1.0/        当前：便携 exe + 版本管理
```

## 发版

```bash
# 1. 修改 VERSION 文件
# 2. 更新 CHANGELOG.md
npm run build:release
# 3. 检查 releases/archive/vX.Y.Z/
```
