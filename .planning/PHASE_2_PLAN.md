# PHASE 2: Complete Phase 1 Integration + Missing Tools + UI Redesign

**Goal:** Integrate OCR, Watermark, Batch Folder into app + add backend + match target UI design + all 12 tools fully working

**Status:** Phase 1 is 90% complete (10/12 tools work, 3 have components but not integrated)

---

## PHASE 2 BREAKDOWN

### Task 2.1: Integrate OCR Tool
**Status:** Component exists, NOT in App.tsx or Sidebar
- [x] Add OCR to Sidebar navigation (Ctrl+5, PDF section)
- [ ] Add OCR screen route in App.tsx
- [ ] Implement OCR backend command (Rust)
- [ ] Test OCR end-to-end with sample PDF
- [ ] Verify progress tracking UI works
- [ ] Verify extracted text output works
- [ ] Verify file saving works

**Files to Modify:**
- `src/components/Sidebar.tsx` - add OCR nav item
- `src/App.tsx` - add OCR route & import
- `src-tauri/src/lib.rs` - add ocr_pdf command
- `src-tauri/src/handlers.rs` - implement OCR handler

---

### Task 2.2: Integrate Watermark Tool
**Status:** Component exists, NOT in App.tsx or Sidebar
- [ ] Add Watermark to Sidebar (Ctrl+8, Image section)
- [ ] Add Watermark screen route in App.tsx
- [ ] Implement Watermark backend command (Rust)
- [ ] Test drag-and-drop watermark positioning
- [ ] Test text watermark application
- [ ] Test logo watermark loading
- [ ] Verify file saving works

**Files to Modify:**
- `src/components/Sidebar.tsx` - add Watermark nav item
- `src/App.tsx` - add Watermark route & import
- `src-tauri/src/lib.rs` - add watermark command
- `src-tauri/src/handlers.rs` - implement watermark handler

---

### Task 2.3: Integrate Batch Folder Tool
**Status:** Component exists, NOT in App.tsx or Sidebar
- [ ] Add Batch Folder to Sidebar (no Ctrl shortcut, Batch section)
- [ ] Add Batch Folder screen route in App.tsx
- [ ] Implement folder scanning backend command
- [ ] Implement auto-conversion backend command
- [ ] Test folder selection
- [ ] Test file detection (count by type)
- [ ] Test batch conversion flow
- [ ] Verify progress tracking works

**Files to Modify:**
- `src/components/Sidebar.tsx` - add Batch Folder nav item
- `src/App.tsx` - add Batch Folder route & import
- `src-tauri/src/lib.rs` - add batch commands
- `src-tauri/src/handlers.rs` - implement batch handlers

---

### Task 2.4: Add Missing Backend Commands
Implement Rust backend for all 3 tools:
- [ ] `ocr_pdf` command with progress events
- [ ] `watermark` command (text + logo modes)
- [ ] `scan_batch_folder` command
- [ ] `convert_batch_folder` command with parallel processing
- [ ] Add OCR library integration (tesseract)
- [ ] Add watermark library integration (imagemagick or similar)

---

### Task 2.5: Update UI to Match Target Design
**Comparing current UI vs target HTML file:**
- [ ] Review current App.css vs target styling
- [ ] Update color scheme if needed (dark theme, accent color)
- [ ] Update sidebar styling to match target
- [ ] Update topbar styling
- [ ] Update history panel styling
- [ ] Update tool screens layout (2-column grid where needed)
- [ ] Add missing UI components (file size target mode for video, smart defaults banner)
- [ ] Update Typography/spacing
- [ ] Ensure responsive design

**Files to Modify:**
- `src/App.css` - comprehensive style update
- Individual tool components if layout changes needed

---

### Task 2.6: Integration Testing
- [ ] Test OCR tool end-to-end (file load → OCR → text output → save)
- [ ] Test Watermark tool end-to-end (file load → preview → apply → save)
- [ ] Test Batch Folder tool end-to-end (folder select → scan → auto-convert)
- [ ] Test all 12 tools are visible in sidebar
- [ ] Test keyboard shortcuts for all 3 new tools
- [ ] Test theme toggle still works
- [ ] Test dependency pills still work
- [ ] Test history panel tracks all conversions
- [ ] Test drag-and-drop auto-detection for new tools

---

### Task 2.7: Build Phase 2 Release
After all tests pass:
- [ ] Verify dev build works: `npm run tauri dev`
- [ ] Verify production build compiles: `npm run tauri build`
- [ ] Generate installer: `npm run tauri build --release`
- [ ] Verify installer runs and app starts
- [ ] Test all tools one more time in installed app
- [ ] Verify no errors in console
- [ ] Document any known issues

---

## DELIVERABLES

1. ✅ All 15 tools visible in sidebar (12 main + 3 system)
2. ✅ All tools have working frontend + backend
3. ✅ UI matches target HTML design
4. ✅ All keyboard shortcuts work
5. ✅ Production installer ready to distribute
6. ✅ No console errors or warnings

---

## PRIORITY ORDER

1. **2.1 - OCR** (Most complex, needs library)
2. **2.2 - Watermark** (Medium complexity)
3. **2.3 - Batch Folder** (Medium complexity)
4. **2.4 - Backend Commands** (Done in parallel with 2.1-2.3)
5. **2.5 - UI Redesign** (Can be parallel)
6. **2.6 - Testing** (Sequential, after all built)
7. **2.7 - Release Build** (Last step)

---

## KNOWN BLOCKERS

- OCR needs Tesseract library integration
- Watermark needs image processing library
- Batch requires parallel job management
- Some system fonts/libraries may need installation

---

## SUCCESS CRITERIA

- [ ] All 12 tools + 3 system items in sidebar
- [ ] All tools have working end-to-end flow
- [ ] No errors in console during testing
- [ ] UI visually matches target design
- [ ] Installer builds without errors
- [ ] App runs from installer and all tools work
- [ ] Can process real files without crashes

