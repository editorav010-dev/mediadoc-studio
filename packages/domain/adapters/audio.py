import subprocess
import shutil
from pathlib import Path
from typing import Tuple

def convert_to_audio(input_path: str | Path, output_format: str, bitrate: str, output_dir: str | Path | None = None) -> Tuple[bool, str, str]:
    input_path = Path(input_path)
    
    try:
        ffmpeg_path = shutil.which("ffmpeg")
        if not ffmpeg_path:
            return False, "", "FFmpeg is not available on PATH."
            
        if not input_path.exists():
            return False, "", f"Input not found: {input_path}"

        output_dir = Path(output_dir) if output_dir else input_path.parent
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{input_path.stem}.{output_format}"
        
        args = [
            ffmpeg_path,
            "-y",
            "-i",
            str(input_path),
            "-vn",
            "-hide_banner",
            "-loglevel",
            "warning",
        ]
        
        if output_format.lower() in ("mp3", "aac") and bitrate:
            args += ["-ab", bitrate]
            
        args.append(str(output_path))
        
        subprocess.run(args, check=True, capture_output=True, text=True)
        
        if output_path.exists():
            return True, str(output_path), ""
        else:
            return False, "", "Conversion succeeded but output file not found."
            
    except Exception as e:
        return False, "", str(e)
