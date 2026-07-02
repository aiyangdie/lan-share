# LanShare Git 包装器（使用 Portable Git）
$GitExe = "C:\Users\aike1\Documents\_dev_tools\PortableGit\bin\git.exe"
$Repo = "D:/09_开发项目/全栈文件夹-归档/tools/lan-share"
if (-not (Test-Path $GitExe)) {
  Write-Error "未找到 Git: $GitExe"
  exit 1
}
& $GitExe -c "safe.directory=$Repo" -C $Repo @args
