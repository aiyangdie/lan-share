# 一次修改 = bump + sync + git commit
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Message
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root '..')

$Node = "c:\Users\aike1\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe"
if (-not (Test-Path $Node)) { $Node = "node" }

& $Node scripts/bump-version.mjs $Message
& $Node scripts/sync-version.mjs
& $Node scripts/sync-mobile.mjs

$Ver = (Get-Content VERSION -Raw).Trim()
& (Join-Path $Root 'git.ps1') add VERSION package.json CHANGELOG.md docs/changelog.json docs/releases.json `
  mobile-app public android admin server desktop server.mjs scripts .gitignore VERSIONING.md 2>$null
& (Join-Path $Root 'git.ps1') add -u

$CommitMsg = "v${Ver}: $Message"
& (Join-Path $Root 'git.ps1') commit -m $CommitMsg
Write-Host ""
Write-Host "已提交: $CommitMsg"
Write-Host "推送: .\scripts\git.ps1 push origin main"
