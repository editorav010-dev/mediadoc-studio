# Simple APK Downloader - No device check required
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Formatica APK Downloader" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$downloadDir = "$env:USERPROFILE\Downloads\Formatica-APK"

# Step 1: Get latest successful workflow
Write-Host "[1/3] Finding latest successful build..." -ForegroundColor Yellow
$runs = Invoke-RestMethod -Uri "https://api.github.com/repos/editorav010-dev/mediadoc-studio/actions/runs?status=success&per_page=3" -UseBasicParsing
$runId = $runs.workflow_runs[0].id
Write-Host "✓ Run ID: $runId" -ForegroundColor Green

# Step 2: Get artifacts
Write-Host "[2/3] Getting APK artifacts..." -ForegroundColor Yellow
$artifacts = Invoke-RestMethod -Uri "https://api.github.com/repos/editorav010-dev/mediadoc-studio/actions/runs/$runId/artifacts" -UseBasicParsing
$apkArtifact = $artifacts.artifacts | Where-Object { $_.name -eq "Formatica-Android-Release-APKs" }

if (-not $apkArtifact) {
    Write-Host "ERROR: APK artifact not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found: $($apkArtifact.name)" -ForegroundColor Green

# Step 3: Download
Write-Host "[3/3] Downloading..." -ForegroundColor Yellow

if (-not (Test-Path $downloadDir)) {
    New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
}

$zipFile = "$downloadDir\Formatica-APKs.zip"
Invoke-WebRequest -Uri $apkArtifact.archive_download_url -OutFile $zipFile -UseBasicParsing

Write-Host "✓ Downloaded: $zipFile" -ForegroundColor Green
Write-Host ""

# Extract
$extractDir = "$downloadDir\extracted"
if (Test-Path $extractDir) { Remove-Item -Path $extractDir -Recurse -Force }
Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

Write-Host "✓ Extracted to: $extractDir" -ForegroundColor Green
Write-Host ""
Write-Host "APK Files:" -ForegroundColor Cyan
Get-ChildItem -Path $extractDir -Filter "*.apk" -Recurse | ForEach-Object {
    Write-Host "  📦 $($_.Name) ($([math]::Round($_.Length/1MB, 2)) MB)" -ForegroundColor White
}
Write-Host ""
Write-Host "To install on your device, run:" -ForegroundColor Yellow
Write-Host "  adb -s W49T89KZU8M7H6AA uninstall com.formatica.formatica_mobile" -ForegroundColor Gray
Write-Host "  adb -s W49T89KZU8M7H6AA install -r `"$extractDir\app-arm64-v8a-release.apk`"" -ForegroundColor Gray
Write-Host ""
