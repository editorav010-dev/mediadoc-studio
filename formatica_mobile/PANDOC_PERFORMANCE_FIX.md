# Pandoc Document Conversion - Performance Analysis & Solutions

## Problem Summary

Document conversions in the Formatica mobile app are failing or taking extremely long (hours) despite the Pandoc engine showing "Ready" status.

---

## Root Cause Analysis

### 1. **Double Base64 Encoding Bottleneck** ⚠️ CRITICAL

**Current Flow:**
```
File (bytes) 
  → Base64 encode (Dart) 
    → Pass to JS via runJavaScript() in 180KB chunks 
      → Base64 decode to bytes (JS)
        → Pass to WASM
          → Convert
            → Get output as Blob
              → Base64 encode (JS)
                → Pass back to Dart in 160KB chunks
                  → Base64 decode (Dart)
                    → Write to file
```

**Performance Impact:**
- Base64 increases file size by ~33%
- Each `runJavaScript()` call has overhead
- For a 1MB DOCX file:
  - Input: 1MB → 1.33MB base64 → split into ~8 chunks
  - Each chunk: JavaScript bridge overhead (~10-50ms)
  - Total input transfer: 1-3 seconds
  - Output: Similar overhead
  - **Total: 2-6 seconds just for data transfer**

### 2. **Small WASM Heap Size**

**Current Setting:**
```javascript
const args = ["pandoc.wasm", "+RTS", "-H32m", "-RTS"];
```

**Problem:**
- 32MB heap is too small for complex documents
- Pandoc may garbage collect frequently
- Complex DOCX files with images can easily exceed 32MB

### 3. **Inefficient Chunk Transfer**

**Current Implementation:**
```dart
// pandoc_bridge.dart - Line 8
static const int _inputChunkSize = 180000;  // 180KB chunks

// bridge.js - Line 2
const outputChunkSize = 160000;  // 160KB chunks
```

**Problem:**
- Each chunk requires a separate `runJavaScript()` call
- JavaScript bridge is synchronous and blocking
- For large files, hundreds of calls are needed

### 4. **WebView Console Interception Overhead**

**Current Implementation:**
```javascript
// bridge.js - Lines 15-32
console.log = function(...args) {
    postMessage('log', { level: 'log', message: args.join(' ') });
    originalLog.apply(console, args);
};
```

**Problem:**
- Every console.log/WASM operation sends a message to Flutter
- Pandoc WASM generates thousands of console messages
- Each message triggers Dart's `handleJavaScriptMessage()`

### 5. **Missing Error Reporting**

**Current Issue:**
- Errors in WASM conversion may not propagate correctly
- The 4-minute timeout hides actual errors
- No detailed logging for debugging

---

## Solution Options

### Option 1: Fix Pandoc WASM Implementation (Moderate Effort)

**Expected Improvement:** 50-70% faster, but still limited by WebView bridge

#### Changes Required:

1. **Increase WASM Heap Size**
   ```javascript
   // pandoc.js - Line 41
   const args = ["pandoc.wasm", "+RTS", "-H128m", "-M256m", "-RTS"];
   ```

2. **Disable Console Interception**
   ```javascript
   // bridge.js - Remove or comment out lines 15-32
   // Only enable in debug mode
   if (false) { // Set to true for debugging
     console.log = function(...args) { ... };
   }
   ```

3. **Optimize Chunk Sizes**
   ```dart
   // pandoc_bridge.dart
   static const int _inputChunkSize = 500000;  // 500KB (was 180KB)
   ```
   ```javascript
   // bridge.js
   const outputChunkSize = 500000;  // 500KB (was 160KB)
   ```

4. **Add Better Error Handling**
   - Catch WASM exceptions
   - Report stderr properly
   - Add timeout with progress updates

5. **Use SharedArrayBuffer (if supported)**
   - Avoid base64 encoding entirely
   - Share memory between Dart and JS
   - **Not supported on all Android WebViews**

**Estimated Time:** 2-3 hours
**Expected Speed:** 1MB file → 3-8 seconds (was 30+ seconds)
**Limitation:** Still constrained by WebView bridge performance

---

### Option 2: Use Native Platform Channels (RECOMMENDED) ⭐

**Expected Improvement:** 5-10x faster, truly native performance

#### Architecture:

```
Flutter (Dart)
  ↓ Platform Channel
Android (Kotlin) / iOS (Swift)
  ↓ Native Process
Native Pandoc Binary (ARM64)
  ↓ Process Output
Return bytes directly
```

#### Implementation Steps:

1. **Download Pandoc Binary for Android**
   - Pre-compiled pandoc binary for ARM64
   - ~50MB binary (can be stripped to ~30MB)
   - Store in `assets/pandoc/android/arm64/pandoc`

2. **Extract Binary on First Launch**
   ```dart
   // Copy from assets to app cache
   final pandocPath = await _extractPandocBinary();
   await Process.run('chmod', ['+x', pandocPath]);
   ```

3. **Use Process.run() for Conversion**
   ```dart
   final result = await Process.run(
     pandocPath,
     [
       inputPath,
       '-o', outputPath,
       '-t', outputFormat,
     ],
     workingDirectory: tempDir.path,
   );
   ```

4. **No Base64, No WebView, No JavaScript**
   - Direct file-based conversion
   - Native speed (C Haskell binary)
   - Full Pandoc feature support

**Pros:**
- ✅ 5-10x faster than WASM
- ✅ Full Pandoc compatibility
- ✅ No WebView overhead
- ✅ Better error reporting
- ✅ Supports all Pandoc features

