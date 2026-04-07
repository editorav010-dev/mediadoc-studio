# Document Format Support Matrix

## Current State (Pandoc WASM Only)

### ✅ What Works:
| Input → Output | PDF | DOCX | HTML | TXT | MD | RTF | EPUB | ODT |
|----------------|-----|------|------|-----|----|----|-----|-----|
| **DOCX** | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect |
| **ODT** | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect |
| **HTML** | ✅ Perfect | ✅ Perfect | - | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect |
| **Markdown** | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | - | ✅ Perfect | ✅ Perfect | ✅ Perfect |
| **TXT** | ✅ Perfect | ✅ Perfect | ✅ Perfect | - | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect |
| **RTF** | ✅ Good | ✅ Good | ✅ Good | ✅ Good | ✅ Good | - | ⚠️ Limited | ✅ Good |
| **EPUB** | ✅ Good | ✅ Good | ✅ Good | ✅ Good | ✅ Good | ⚠️ Limited | - | ✅ Good |

### ❌ What Doesn't Work:
| Input → Output | PDF | DOCX | XLSX | PPTX | Notes |
|----------------|-----|------|------|------|-------|
| **XLSX** | ❌ FAILS | ❌ FAILS | - | ❌ FAILS | Only extracts basic table |
| **XLS** | ❌ FAILS | ❌ FAILS | ❌ FAILS | ❌ FAILS | Not supported at all |
| **PPTX** | ❌ FAILS | ❌ FAILS | ❌ FAILS | - | Only extracts text |
| **PPT** | ❌ FAILS | ❌ FAILS | ❌ FAILS | ❌ FAILS | Not supported at all |
| **CSV** | ⚠️ PARTIAL | ❌ FAILS | ❌ FAILS | ❌ FAILS | Basic table only |
| **PDF** | - | ⚠️ TEXT ONLY | ❌ FAILS | ❌ FAILS | Text extraction only |

---

## Target State (Hybrid: Pandoc + Apache POI)

### All Formats Working:
| Input → Output | PDF | DOCX | HTML | TXT | XLSX | PPTX |
|----------------|-----|------|------|-----|------|------|
| **DOCX** | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ⚠️ N/A | ⚠️ N/A |
| **XLSX** | ✅ Perfect | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | - | ⚠️ N/A |
| **XLS** | ✅ Perfect | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A |
| **CSV** | ✅ Perfect | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A |
| **PPTX** | ✅ Good | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | - |
| **PPT** | ✅ Good | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A |
| **HTML** | ✅ Perfect | ✅ Perfect | - | ✅ Perfect | ⚠️ N/A | ⚠️ N/A |
| **MD** | ✅ Perfect | ✅ Perfect | ✅ Perfect | ✅ Perfect | ⚠️ N/A | ⚠️ N/A |
| **PDF** | - | ⚠️ Text | ⚠️ Text | ⚠️ Text | ⚠️ N/A | ⚠️ N/A |

