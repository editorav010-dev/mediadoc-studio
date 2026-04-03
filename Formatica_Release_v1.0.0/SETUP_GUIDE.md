# Formatica v1.0.0 - Installation & Setup Guide

## Download

- **NSIS Installer (Recommended)**: `Formatica_1.0.0_x64-setup.exe` (2.9 MB)
- **MSI Installer**: `Formatica_1.0.0_x64_en-US.msi` (4.5 MB)

Both are identical in functionality. Choose either one based on your preference.

---

## System Requirements

- **OS**: Windows 10/11 (64-bit)
- **Processor**: Intel/AMD x64
- **RAM**: 2GB minimum (4GB recommended)
- **Storage**: 500MB available space
- **Dependencies**: Will be auto-installed

## Installation Steps

### Using NSIS Installer (Recommended)

1. **Download** `Formatica_1.0.0_x64-setup.exe`
2. **Right-click** and select **Run as Administrator** (recommended)
3. **Click Next** to start the installation wizard
4. **Choose Installation Directory** (default: `C:\Program Files\Formatica`)
5. **Click Install** and wait for completion (~2 minutes)
6. **Launch** - Check "Launch Formatica" to start immediately, or find it in Start Menu

### Using MSI Installer

1. **Download** `Formatica_1.0.0_x64_en-US.msi`
2. **Right-click** and select **Install** or double-click
3. **Follow** the Windows Installer wizard
4. **Complete** installation
5. **Launch** from Start Menu or Desktop shortcut

---

## First Run Setup

**On first launch, Formatica will:**

1. **Download yt-dlp** (~10 MB) - Used for media downloading
   - This is automatic and one-time only
   - Takes 1-2 minutes depending on internet speed

2. **Prompt for LibreOffice** - Optional for document conversion
   - If you need to convert Word/Excel files, install LibreOffice
   - It's free and takes ~5 minutes
   - You can skip this if you don't need document conversion

3. **Show Onboarding** - Brief introduction to features

After setup, Formatica is ready to use!

---

## Features Inside

### Media Processing
- **🎬 Convert Video** - MP4, MKV, MOV, AVI, WEBM, GIF
- **🗜️ Compress Video** - Reduce file size with custom quality settings
- **🎵 Extract Audio** - MP3, AAC, WAV, FLAC, from any video
- **⬇️ Download Media** - Save YouTube and other videos locally

### PDF Tools
- **📄 Convert Document** - DOCX, PDF, XLSX, ODT, PPTX, DOCX, TXT, HTML, RTF, CSV
- **🔗 Merge PDF** - Combine multiple PDFs into one
- **✂️ Split PDF** - Break PDFs by page count or ranges
- **🎨 Greyscale PDF** - Convert color PDFs to greyscale

### Image Processing
- **🖼️ Images to PDF** - Combine JPG, PNG, WEBP, BMP, TIFF into single PDF
- **🔄 Convert Image** - JPG, PNG, WEBP, GIF, BMP to/from any format

---

## Usage Tips

### Keyboard Shortcuts
- Press **Ctrl+?** for quick help
- Use drag-and-drop for all file inputs

### Output Folders
- First time you convert a file, you'll choose where to save results
- Formatica remembers your choice for next time
- Change output folder anytime by clicking "Browse"

### Privacy
- ✓ All processing happens **locally on your PC**
- ✓ No files uploaded to the cloud
- ✓ No tracking or telemetry
- ✓ Works completely offline (except media download feature)

---

## Dependency Management

**Formatica needs these to work:**
- **ffmpeg** - Video & audio processing
- **yt-dlp** - Media downloading (auto-installed)
- **LibreOffice** (optional) - Document conversion

If dependencies are missing, you'll see a ⚡ **Fix Now** button to install them automatically.

---

## Troubleshooting

### Issue: "ffmpeg not found"
**Solution**: Install ffmpeg manually from https://ffmpeg.org/download.html or the fix button in Formatica

### Issue: "LibreOffice not found" (document conversion)
**Solution**: Download and install from https://www.libreoffice.org/download/ or use the link in the app alert

### Issue: "yt-dlp failed to download"
**Solution**:
1. Click the ⚡ **Fix Now** button
2. Or install yt-dlp manually from https://github.com/yt-dlp/yt-dlp

### Issue: Video conversion is slow
**Solution**:
- Use lower resolution or higher CRF value
- Let it complete - the app doesn't freeze, it's just processing
- Temporarily close other apps to free up CPU

### Still having issues?
- Check the dependency ribbon at the top
- Ensure all dependencies are installed (green dots)
- Restart Formatica
- Re-install if problems persist

---

## Updating Formatica

To update in the future:
1. Download the new installer
2. Run the new installer - it will automatically update
3. Your settings and history are preserved

---

## Uninstalling

### Windows:
1. **Windows 11/10**: Settings → Apps → Apps & features
2. Search for "Formatica"
3. Click and select **Uninstall**
4. Confirm removal

Or use the installer:
1. Run `Formatica_1.0.0_x64-setup.exe`
2. Click **Uninstall**
3. Confirm

---

## Performance Tips

1. **For faster conversions**:
   - Use lower target resolution
   - Close heavy applications
   - Don't use high quality + small file size together

2. **For best quality**:
   - Use "High" quality settings
   - Keep files as close to original format as possible

3. **For smallest files**:
   - Increase compression level (CRF value for video)
   - Use lossy formats (MP3 instead of WAV)
   - Reduce resolution/dimensions

---

## Version Info

- **Application**: Formatica v1.0.0
- **Built**: April 2026
- **Platform**: Windows 64-bit
- **License**: Proprietary
- **Status**: Production Ready

---

## Support

If you encounter any issues:
1. Check this guide first
2. Verify all dependencies are installed
3. Restart the application
4. Reinstall if problems persist

---

**Ready to convert? Launch Formatica and start using it right now!** 🚀

All processing is local, fast, and private. Enjoy!