**Cons:**
- ❌ Increases app size by ~30-50MB
- ❌ Requires maintaining binaries for multiple architectures
- ❌ More complex build process
- ❌ iOS requires separate binary

**Estimated Time:** 6-8 hours
**Expected Speed:** 1MB file → 0.5-2 seconds
**App Size Increase:** ~30-50MB

---

### Option 3: Use Alternative Offline Engine (COMPLETE REPLACEMENT)

If Pandoc proves too problematic, here are alternatives:

#### A. **LibreOffice Headless (Android)**

**Pros:**
- ✅ Excellent DOCX/PDF support
- ✅ Fast conversion
- ✅ Native binary available for Android

**Cons:**
- ❌ Very large (~200MB)
- ❌ Complex to integrate
- ❌ Heavy memory usage

**Verdict:** ❌ Too large for mobile app

---

#### B. **Apache POI + iText (Java/Kotlin)**

**Pros:**
- ✅ Native Android libraries
- ✅ Good DOCX/Excel support
- ✅ iText for PDF generation

**Cons:**
- ❌ Requires Java/Kotlin code
- ❌ Multiple libraries needed
- ❌ Complex integration
- ❌ Limited format support (no EPUB, MD)

**Verdict:** ⚠️ Good for DOCX↔PDF only, not full Pandoc replacement

**Libraries:**
- Apache POI: DOCX/Excel/PowerPoint
- iText: PDF generation
- Docx4j: Advanced DOCX handling

---

#### C. **Pandoc WASM (Optimized - Option 1 above)**

**Verdict:** ✅ Best balance of features vs complexity

---

#### D. **Custom Format Handlers (Modular Approach)**

Implement each format converter separately:

```dart
class DocumentConverter {
  Future<Uint8List> convert({
    required Uint8List input,
    required String inputFormat,
    required String outputFormat,
  }) async {
    switch ('$inputFormat->$outputFormat') {
      case 'docx->pdf':
        return await _convertDocxToPdf(input);
      case 'md->html':
        return await _convertMdToHtml(input);
      // ... etc
    }
  }
}
```

**Libraries per format:**
- **Markdown → HTML**: `markdown` Dart package
- **HTML → PDF**: `pdf` + `printing` packages (already using)
- **DOCX → HTML**: Custom parser or `archive` package
- **TXT → PDF**: `pdf` package (already implemented)

**Pros:**
- ✅ Lightweight
- ✅ Fast for supported formats
- ✅ No external binaries

**Cons:**
- ❌ Limited format support
- ❌ Requires maintaining multiple converters
- ❌ May not handle complex documents well

**Verdict:** ⚠️ Good as fallback, not primary solution

---

## Recommended Action Plan

### Phase 1: Quick Wins (Fix Pandoc WASM) - 2-3 hours

1. Increase WASM heap to 128MB
2. Disable console interception in release mode
3. Optimize chunk sizes to 500KB
4. Add proper error reporting
5. Test with various document sizes

**Expected Result:** 50-70% performance improvement

### Phase 2: Evaluate Results

- Test with 1MB, 5MB, 10MB documents
- Measure conversion times
- Check error rates
- User testing on Realme device

### Phase 3: Consider Native Binary (if Phase 1 insufficient)

- Download pre-compiled Pandoc ARM64 binary
- Integrate via platform channels
- Test performance improvement
- Decide if app size increase is acceptable

---

## Implementation Files

### Files to Modify (Option 1 - Fix WASM):

1. `formatica_mobile/assets/pandoc/pandoc.js`
   - Line 41: Increase heap size
   - Add error handling

2. `formatica_mobile/assets/pandoc/bridge.js`
   - Lines 15-32: Disable console in release
   - Line 2: Increase chunk size

3. `formatica_mobile/lib/services/pandoc_bridge.dart`
   - Line 8: Increase chunk size
   - Add timeout handling
   - Improve error messages

4. `formatica_mobile/lib/services/convert_service.dart`
   - Add conversion validation
   - Better error handling

### Files to Create (Option 2 - Native Binary):

1. `formatica_mobile/android/app/src/main/kotlin/.../PandocConverter.kt`
2. `formatica_mobile/lib/services/native_pandoc_service.dart`
3. `formatica_mobile/assets/pandoc/android/arm64/pandoc` (binary)

---

## Testing Strategy

### Test Documents:

1. **Small (50KB)**: Simple text DOCX
2. **Medium (1MB)**: Formatted DOCX with images
3. **Large (5MB)**: Complex DOCX with tables, images
4. **Very Large (10MB)**: Full book with images

### Test Conversions:

1. DOCX → PDF
2. DOCX → HTML
3. MD → PDF
4. HTML → DOCX
5. TXT → PDF

### Performance Metrics:

- Conversion time (seconds)
- Memory usage (MB)
- App size increase (MB)
- Success rate (%)

---

## Conclusion

**Current State:** Pandoc WASM is functional but extremely slow due to:
- Inefficient data transfer (base64 + chunking)
- Small WASM heap
- Console interception overhead

**Best Short-term Fix:** Optimize WASM implementation (Option 1)
- Quick to implement (2-3 hours)
- 50-70% performance improvement
- No app size increase

**Best Long-term Solution:** Native Pandoc binary (Option 2)
- 5-10x faster
- Full Pandoc features
- +30-50MB app size

**Recommendation:** Start with Option 1, evaluate, then decide if Option 2 is needed.