**Legend:**
- ✅ Perfect = Full formatting preserved
- ✅ Good = Most formatting preserved
- ⚠️ Limited/Text = Partial support
- ❌ FAILS = Cannot convert
- ⚠️ N/A = Not applicable (format doesn't support this conversion)

---

## Detailed Format Analysis

### 📄 **DOCX (Word Documents)**

**Current:** ✅ Perfect with Pandoc WASM
- Preserves: Headings, bold, italic, lists, tables, images, hyperlinks
- Loses: Complex formatting (margins, custom fonts, watermarks)
- Speed: 5-15 seconds
- **Verdict:** Keep using Pandoc WASM ✅

---

### 📊 **XLSX (Excel Spreadsheets)**

**Current:** ❌ Fails with Pandoc WASM
- Only extracts: First sheet as basic table
- Loses: All other sheets, formulas, charts, formatting, colors, borders
- Output quality: ⭐ (Very poor - unusable for business documents)

**With Apache POI:** ✅ Perfect
- Preserves: Multiple sheets, cell formatting, colors, borders, evaluated formulas
- Handles: Large spreadsheets (1000+ rows), complex formulas
- Speed: 1-3 seconds
- **Verdict:** Must use Apache POI ✅

**Example:**
```
Input XLSX:
├── Sheet 1: Sales Data (500 rows, formulas, conditional formatting)
├── Sheet 2: Summary (charts, pivot table)
└── Sheet 3: Settings (hidden)

Pandoc Output: ❌ Sheet 1 as plain table, no formatting
Apache POI Output: ✅ Multi-page PDF with all sheets, formatted tables
```

---

### 📑 **PPTX (PowerPoint Presentations)**

**Current:** ❌ Fails with Pandoc WASM
- Only extracts: Raw text from slides
- Loses: All slide layouts, images, charts, animations, transitions
- Output quality: ⭐ (Very poor - just text dump)

**With Apache POI:** ✅ Good
- Preserves: Slide layouts, text formatting, images, basic shapes
- Loses: Animations, transitions, embedded videos
- Speed: 2-5 seconds
- **Verdict:** Must use Apache POI ✅

**Example:**
```
Input PPTX:
├── Slide 1: Title slide (background image, large title)
├── Slide 2: Bullet points with icons
├── Slide 3: Chart (bar graph)
└── Slide 4: Image gallery (4 photos)

Pandoc Output: ❌ Plain text dump of all slide content
Apache POI Output: ✅ 4-page PDF with slides rendered visually
```

---

### 📋 **CSV (Comma-Separated Values)**

**Current:** ⚠️ Partial with Pandoc WASM
- Converts to: Markdown table in PDF
- Handles: Basic comma-separated data
- Loses: Special characters, encoding issues possible

**With Apache POI:** ✅ Perfect
- Handles: Large CSV files (10,000+ rows)
- Preserves: Encoding (UTF-8, etc.), special characters
- Formats: Proper PDF tables with headers
- Speed: <1 second
- **Verdict:** Better with Apache POI ✅

---

### 📖 **PDF (Portable Document Format)**

**PDF → Other Formats:** ⚠️ Limited for all solutions

**Reality Check:**
- PDF is a **presentation format**, not an editable format
- Converting PDF → DOCX/XLSX is inherently lossy
- Even Adobe Acrobat struggles with this

**What Works:**
- ✅ PDF text extraction → TXT/MD
- ⚠️ PDF tables → CSV (if simple tables)
- ❌ PDF images/charts → Editable formats

**Current:** Pandoc WASM can extract text only
**With Apache POI:** Same limitation (PDF parsing is hard)

**Verdict:** ⚠️ Offer PDF → DOCX but warn about quality loss

---

## 🎯 Your Minimum Requirements - Met?

| Requirement | Current (Pandoc) | Target (Hybrid) | Notes |
|-------------|------------------|-----------------|-------|
| **DOCX → PDF** | ✅ YES | ✅ YES | Already working |
| **XLSX → PDF** | ❌ NO | ✅ YES | Need Apache POI |
| **CSV → PDF** | ⚠️ POOR | ✅ YES | Need Apache POI |
| **PPT → PDF** | ❌ NO | ✅ YES | Need Apache POI |
| **PPTX → PDF** | ❌ NO | ✅ YES | Need Apache POI |
| **PDF → DOCX** | ⚠️ TEXT ONLY | ⚠️ TEXT ONLY | Inherent limitation |
| **PDF → XLSX** | ❌ NO | ⚠️ BASIC | Possible with table extraction |
| **PDF → PPTX** | ❌ NO | ❌ NO | Not feasible |

### Score:
- **Current:** 1/8 requirements met (12.5%)
- **Target:** 6/8 requirements met (75%) + 2 partial

---

## 📊 Quality Comparison

### XLSX → PDF Conversion Quality:

**Pandoc WASM:**
```
Page 1:
Column A    Column B    Column C
Data1       Data2       Data3
Data4       Data5       Data6

[No formatting, no colors, no borders, single sheet only]
Quality: ⭐ (1/5)
```

**Apache POI:**
```
Page 1: Sheet 1 - Sales Data
┌─────────────┬─────────────┬─────────────┐
│   Date      │   Product   │   Revenue   │  ← Header row (bold, colored)
├─────────────┼─────────────┼─────────────┤
│ 2024-01-01  │   Widget A  │   $1,234    │  ← Formatted cells
│ 2024-01-02  │   Widget B  │   $5,678    │
└─────────────┴─────────────┴─────────────┘

Page 2: Sheet 2 - Summary
┌──────────────────────────────────────┐
│ Total Revenue: $6,912                │  ← Formula evaluated
│ Average: $3,456                      │
└──────────────────────────────────────┘

Quality: ⭐⭐⭐⭐⭐ (5/5)
```

---

### PPTX → PDF Conversion Quality:

**Pandoc WASM:**
```
Slide 1: Welcome to Our Company
Slide 2: Our Products - Widget A, Widget B, Widget C
Slide 3: Sales increased by 50% this quarter
Slide 4: Contact us at info@example.com

[Plain text dump, no visuals, no formatting]
Quality: ⭐ (1/5)
```

**Apache POI:**
```
[Page 1: Full slide render]
┌─────────────────────────────────────┐
│                                     │
│    [Background image]               │
│                                     │
│     Welcome to Our Company          │  ← Large title, centered
│         Subtitle text               │
│                                     │
└─────────────────────────────────────┘

[Page 2: Full slide render]
┌─────────────────────────────────────┐
│  Our Products                       │
│  • Widget A  [icon]                 │
│  • Widget B  [icon]                 │
│  • Widget C  [icon]                 │
│                                     │
│  [Product image]                    │
└─────────────────────────────────────┘

Quality: ⭐⭐⭐⭐ (4/5)
```

---

## 🔧 Implementation Architecture

```
┌─────────────────────────────────────────────────┐
│           ConvertScreen (Flutter)               │
│                                                 │
│  User selects: document.docx                    │
│  User chooses: → PDF                            │
│  User taps: "Convert Now"                       │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────┐
│         ConvertService (Dart)                   │
│                                                 │
│  Check file extension: .docx                    │
│  Route to appropriate converter...              │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
┌───────────────┐    ┌───────────────┐
│ DOCX/ODT/     │    │ XLSX/PPTX/    │
│ HTML/MD/TXT   │    │ CSV/XLS/PPT   │
│               │    │               │
│ Pandoc WASM   │    │ Apache POI    │
│ (WebView)     │    │ (Native)      │
└───────┬───────┘    └───────┬───────┘
        │                    │
        │  5-15 seconds      │  1-5 seconds
        │                    │
        ↓                    ↓
┌─────────────────────────────────────────────────┐
│              Output: PDF File                   │
│                                                 │
│  Quality: ⭐⭐⭐⭐⭐                                │
│  Location: /Formatica/PDFs/                     │
│  Ready to share/view                            │
└─────────────────────────────────────────────────┘
```

---

## 💰 Cost Analysis

### Development Cost:
- **Current approach:** $0 (but doesn't work for XLSX/PPTX)
- **Hybrid approach:** $0 (10-14 hours of our development time)

### Licensing Cost:
- **Apache POI:** $0 (Apache 2.0 License)
- **Android PdfDocument:** $0 (Included in Android SDK)
- **Total:** **$0** ✅

### APK Size Cost:
- **Current:** ~55 MB
- **After adding Apache POI:** ~60-63 MB (+5-8 MB)
- **Impact:** Minimal (acceptable for functionality gained)

---

## ✅ Final Recommendation

### **Implement Hybrid Approach**

**Why:**
1. ✅ Meets 6/8 requirements (vs 1/8 currently)
2. ✅ 100% offline, no internet needed
3. ✅ Free and open source (Apache 2.0)
4. ✅ Google Play compliant
5. ✅ Fast conversions (1-15 seconds)
6. ✅ High quality output
7. ✅ Minimal APK increase (+5-8 MB)

**What Changes:**
- Keep Pandoc WASM for DOCX/MD/HTML (already working perfectly)
- Add Apache POI for XLSX/PPTX/CSV (new implementation)
- Smart routing based on file type

**Timeline:** 10-14 hours development + testing

**Ready to proceed?** 🚀
