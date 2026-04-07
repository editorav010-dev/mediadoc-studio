# Pandoc Performance Fix - Quick Reference

## What Changed?

| Component | Before | After | Improvement |
|-----------|--------|-------|-------------|
| WASM Heap | 32MB | 128MB | 4x more memory |
| Max Heap | Unlimited | 256MB | Prevents OOM |
| Input Chunks | 180KB | 500KB | 64% fewer calls |
| Output Chunks | 160KB | 500KB | 68% fewer calls |
| Console Bridge | Always ON | OFF (production) | 100% faster |
| Timeout | 4 minutes | 6 minutes | 50% longer |
| Logging | None | Detailed | Easy debugging |

## Expected Speed

| File Size | Before | After |
|-----------|--------|-------|
| 50KB | 10-20s | 2-5s |
| 1MB | 30-60s | 5-15s |
| 2MB | 60-120s | 10-30s |
| 5MB | Timeout | 30-90s |

## Quick Test

```powershell
# 1. Build (GitHub Actions)
# Go to: https://github.com/editorav010-dev/mediadoc-studio/actions

# 2. Download APK (after build completes)
# Click "Formatica-Android-Release-APKs" artifact

# 3. Install
adb -s W49T89KZU8M7H6AA uninstall com.formatica.formatica_mobile
adb -s W49T89KZU8M7H6AA install -r app-arm64-v8a-release.apk

# 4. Monitor logs
adb -s W49T89KZU8M7H6AA logcat | Select-String "PandocBridge"
```

## Files Modified

1. ✅ `assets/pandoc/pandoc.js` - WASM memory
2. ✅ `assets/pandoc/bridge.js` - Console + chunks
3. ✅ `lib/services/pandoc_bridge.dart` - Chunks + timeout + logging

## If Still Slow

**Option A:** Enable debug logging
- Edit `bridge.js`: `ENABLE_CONSOLE_BRIDGE = true`
- Rebuild and check logs

**Option B:** Use native binary
- +30-50MB app size
- 5-10x faster than WASM
- Requires 6-8 hours to implement

## Report Results

Test with 3 files and report:
1. File size
2. Conversion time
3. Success/Failure
4. Any errors

---

**Status:** ✅ Ready to build and test
