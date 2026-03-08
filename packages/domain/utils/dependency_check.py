import shutil
import sys
from pathlib import Path
from packages.domain.adapters.document import find_soffice

def check_dependencies():
    """Checks if all required external tools are installed."""
    missing = []
    
    # Check FFmpeg
    if not shutil.which("ffmpeg"):
        missing.append("ffmpeg")
        
    # Check LibreOffice
    try:
        find_soffice()
    except Exception:
        missing.append("soffice")
        
    # Check yt-dlp
    try:
        import yt_dlp
    except ImportError:
        missing.append("yt-dlp")
        
    if missing:
        print(f"Warning: The following dependencies are missing: {', '.join(missing)}")
        print("Some features may be disabled.")
        return False
        
    print("All external dependencies found.")
    return True

if __name__ == "__main__":
    check_dependencies()
