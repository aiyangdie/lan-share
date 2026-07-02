# LanShare 版本管理与 Git 留痕

## Git 已安装

本机 Portable Git：

```
C:\Users\aike1\Documents\_dev_tools\PortableGit\bin\git.exe
```

建议把该目录加入系统 PATH，或在项目里用脚本 `scripts/git.ps1`。

## 版本号规则

| 文件 | 说明 |
|------|------|
| `VERSION` | **唯一真相源**，格式 `major.minor.micro` |
| 示例 | `1.5.000` → `1.5.001` → … → `1.5.010` |

- **每改一次代码并留痕**：micro **+1**（用户感知 **+0.001**）
- **改 10 次**：`1.5.000` → `1.5.010`（**+0.01**）
- **Android versionCode**：`major×1000000 + minor×1000 + micro`

## 标准工作流（每次改代码）

```powershell
cd "D:\09_开发项目\全栈文件夹-归档\tools\lan-share"

# 1. 改代码 …

# 2. 升版本 + 写 changelog（一条命令）
node scripts/bump-version.mjs "修复 xxx / 新增 xxx"

# 3. 同步到 APK、package.json、version.js
node scripts/sync-version.mjs
node scripts/sync-mobile.mjs    # 若改了 mobile-app/

# 4. Git 提交（一次修改 = 一次 commit）
.\scripts\git.ps1 add -A
.\scripts\git.ps1 commit -m "v1.5.001: 修复 xxx"

# 5. 推送到 GitHub（需网络 / FastGithub）
.\scripts\git.ps1 push origin main
```

或使用一键脚本：

```powershell
.\scripts\commit-release.ps1 "修复手机端删除 404"
```

## 留痕写在哪里

| 位置 | 内容 |
|------|------|
| **GitHub Commits** | 每次 commit 消息 `v1.5.001: 说明` |
| `docs/changelog.json` | 机器可读，官网「更新足迹」加载 |
| `CHANGELOG.md` | 人类可读摘要 |
| `docs/releases.json` | 大版本下载页（发 Release 时更新） |
| 官网 | https://aiyangdie.github.io/lan-share/ `#changelog` |

## 大版本发 Release（可选）

小步快跑用 micro 即可；打包 APK/zip 时可在 `docs/releases.json` 更新 `latest`，并打 Git tag：

```powershell
.\scripts\git.ps1 tag v1.5.010
.\scripts\git.ps1 push origin v1.5.010
```

## 三端版本一致

| 端 | 同步方式 |
|----|----------|
| 服务端 | `package.json` ← sync-version |
| Android APK | `build.gradle` + `assets/mobile/version.js` |
| 官网 | `docs/changelog.json` + `docs/releases.json` |
| 电脑 Electron | `desktop/package.json` |
