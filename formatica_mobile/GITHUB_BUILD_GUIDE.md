# GitHub Actions Build Guide - Formatica Mobile

## Overview
This guide provides complete instructions for building your Flutter Android APK using GitHub Actions, bypassing local memory constraints.

---

## Prerequisites

### 1. GitHub Repository Setup
Your code must be pushed to a GitHub repository. If not already done:

```powershell
# Navigate to your project
cd c:\Users\avspn\mediadoc-studio

# Initialize git (if not already done)
git init

# Add remote repository (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Add all files
git add .

# Commit
git commit -m "Initial commit with GitHub Actions workflow"

# Push to GitHub
git push -u origin main
```

### 2. Required Files
The following file has been created for you:
- `.github/workflows/build-android.yml` - The GitHub Actions workflow configuration

---

## Method 1: Manual Trigger (Recommended for Testing)

### Step-by-Step Instructions

#### Step 1: Push Workflow to GitHub
```powershell
cd c:\Users\avspn\mediadoc-studio
git add .github/workflows/build-android.yml
git commit -m "Add GitHub Actions Android build workflow"
git push origin main
```

#### Step 2: Trigger Build via GitHub Web Interface

1. **Go to your GitHub repository**
   - URL: `https://github.com/YOUR_USERNAME/YOUR_REPO`

2. **Navigate to Actions tab**
   - Click on "Actions" in the top menu

3. **Select the workflow**
   - Click on "Build Formatica Android APK" in the left sidebar

4. **Run workflow**
   - Click the "Run workflow" dropdown button (top-right)
   - Configure options:
     - **Branch:** `main`
     - **Build type:** `release` (recommended)
     - **Split per ABI:** `true` (recommended - creates smaller APKs)
   - Click "Run workflow"

5. **Monitor the build**
   - Click on the running workflow
   - Click on "Build Android APK" job
   - Watch the logs in real-time
   - Build typically takes **5-10 minutes**

#### Step 3: Download the APK

Once the build completes successfully:

1. **From the workflow run page:**
   - Scroll down to "Artifacts" section
   - Click on the artifact name:
     - `Formatica-Android-Release-APKs` (if split per ABI)
     - `Formatica-Android-Universal-Release` (if universal)
   
2. **Download the ZIP file**
   - Extract to get your APK(s)

3. **For split APKs, choose the right one for your device:**
   - `app-arm64-v8a-release.apk` ← **Use this for your Realme RMX3998**
   - `app-armeabi-v7a-release.apk` - For older 32-bit devices
   - `app-x86_64-release.apk` - For emulators

---

## Method 2: Automatic Build on Tag Push (For Releases)

### Step 1: Create a Release Tag

```powershell
cd c:\Users\avspn\mediadoc-studio

# Create a tag (e.g., v2.0.0)
git tag -a v2.0.0 -m "Release version 2.0.0"

# Push tag to GitHub
git push origin v2.0.0
```

### Step 2: Automatic Build & Release

The workflow will:
1. Automatically trigger when you push a tag starting with `v`
2. Build the APK
3. Create a GitHub Release with the APK attached
4. Generate release notes automatically

### Step 3: Download from Releases

1. Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/releases`
2. Find your release (e.g., v2.0.0)
3. Download the APK(s) from the "Assets" section

---

## Method 3: Automatic Build on Every Push to Main

The workflow is configured to build automatically when you push to the `main` branch and modify files in `formatica_mobile/**`.

**Note:** This may use up your GitHub Actions minutes quickly. To disable:
- Edit `.github/workflows/build-android.yml`
- Remove or comment out lines 22-25:
  ```yaml
  # branches:
  #   - main
  # paths:
  #   - 'formatica_mobile/**'
  ```

---

## Installing the APK on Your Device

### Option A: Via ADB (Recommended)

```powershell
# Navigate to downloaded APK location
cd C:\Users\avspn\Downloads

# Install on your connected device
adb -s W49T89KZU8M7H6AA install -r app-arm64-v8a-release.apk

# Launch the app
adb -s W49T89KZU8M7H6AA shell monkey -p com.yourpackage.formatica 1
```

### Option B: Manual Installation

1. Transfer APK to your phone (via USB, email, cloud storage, etc.)
2. On your phone, enable "Install from Unknown Sources"
   - Settings → Security → Install unknown apps → Allow
3. Open the APK file and tap "Install"

### Option C: Direct via GitHub (Easiest)

1. Open the GitHub release page on your phone's browser
2. Tap the APK download link
3. Install when prompted

---

## Testing All 9 Tools

After installation, test these features:

### 1. Document Convert (Pandoc)
- Open app → Tap "Document Convert"
- Verify: Engine status shows "Preparing Document Engine" → "Document Engine Ready"
- Select a DOCX/TXT/MD file
- Choose output format (PDF, HTML, etc.)
- Tap "Convert Now"
- Verify: Conversion completes successfully

### 2. Video Compress
- Open app → Tap "Compress Video"
- Select a video file
- Choose quality preset
- Start compression
- Verify: Output file is smaller

### 3. Video Convert
- Open app → Tap "Convert Video"
- Select video file
- Choose output format (MP4, AVI, etc.)
- Start conversion
- Verify: Output plays correctly

### 4. Extract Audio
- Open app → Tap "Extract Audio"
- Select video file
- Choose audio format (MP3, AAC, etc.)
- Start extraction
- Verify: Audio file plays

### 5. Image Convert
- Open app → Tap "Convert Image"
- Select image(s)
- Choose output format (PNG, JPG, WEBP)
- Start conversion
- Verify: Output images open correctly

### 6. Images to PDF
- Open app → Tap "Images to PDF"
- Select multiple images
- Arrange order
- Generate PDF
- Verify: PDF opens with all images

### 7. Merge PDF
- Open app → Tap "Merge PDF"
- Select multiple PDF files
- Arrange order
- Merge
- Verify: Single PDF with all pages

### 8. Split PDF
- Open app → Tap "Split PDF"
- Select PDF file
- Choose split range/pages
- Split
- Verify: Multiple PDFs created

### 9. Greyscale PDF
- Open app → Tap "Greyscale PDF"
- Select PDF file
- Convert
- Verify: Output PDF is in greyscale

---

## Troubleshooting

### Build Fails in GitHub Actions

#### Error: "Flutter version mismatch"
**Solution:** Update the workflow file:
```yaml
flutter-version: '3.41.4'  # Match your local version
```

#### Error: "Dependencies not found"
**Solution:** Ensure `pubspec.yaml` is committed:
```powershell
git add formatica_mobile/pubspec.yaml
git commit -m "Update pubspec.yaml"
git push origin main
```

#### Error: "Gradle build failed"
**Solution:** Check the logs for specific errors. Common fixes:
- Update `android/gradle.properties` (already configured)
- Ensure all Android permissions are set in `AndroidManifest.xml`

#### Error: "No APK found"
**Solution:** Check if build actually succeeded. Look for errors in logs.

### Build Succeeds But APK Won't Install

#### Error: "App not installed"
**Possible causes:**
1. **Conflicting version already installed**
   - Uninstall old version first: `adb uninstall com.yourpackage.formatica`
   
2. **Wrong ABI for device**
   - Use `app-arm64-v8a-release.apk` for modern phones
   
3. **Unknown sources not enabled**
   - Enable in phone settings

#### Error: "Parse error"
**Solution:** APK may be corrupted. Re-download from GitHub.

### App Crashes on Launch

1. **Check logs via ADB:**
   ```powershell
   adb -s W49T89KZU8M7H6AA logcat | findstr "flutter"
   ```

2. **Common issues:**
   - Missing permissions → Check `AndroidManifest.xml`
   - WebView/Pandoc errors → Check `bridge.html` and assets
   - File access errors → Check storage permissions

---

## GitHub Actions Usage & Limits

### Free Tier Limits (GitHub Free Account)
- **2,000 minutes/month** for public repositories
- **500 MB** artifact storage
- Artifacts auto-delete after retention period (30 days configured)

### Monitoring Usage
1. Go to: `https://github.com/settings/billing`
2. Check "Actions" section
3. View minutes used this month

### Reducing Build Time
- Use `split-per-abi` (faster than universal)
- Disable automatic builds on push (use manual triggers only)
- Cache Flutter dependencies (already configured)

---

## Advanced Configuration

### Custom Build Settings

Edit `.github/workflows/build-android.yml` to customize:

#### Change Flutter Version
```yaml
- name: Setup Flutter
  uses: subosito/flutter-action@v2
  with:
    flutter-version: '3.41.4'  # Change this
```

#### Add Code Signing (for production releases)
```yaml
- name: Decode Keystore
  run: echo "${{ secrets.KEYSTORE_FILE }}" | base64 --decode > android/app/key.jks

- name: Build Signed APK
  run: flutter build apk --release
  env:
    KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
    KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
    KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
```

#### Add Firebase App Distribution
```yaml
- name: Distribute to Firebase
  uses: wzieba/Firebase-Distribution-Github-Action@v1
  with:
    appId: ${{ secrets.FIREBASE_APP_ID }}
    token: ${{ secrets.FIREBASE_TOKEN }}
    file: build/app/outputs/flutter-apk/app-release.apk
    groups: testers
```

---

## Quick Reference Commands

### Local Git Commands
```powershell
# Check status
git status

# Add all changes
git add .

# Commit
git commit -m "Your message"

# Push to GitHub
git push origin main

# Create release tag
git tag -a v2.0.0 -m "Release v2.0.0"
git push origin v2.0.0
```

### ADB Commands for Testing
```powershell
# List connected devices
adb devices

# Install APK
adb -s W49T89KZU8M7H6AA install -r app-arm64-v8a-release.apk

# Uninstall app
adb -s W49T89KZU8M7H6AA uninstall com.yourpackage.formatica

# View logs
adb -s W49T89KZU8M7H6AA logcat

# Clear app data
adb -s W49T89KZU8M7H6AA shell pm clear com.yourpackage.formatica
```

---

## Next Steps After Successful Build

1. ✅ **Test all 9 tools** on your Realme device
2. ✅ **Report any bugs** or issues
3. ✅ **Create a release** on GitHub for distribution
4. ✅ **Set up automatic builds** for future updates
5. ✅ **Consider publishing** to Google Play Store (requires signing setup)

---

## Support & Resources

- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **Flutter Build Docs:** https://docs.flutter.dev/deployment/android
- **GitHub Actions Marketplace:** https://github.com/marketplace?type=actions
- **Formatica Issues:** https://github.com/YOUR_USERNAME/YOUR_REPO/issues

---

## File Locations Summary

| File | Purpose |
|------|---------|
| `.github/workflows/build-android.yml` | GitHub Actions build configuration |
| `formatica_mobile/pubspec.yaml` | Flutter dependencies & config |
| `formatica_mobile/android/app/src/main/AndroidManifest.xml` | Android permissions |
| `formatica_mobile/android/gradle.properties` | Gradle memory settings |
| `formatica_mobile/lib/services/pandoc_bridge.dart` | Pandoc integration |
| `formatica_mobile/lib/widgets/pandoc_bridge_view.dart` | WebView bridge |
| `formatica_mobile/assets/pandoc/` | Pandoc WASM assets |

---

**Last Updated:** April 6, 2026  
**Workflow Version:** 1.0.0
