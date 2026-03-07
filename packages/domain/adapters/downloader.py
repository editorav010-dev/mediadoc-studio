import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple

def download_media(url: str, output_dir: str | Path, cookies_path: Optional[str | Path] = None) -> Tuple[bool, str, str]:
    try:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_template = str(output_dir / "%(title)s.%(ext)s")
        
        args = [
            sys.executable,
            "-m",
            "yt_dlp",
            "-f",
            "bv*+ba/b",
            "--merge-output-format",
            "mp4",
            "-o",
            output_template,
        ]
        
        if cookies_path:
            args.extend(["--cookies", str(cookies_path)])
            
        args.append(url)
        
        result = subprocess.run(args, capture_output=True, text=True)
        if result.returncode == 0:
            return True, str(output_dir), ""
        else:
            return False, "", result.stderr or result.stdout or "Unknown yt-dlp error"
    except Exception as e:
        return False, "", str(e)
