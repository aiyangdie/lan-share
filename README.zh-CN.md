<p align="center">
  <img src="public/icons/icon.svg" width="80" alt="LanShare">
</p>

<h1 align="center">LanShare · 电脑互传</h1>

<p align="center">
  <strong>手机和电脑在同一 WiFi 下互传文件</strong><br>
  无需云盘 · 无需账号 · 开源免费
</p>

<p align="center">
  <a href="https://aiyangdie.github.io/lan-share/">官网</a> ·
  <a href="#下载">下载</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="README.md">English</a>
</p>

---

## 下载安装包

官网：[https://aiyangdie.github.io/lan-share/](https://aiyangdie.github.io/lan-share/)

| 平台 | 安装包 | 说明 |
|------|--------|------|
| 🤖 **Android** | [GitHub Releases](https://github.com/aiyangdie/lan-share/releases) | 安装后自动搜索附近电脑 |
| 🪟 **Windows 电脑** | `lan-share-v1.2.0-windows-portable.zip` | 解压双击 **LanShare.exe** 启动 |
| 🍎 **macOS / Linux** | 源码 `npm start` 或 release 脚本打包 | 运行 `start-server.sh` |

## 快速开始

### 1. 电脑端

解压 Windows 便携包，双击 **`LanShare.exe`**（约 20KB 启动器，自动打开浏览器）

### 2. 手机端

- **Android**：安装 APK → 打开应用 → **自动发现附近电脑** → 点击连接
- **浏览器 / iPhone**：电脑启动服务后，Safari 打开 `http://电脑IP:8787`

### 3. 传文件

| 功能 | 说明 |
|------|------|
| 上传 | 手机文件 → 电脑 `uploads/` |
| 浏览 | 查看已上传文件 |
| 共享 | 下载电脑 `shared/` 里的文件 |

## v1.2 新特性

- UDP 广播 + 局域网扫描，手机自动发现电脑
- 连接失败时显示排查指引
- Windows 启动器自动打开网页控制台
- [官网](https://aiyangdie.github.io/lan-share/) 与 GitHub Pages

## 连接不上？

1. 电脑已运行 LanShare（不要关闭窗口）
2. 手机和电脑 **同一 WiFi**
3. Windows 防火墙允许 **8787** 端口
4. 关闭 VPN 后重试

## 自行打包

```bash
npm install
npm run sync
npm run build:release    # 打包全部安装包
npm run build:exe        # 仅 Windows 便携包
npm run build:apk        # 仅 Android APK
```

## 作者

[aiyangdie](https://github.com/aiyangdie) · aike1015@qq.com

## 开源协议

[MIT](LICENSE) — 可自由使用、修改、商用。
