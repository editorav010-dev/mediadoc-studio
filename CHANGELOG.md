# Changelog

All notable changes to Media & Doc Studio are documented here.

---

## [0.1.0] — Phase 0 Complete — March 2026

### Added
- Modular domain layer extracted from legacy converter_tool.py
- Document conversion adapter (LibreOffice/soffice)
- Audio conversion adapter (ffmpeg)
- Media download adapter (yt-dlp)
- Image to PDF adapter (Pillow)
- Structured error messages replacing raw Python exceptions
- File path utilities with full Windows/Mac/Linux compatibility
- Format validation with unsupported path suggestions
- Dependency health checker with OS-specific install hints
- Full CLI with commands: convert doc, convert audio, convert image, download, doctor
- Automated test suite (pytest) with GitHub Actions CI
- Coverage reporting

### Fixed
- Hardcoded Unix path separators replaced with pathlib.Path throughout
- Silent failures on missing dependencies now surface friendly error messages

### Known Limitations
- No GUI yet (Tauri desktop app coming in Phase 1)
- No mobile support (Flutter app coming in Phase 1)
- No cloud backend (FastAPI coming in Phase 1)

---

## [Unreleased] — Phase 1 In Progress
