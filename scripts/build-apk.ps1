#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

function Ensure-Dir($p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}

function Download-IfMissing($url, $dest) {
  if (-not (Test-Path $dest)) {
    Write-Host "  download $([IO.Path]::GetFileName($dest))..."
    Invoke-WebRequest -Uri $url -OutFile $dest
  }
}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AndroidDir = Join-Path $Root 'android'
$Assets = Join-Path $AndroidDir 'app\src\main\assets\mobile'
$Dist = Join-Path $Root 'dist'
$SdkRoot = Join-Path $Root 'tools\android-sdk'
$GradleHome = Join-Path $Root 'tools\gradle-6.7.1'
$Cache = Join-Path $Root 'tools\cache'
$JavaHome = 'C:\Program Files\Eclipse Adoptium\jdk-8.0.492.9-hotspot'

if (Test-Path $JavaHome) {
  $env:JAVA_HOME = $JavaHome
  $env:Path = "$JavaHome\bin;" + $env:Path
}

Write-Host ''
Write-Host '=== Build LanShare APK ==='
Write-Host ''

Set-Location $Root
if (-not (Test-Path (Join-Path $Root 'node_modules\busboy'))) {
  Write-Host '[1/5] npm install...'
  npm install --silent | Out-Null
} else {
  Write-Host '[1/5] npm ok'
}

Write-Host '[2/5] copy mobile assets...'
if (Test-Path $Assets) { Remove-Item -Recurse -Force $Assets }
Ensure-Dir $Assets
Copy-Item -Recurse -Force (Join-Path $Root 'mobile-app\*') $Assets
Ensure-Dir (Join-Path $Root 'public')
Copy-Item -Recurse -Force (Join-Path $Root 'mobile-app\*') (Join-Path $Root 'public')

Write-Host '[3/5] android sdk...'
Ensure-Dir $SdkRoot
Ensure-Dir $Cache
Ensure-Dir (Join-Path $SdkRoot 'licenses')

$license1 = Join-Path $SdkRoot 'licenses\android-sdk-license'
if (-not (Test-Path $license1)) {
  '24333f8a63b6825ea9c5514f83c2829b00404719' | Set-Content $license1 -Encoding ASCII
  '84831b9409646a918e30573bab035c440a934904' | Set-Content (Join-Path $SdkRoot 'licenses\android-sdk-preview-license') -Encoding ASCII
}

$PtZip = Join-Path $Cache 'platform-tools.zip'
$BtZip = Join-Path $Cache 'build-tools-29.0.3.zip'
$PlZip = Join-Path $Cache 'platform-30.zip'

Download-IfMissing 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' $PtZip
Download-IfMissing 'https://dl.google.com/android/repository/build-tools_r29.0.3-windows.zip' $BtZip
Download-IfMissing 'https://dl.google.com/android/repository/platform-30_r03.zip' $PlZip

if (-not (Test-Path (Join-Path $SdkRoot 'platform-tools\adb.exe'))) {
  Expand-Archive -Path $PtZip -DestinationPath $SdkRoot -Force
}
if (-not (Test-Path (Join-Path $SdkRoot 'build-tools\29.0.3\aapt.exe'))) {
  Expand-Archive -Path $BtZip -DestinationPath $SdkRoot -Force
  $src = Join-Path $SdkRoot 'android-10'
  $dst = Join-Path $SdkRoot 'build-tools\29.0.3'
  if (Test-Path $src) {
    Ensure-Dir $dst
    Move-Item (Join-Path $src '*') $dst -Force
    Remove-Item -Recurse -Force $src
  }
}
if (-not (Test-Path (Join-Path $SdkRoot 'platforms\android-30\android.jar'))) {
  Expand-Archive -Path $PlZip -DestinationPath $SdkRoot -Force
  $platSrc = Join-Path $SdkRoot 'android-11'
  $platDst = Join-Path $SdkRoot 'platforms\android-30'
  Ensure-Dir $platDst
  if (Test-Path $platSrc) {
    Move-Item (Join-Path $platSrc '*') $platDst -Force
    Remove-Item -Recurse -Force $platSrc
  }
}

$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
("sdk.dir=" + ($SdkRoot -replace '\\','\\')) | Set-Content -Path (Join-Path $AndroidDir 'local.properties') -Encoding ASCII

Write-Host '[4/5] gradle...'
if (-not (Test-Path (Join-Path $GradleHome 'bin\gradle.bat'))) {
  $GradleZip = Join-Path $Cache 'gradle-6.7.1-bin.zip'
  Download-IfMissing 'https://services.gradle.org/distributions/gradle-6.7.1-bin.zip' $GradleZip
  Ensure-Dir (Join-Path $Root 'tools')
  Expand-Archive -Path $GradleZip -DestinationPath (Join-Path $Root 'tools') -Force
}

Write-Host '[5/5] assembleDebug...'
Set-Location $AndroidDir
& (Join-Path $GradleHome 'bin\gradle.bat') assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }

Ensure-Dir $Dist
$ApkSrc = Join-Path $AndroidDir 'app\build\outputs\apk\debug\app-debug.apk'
Copy-Item -Force $ApkSrc (Join-Path $Dist 'lanshare.apk')
Copy-Item -Force $ApkSrc (Join-Path $Dist '电脑互传.apk')

Write-Host ''
Write-Host 'DONE'
Write-Host "APK: $(Join-Path $Dist '电脑互传.apk')"
Write-Host ''
