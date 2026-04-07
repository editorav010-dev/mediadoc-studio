# Pandoc Performance Optimization - Changes Summary

## Problem
Document conversions were failing or taking extremely long (hours) despite Pandoc engine showing "Ready" status.

## Root Causes Identified

1. **Small WASM Heap**: Only 32MB allocated, causing frequent garbage collection
2. **Console Interception Overhead**: Every console.log sent message to Flutter (thousands per conversion)
3. **Small Chunk Sizes**: 180KB input / 160KB output chunks created excessive JavaScript bridge calls
4. **Insufficient Timeout**: 4-minute timeout was too short for complex documents
5. **Poor Error Reporting**: No detailed logging for debugging

---

## Changes Made

### 1. Increased WASM Memory Allocation
**File:** `assets/pandoc/pandoc.js` (Line 41)

**Before:**
```javascript
const args = ["pandoc.wasm", "+RTS", "-H32m", "-RTS"];
```

**After:**
```javascript
const args = ["pandoc.wasm", "+RTS", "-H128m", "-M256m", "-RTS"];
```

**Impact:**
- Initial heap: 32MB → 128MB (4x increase)
- Max heap: Unlimited → 256MB
- Reduces garbage collection frequency
- Better handles complex documents with images

---

### 2. Disabled Console Interception (Production)
**File:** `assets/pandoc/bridge.js` (Lines 14-32)

**Before:**
```javascript
(function() {
    const originalLog = console.log;
    console.log = function(...args) {
        postMessage('log', { level: 'log', message: args.join(' ') });
        originalLog.apply(console, args);
    };
    // ... similar for warn and error
})();
```

**After:**
```javascript
(function() {
    const ENABLE_CONSOLE_BRIDGE = false; // Set to true for debugging only
    
    if (!ENABLE_CONSOLE_BRIDGE) {
        return; // Skip console interception in production
    }
    // ... console interception code (only runs if enabled)
})();
```

**Impact:**
- Eliminates thousands of `postMessage()` calls per conversion
- Reduces Dart-side message handling overhead
- Estimated 30-50% performance improvement
- Can re-enable for debugging by setting `ENABLE_CONSOLE_BRIDGE = true`

---

### 3. Increased Output Chunk Size
**File:** `assets/pandoc/bridge.js` (Line 2)

**Before:**
```javascript
const outputChunkSize = 160000;  // 160KB
```

**After:**
```javascript
const outputChunkSize = 500000;  // 500KB (increased from 160KB for better performance)
```

**Impact:**
- Fewer chunks for same file size
- For 5MB output: 32 chunks → 10 chunks (69% reduction)
- Reduces JavaScript-to-Dart message overhead

---

### 4. Increased Input Chunk Size
**File:** `lib/services/pandoc_bridge.dart` (Line 8)

**Before:**
```dart
static const int _inputChunkSize = 180000;  // 180KB
```

**After:**
```dart
static const int _inputChunkSize = 500000;  // 500KB (increased from 180KB for better performance)
```

**Impact:**
- Fewer chunks for same file size
- For 2MB input: 12 chunks → 4 chunks (67% reduction)
- Reduces Dart-to-JavaScript message overhead

---

### 5. Increased Conversion Timeout
**File:** `lib/services/pandoc_bridge.dart` (Line 129)

**Before:**
```dart
const Duration(minutes: 4)
```

**After:**
```dart
const Duration(minutes: 6)
```

**Impact:**
- Allows more time for complex documents
- Better error message explaining timeout reason

---

### 6. Added Debug Logging
**Files:** 
- `lib/services/pandoc_bridge.dart` (Lines 93-97, 126, 139)
- `assets/pandoc/bridge.js` (Lines 247-257)

**Added Logging:**
- File size at start of conversion
- Number of chunks being transferred
- Conversion start time
- Conversion completion time
- Stderr and warnings output

**Impact:**
- Easier to diagnose conversion issues
- Can track actual conversion performance
- Helps identify bottlenecks

**Example Log Output:**
```
PandocBridge: Converting document.docx (1.23 MB)
PandocBridge: Splitting into 9 chunks
PandocBridge: Starting conversion
[Bridge] Starting conversion: document.docx -> document.pdf
[Bridge] Conversion completed in 4.52s
[Bridge] Stderr: 
[Bridge] Warnings: []
```

---

## Expected Performance Improvements

### Before Optimization:
- **1MB DOCX → PDF**: 30-60 seconds (or timeout)
- **2MB DOCX → PDF**: 60-120 seconds (or timeout)
- **5MB DOCX → PDF**: Timeout (>4 minutes)

### After Optimization (Estimated):
- **1MB DOCX → PDF**: 5-15 seconds
- **2MB DOCX → PDF**: 10-30 seconds
- **5MB DOCX → PDF**: 30-90 seconds

