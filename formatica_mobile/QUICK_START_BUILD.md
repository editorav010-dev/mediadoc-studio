# Quick Start: Build APK via GitHub Actions

## 🚀 Fast Track (5 Minutes)

### Step 1: Push Code to GitHub
```powershell
cd c:\Users\avspn\mediadoc-studio
git add .
git commit -m "Add GitHub Actions workflow"
git push origin main
```

### Step 2: Trigger Build
1. Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/actions`
2. Click **"Build Formatica Android APK"**
3. Click **"Run workflow"** → **"Run workflow"** button
4. Wait 5-10 minutes ⏱️

### Step 3: Download APK
1. Click on the completed workflow run
2. Scroll to **"Artifacts"** section
3. Click **"Formatica-Android-Release-APKs"**
4. Extract the ZIP file

### Step 4: Install on Device
```powershell
# Use the ARM64 APK for your Realme device
adb -s W49T89KZU8M7H6AA install -r app-arm64-v8a-release.apk
```

### Step 5: Test
Open the app on your phone and test all 9 tools!

---

## ✅ Pre-Flight Checklist

Before starting, verify:

- [ ] Code is pushed to GitHub repository
- [ ] `.github/workflows/build-android.yml` file exists
- [ ] Device is connected via ADB (`adb devices` shows your phone)
- [ ] You have a GitHub account with Actions enabled

---

## 📱 After Installation Checklist

Test each tool:

- [ ] **Document Convert** - Convert DOCX/TXT to PDF
- [ ] **Video Compress** - Compress a video file
- [ ] **Video Convert** - Convert video format
- [ ] **Extract Audio** - Extract audio from video
- [ ] **Image Convert** - Convert image format
- [ ] **Images to PDF** - Create PDF from images
- [ ] **Merge PDF** - Merge multiple PDFs
- [ ] **Split PDF** - Split PDF into parts
- [ ] **Greyscale PDF** - Convert PDF to greyscale

---

## 🔧 Troubleshooting Quick Fixes

### Build Not Starting?
- Check workflow file is in `.github/workflows/` (not `.github/workflow/`)
- Go to Actions tab and enable workflows if prompted

### Build Failed?
- Click on the failed step in Actions logs
- Check error message
- Common fixes:
  - Missing `pubspec.yaml` → `git add formatica_mobile/pubspec.yaml && git push`
  - Flutter version mismatch → Edit workflow file to match your version

### Can't Find APK?
- Look in workflow run page → "Artifacts" section
- Artifacts expire after 30 days
- Re-run workflow if expired

### APK Won't Install?
```powershell
# Uninstall old version first
adb -s W49T89KZU8M7H6AA uninstall com.yourpackage.formatica

# Install new version
adb -s W49T89KZU8M7H6AA install -r app-arm64-v8a-release.apk
```

---

## 📊 Build Configuration Options

### Option 1: Split per ABI (Recommended)
**Pros:** Smaller APKs, faster download  
**Cons:** Need to choose correct one for device  
**Use:** `split_per_abi: true`

**Result:** 3 APKs
- `app-arm64-v8a-release.apk` ← **For your Realme**
- `app-armeabi-v7a-release.apk`
- `app-x86_64-release.apk`

### Option 2: Universal APK
**Pros:** Works on all devices  
**Cons:** Larger file size  
**Use:** `split_per_abi: false`

**Result:** 1 APK
- `app-release.apk`

---

## 🎯 Common Workflows

### Build for Testing (Fast)
1. Trigger: **Manual**
2. Build type: **Debug**
3. Split per ABI: **True**
4. Time: ~5 minutes

### Build for Release (Production)
1. Trigger: **Tag push** (`git push origin v2.0.0`)
2. Build type: **Release**
3. Split per ABI: **True**
4. Time: ~8 minutes
5. **Auto-creates GitHub Release**

### Build for Distribution (Universal)
1. Trigger: **Manual**
2. Build type: **Release**
3. Split per ABI: **False**
4. Time: ~10 minutes

---

## 💡 Pro Tips

1. **Use split-per-abi** - Faster builds, smaller APKs
2. **Monitor build time** - Free tier = 2000 minutes/month
3. **Download immediately** - Artifacts expire in 30 days
4. **Test on device** - Use ADB for quick install
5. **Keep tags organized** - Use semantic versioning (v1.0.0, v1.1.0, etc.)

---

## 📞 Need Help?

- **Detailed Guide:** See `GITHUB_BUILD_GUIDE.md`
- **GitHub Actions Help:** https://docs.github.com/actions
- **Report Issues:** Create issue on GitHub repository

---

**Ready to build?** Start with Step 1 above! 🚀
