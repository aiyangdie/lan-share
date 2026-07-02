#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

function Ensure-Dir($p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}

function Download-IfMissing($url, $dest) {
  if (-not (Test-Path $dest)) {
    Write-Host "  download $([IO.Path]::GetFileName($dest))..."
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
  }
}

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AndroidDir = Join-Path $Root 'android'
$Assets = Join-Path $AndroidDir 'app\src\main\assets\mobile'
$Dist = Join-Path $Root 'dist'
$SdkRoot = Join-Path $Root 'tools\android-sdk'
$GradleHome = Join-Path $Root 'tools\gradle-7.6.4'
$Cache = Join-Path $Root 'tools\cache'

$JavaCandidates = @(
  'C:\Users\aike1\Documents\_dev_tools\jdk-17',
  $env:JAVA_HOME,
  'C:\Program Files\Eclipse Adoptium\jdk-17.0.14.7-hotspot',
  'C:\Program Files\Eclipse Adoptium\jdk-17.0.14+7'
)
foreach ($j in $JavaCandidates) {
  if ($j -and (Test-Path (Join-Path $j 'bin\java.exe'))) {
    $env:JAVA_HOME = $j
    $env:Path = "$j\bin;" + $env:Path
    break
  }
}
if (-not $env:JAVA_HOME) { throw '未找到 JDK 17，请安装或设置 JAVA_HOME' }

Write-Host ''
Write-Host '=== Build LanShare APK ==='
Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host ''

Set-Location $Root
$node = 'node'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $node = 'c:\Users\aike1\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe'
}

Write-Host '[1/6] sync assets...'
& $node scripts/sync-version.mjs
& $node scripts/generate-icons.mjs
& $node scripts/sync-mobile.mjs

if (-not (Test-Path (Join-Path $Root 'node_modules\busboy'))) {
  Write-Host '[2/6] npm install...'
  & $node (Join-Path $Root 'node_modules\npm\bin\npm-cli.js') install --omit=dev 2>$null
  if (-not (Test-Path (Join-Path $Root 'node_modules\busboy'))) {
    npm install --omit=dev | Out-Null
  }
} else {
  Write-Host '[2/6] npm ok'
}

Write-Host '[3/6] android sdk...'
Ensure-Dir $SdkRoot
Ensure-Dir $Cache
Ensure-Dir (Join-Path $SdkRoot 'licenses')

$license1 = Join-Path $SdkRoot 'licenses\android-sdk-license'
if (-not (Test-Path $license1)) {
  '24333f8a63b6825ea9c5514f83c2829b00404719' | Set-Content $license1 -Encoding ASCII
  '84831b9409646a918e30573bab035c440a934904' | Set-Content (Join-Path $SdkRoot 'licenses\android-sdk-preview-license') -Encoding ASCII
}

$PtZip = Join-Path $Cache 'platform-tools.zip'
$BtZip = Join-Path $Cache 'build-tools-33.0.2.zip'
$PlZip = Join-Path $Cache 'platform-33.zip'

Download-IfMissing 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' $PtZip
Download-IfMissing 'https://dl.google.com/android/repository/build-tools_r33.0.2-windows.zip' $BtZip
Download-IfMissing 'https://dl.google.com/android/repository/platform-33-ext3_r03.zip' $PlZip

if (-not (Test-Path (Join-Path $SdkRoot 'platform-tools\adb.exe'))) {
  Expand-Archive -Path $PtZip -DestinationPath $SdkRoot -Force
}
if (-not (Test-Path (Join-Path $SdkRoot 'build-tools\33.0.2\aapt.exe'))) {
  Expand-Archive -Path $BtZip -DestinationPath $SdkRoot -Force
}
if (-not (Test-Path (Join-Path $SdkRoot 'platforms\android-33\android.jar'))) {
  Expand-Archive -Path $PlZip -DestinationPath $SdkRoot -Force
  $platSrc = Join-Path $SdkRoot 'android-13'
  $platDst = Join-Path $SdkRoot 'platforms\android-33'
  Ensure-Dir $platDst
  if (Test-Path $platSrc) {
    Move-Item (Join-Path $platSrc '*') $platDst -Force
    Remove-Item -Recurse -Force $platSrc
  }
}

$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
("sdk.dir=" + ($SdkRoot -replace '\\','\\')) | Set-Content -Path (Join-Path $AndroidDir 'local.properties') -Encoding ASCII

Write-Host '[4/6] gradle...'
if (-not (Test-Path (Join-Path $GradleHome 'bin\gradle.bat'))) {
  $GradleZip = Join-Path $Cache 'gradle-7.6.4-bin.zip'
  Download-IfMissing 'https://services.gradle.org/distributions/gradle-7.6.4-bin.zip' $GradleZip
  Ensure-Dir (Join-Path $Root 'tools')
  Expand-Archive -Path $GradleZip -DestinationPath (Join-Path $Root 'tools') -Force
}

Write-Host '[5/6] assembleDebug...'
Set-Location $AndroidDir
& (Join-Path $GradleHome 'bin\gradle.bat') assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }

Write-Host '[6/6] copy apk...'
$version = (Get-Content (Join-Path $Root 'VERSION') -Raw).Trim()
$ApkSrc = Join-Path $AndroidDir 'app\build\outputs\apk\debug\app-debug.apk'
$ApkOut = Join-Path $Root "releases\lan-share-v$version-android.apk"
Ensure-Dir (Join-Path $Root 'releases')
Ensure-Dir $Dist
Copy-Item -Force $ApkSrc (Join-Path $Dist 'lanshare.apk')
Copy-Item -Force $ApkSrc (Join-Path $Dist '电脑互传.apk')
Copy-Item -Force $ApkSrc $ApkOut

Write-Host ''
Write-Host 'DONE'
Write-Host "APK: $ApkOut"
Write-Host "     $(Join-Path $Dist '电脑互传.apk')"
Write-Host ''