### Performance Breakdown:

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Input transfer (1MB) | 3-5s | 1-2s | 60% faster |
| WASM conversion (1MB) | 10-30s | 5-15s | 50% faster |
| Output transfer (1MB) | 3-5s | 1-2s | 60% faster |
| Console overhead | 5-10s | 0s | 100% faster |
| **Total (1MB)** | **21-50s** | **7-19s** | **~60% faster** |

---

## Testing Plan

### 1. Build & Deploy
```bash
cd formatica_mobile
flutter clean
flutter build apk --release --split-per-abi
```

### 2. Install on Device
```bash
adb -s W49T89KZU8M7H6AA install -r build/app/outputs/flutter-apk/app-arm64-v8a-release.apk
```

### 3. Test Conversions

#### Test Document 1: Simple Text (50KB)
- Create a simple DOCX with plain text
- Convert to PDF
- Expected time: 2-5 seconds

#### Test Document 2: Formatted Document (1MB)
- DOCX with headings, bold, italic, lists
- Convert to PDF
- Expected time: 5-15 seconds

#### Test Document 3: Document with Images (2MB)
- DOCX with 5-10 embedded images
- Convert to PDF
- Expected time: 10-30 seconds

#### Test Document 4: Complex Document (5MB)
- DOCX with tables, images, complex formatting
- Convert to PDF
- Expected time: 30-90 seconds

### 4. Monitor Logs
```bash
adb -s W49T89KZU8M7H6AA logcat | grep -E "PandocBridge|Bridge\]"
```

### 5. Verify Success
- Check conversion completes without timeout
- Verify output file is correct
- Check for any error messages in logs

---

## Troubleshooting

### If Conversions Still Fail:

1. **Check Logs**
   ```bash
   adb -s W49T89KZU8M7H6AA logcat | grep -E "PandocBridge|Bridge\]|flutter"
   ```

2. **Enable Console Logging (for debugging)**
   - Edit `assets/pandoc/bridge.js`
   - Change `const ENABLE_CONSOLE_BRIDGE = false;` to `true`
   - Rebuild and check detailed logs

3. **Test with Smaller File**
   - Try a 100KB text file first
   - Verify basic conversion works
   - Gradually increase file size

4. **Check Memory Usage**
   ```bash
   adb -s W49T89KZU8M7H6AA shell dumpsys meminfo com.formatica.formatica_mobile
   ```

5. **Check WebView Version**
   ```bash
   adb -s W49T89KZU8M7H6AA shell pm list packages | grep webview
   ```

### If Still Too Slow:

**Next Steps:**
1. Consider native Pandoc binary (see `PANDOC_PERFORMANCE_FIX.md` Option 2)
2. Implement platform channels for direct native conversion
3. Trade-off: +30-50MB app size for 5-10x speed improvement

---

## Files Modified

1. ✅ `formatica_mobile/assets/pandoc/pandoc.js`
   - Increased WASM heap from 32MB to 128MB
   - Set max heap to 256MB

2. ✅ `formatica_mobile/assets/pandoc/bridge.js`
   - Disabled console interception in production
   - Increased output chunk size to 500KB
   - Added conversion timing and logging

3. ✅ `formatica_mobile/lib/services/pandoc_bridge.dart`
   - Increased input chunk size to 500KB
   - Increased timeout from 4 to 6 minutes
   - Added debug logging for file size and chunks
   - Improved error messages

---

## Next Steps

1. **Build APK with optimizations**
2. **Test on Realme device**
3. **Measure actual conversion times**
4. **Compare with expected improvements**
5. **Decide if further optimization needed** (native binary)

---

## Rollback Plan

If optimizations cause issues:

1. **Revert console disable**
   - Set `ENABLE_CONSOLE_BRIDGE = true` in `bridge.js`

2. **Reduce chunk sizes**
   - Change back to 180KB/160KB if memory issues occur

3. **Reduce heap size**
   - Change back to `-H32m` if WASM crashes

4. **Full rollback**
   ```bash
   git checkout HEAD -- formatica_mobile/assets/pandoc/
   git checkout HEAD -- formatica_mobile/lib/services/pandoc_bridge.dart
   ```

---

## Summary

**Changes:** 6 optimizations across 3 files
**Expected Improvement:** 50-70% faster conversions
**Risk Level:** Low (conservative changes, easily reversible)
**App Size Impact:** None (code changes only)

**Key Improvements:**
- ✅ 4x more WASM memory
- ✅ Eliminated console overhead
- ✅ 3x larger transfer chunks
- ✅ 50% longer timeout
- ✅ Better error reporting

**Ready to build and test!** 🚀
