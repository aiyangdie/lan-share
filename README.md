<p align="center"><img src="assets/covers/17-lan-share.jpg" alt="局域网快传 项目封面" width="100%"></p>

<h1 align="center">LanShare · 电脑手机互传</h1>

<p align="center">同一 WiFi 下互传文件，不要云盘、不要账号、MIT 开源</p>

<p align="center">
  <a href="https://aiyangdie.github.io/lan-share/">在线使用</a> ·
  <a href="LICENSE">MIT 许可</a>
</p>

## 简介

把手机和电脑拉到同一个局域网就能传文件：一端开页面，另一端扫码或输码，走局域网直连，不经过公网。适合临时传照片、文档、安装包，也能发文字。

## 功能

- **互传文件**：手机 ↔ 电脑双向传输，显示进度与速度
- **免账号**：打开网页即用，无需注册登录
- **自动发现**：同一网段自动找到对端（v1.2+）
- **文字与剪贴内容**：小段文字直接发，不用来回切应用
- **多端兼容**：手机、平板、电脑浏览器都可用，含 Android 原生层优化
- **构建发布**：自带打包与发布流水线

## 技术栈

前端 Web 应用（Vite 构建）｜ 传输走局域网 HTTP 接口 ｜ Android 端含原生层封装

## 快速开始

```bash
git clone https://github.com/aiyangdie/lan-share.git
cd lan-share
npm install
npm run dev
```

启动后在浏览器打开提示的地址，手机连同一 WiFi 访问即可。

## 项目结构

```
src/            前端源码（组件、传输逻辑）
android/        Android 原生层
docs/           架构图、流程图等说明
```

## HTTP 接口

仓库 README 原文附有接口清单、关键常量与数据目录说明，需要二次开发时可直接查阅源码内的接口定义。

## 许可证

[MIT](LICENSE)
