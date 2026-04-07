# Formatica APK Auto-Installer
# This script downloads the latest APK from GitHub Actions and installs it on your device

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Formatica APK Auto-Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$repo = "editorav010-dev/mediadoc-studio"
$deviceId = "W49T89KZU8M7H6AA"
$downloadDir = "$env:USERPROFILE\Downloads\Formatica-APK"
$artifactName = "Formatica-Android-Release-APKs"

# Step 1: Check ADB connection
Write-Host "[1/6] Checking ADB connection..." -ForegroundColor Yellow
$adbOutput = & adb devices 2>&1
if ($LASTEXITCODE -ne 0 -or $adbOutput -notmatch $deviceId) {
    Write-Host "ERROR: Device $deviceId not connected!" -ForegroundColor Red
    Write-Host "Please connect your Realme device and try again." -ForegroundColor Red
    Write-Host ""
    Write-Host "Current devices:" -ForegroundColor Yellow
    Write-Host $adbOutput -ForegroundColor Gray
    exit 1
}
Write-Host "✓ Device connected: $deviceId" -ForegroundColor Green
Write-Host ""

# Step 2: Get latest successful workflow run
Write-Host "[2/6] Finding latest successful build..." -ForegroundColor Yellow
$runsUrl = "https://api.github.com/repos/$repo/actions/runs?status=success&per_page=5"
$headers = @{
    "Accept" = "application/vnd.github.v3+json"
}

try {
    $response = Invoke-RestMethod -Uri $runsUrl -Headers $headers -UseBasicParsing
    if ($response.workflow_runs.Count -eq 0) {
        Write-Host "ERROR: No successful workflow runs found!" -ForegroundColor Red
        exit 1
    }
    
    $latestRun = $response.workflow_runs[0]
    $runId = $latestRun.id
    $runDate = $latestRun.created_at
    Write-Host "✓ Found successful build: Run #$runId" -ForegroundColor Green
    Write-Host "  Date: $runDate" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Failed to fetch workflow runs: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Get artifacts for this run
Write-Host "[3/6] Getting APK artifacts..." -ForegroundColor Yellow
$artifactsUrl = "https://api.github.com/repos/$repo/actions/runs/$runId/artifacts"

try {
    $artifactsResponse = Invoke-RestMethod -Uri $artifactsUrl -Headers $headers -UseBasicParsing
    
    if ($artifactsResponse.artifacts.Count -eq 0) {
        Write-Host "ERROR: No artifacts found for this build!" -ForegroundColor Red
        Write-Host "The build may have expired (artifacts expire after 30 days)" -ForegroundColor Yellow
        exit 1
    }
    
    $apkArtifact = $artifactsResponse.artifacts | Where-Object { $_.name -eq $artifactName }
    
    if (-not $apkArtifact) {
        Write-Host "ERROR: APK artifact not found!" -ForegroundColor Red
        Write-Host "Available artifacts:" -ForegroundColor Yellow
        $artifactsResponse.artifacts | ForEach-Object { Write-Host "  - $($_.name)" -ForegroundColor Gray }
        exit 1
    }
    
    $downloadUrl = $apkArtifact.archive_download_url
    Write-Host "✓ Found APK artifact: $artifactName" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round($apkArtifact.size_in_bytes / 1MB, 2)) MB" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Failed to get artifacts: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Download APK
Write-Host "[4/6] Downloading APK..." -ForegroundColor Yellow

# Create download directory
if (-not (Test-Path $downloadDir)) {
    New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
}

$zipFile = "$downloadDir\$artifactName.zip"

# Download with progress
try {
    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add("Accept", "application/vnd.github.v3+json")
    
    # Use Invoke-WebRequest for better progress
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile -Headers $headers -UseBasicParsing
    
    Write-Host "✓ Downloaded: $zipFile" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round((Get-Item $zipFile).Length / 1MB, 2)) MB" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Failed to download APK: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Extract APK
Write-Host "[5/6] Extracting APK..." -ForegroundColor Yellow

$extractDir = "$downloadDir\extracted"
if (Test-Path $extractDir) {
    Remove-Item -Path $extractDir -Recurse -Force
}

try {
    Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force
    Write-Host "✓ Extracted to: $extractDir" -ForegroundColor Green
    
    # Find the arm64 APK
    $arm64Apk = Get-ChildItem -Path $extractDir -Filter "app-arm64-v8a-release.apk" -Recurse | Select-Object -First 1
    
    if (-not $arm64Apk) {
        Write-Host "ERROR: app-arm64-v8a-release.apk not found!" -ForegroundColor Red
        Write-Host "Available files:" -ForegroundColor Yellow
        Get-ChildItem -Path $extractDir -Filter "*.apk" -Recurse | ForEach-Object {
            Write-Host "  - $($_.Name)" -ForegroundColor Gray
        }
        exit 1
    }
    
    Write-Host "✓ Found: $($arm64Apk.Name)" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round($arm64Apk.Length / 1MB, 2)) MB" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Failed to extract APK: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Install on device
Write-Host "[6/6] Installing APK on device..." -ForegroundColor Yellow

# Uninstall old version
Write-Host "  Removing old version..." -ForegroundColor Gray
& adb -s $deviceId uninstall com.formatica.formatica_mobile 2>&1 | Out-Null

# Install new version
Write-Host "  Installing new version..." -ForegroundColor Gray
$installOutput = & adb -s $deviceId install -r $arm64Apk.FullName 2>&1

if ($installOutput -match "Success") {
    Write-Host "✓ Installation successful!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Installation failed!" -ForegroundColor Red
    Write-Host $installOutput -ForegroundColor Red
    exit 1
}
Write-Host ""

# Launch app
Write-Host "Launching app..." -ForegroundColor Yellow
& adb -s $deviceId shell monkey -p com.formatica.formatica_mobile 1 2>&1 | Out-Null
Write-Host "✓ App launched!" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "APK Location: $($arm64Apk.FullName)" -ForegroundColor White
Write-Host "Device: $deviceId" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Check your Realme device for the Formatica app" -ForegroundColor White
Write-Host "  2. Test all 9 tools" -ForegroundColor White
Write-Host "  3. Report any issues" -ForegroundColor White
Write-Host ""
