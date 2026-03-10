import subprocess
import shutil
from pathlib import Path
from typing import Tuple

DEFAULT_LIBREOFFICE = Path(r"C:/Program Files/LibreOffice/program/soffice.exe")

def find_soffice() -> Path:
    candidates = []
    candidate = shutil.which("soffice", path=str(Path.home() / "bin"))
    if candidate:
        candidates.append(Path(candidate))
    candidate = shutil.which("soffice")
    if candidate:
        candidates.append(Path(candidate))
    candidate = shutil.which("soffice.exe")
    if candidate:
        candidates.append(Path(candidate))
    candidates.append(DEFAULT_LIBREOFFICE)
    for path in candidates:
        if path and path.exists():
            return path
    raise RuntimeError("LibreOffice (`soffice`) executable not found.")

def convert_document(input_path: str | Path, output_format: str, output_dir: str | Path | None = None) -> Tuple[bool, str, str]:
    input_path = Path(input_path)
    try:
        if not input_path.exists():
            return False, "", f"Input not found: {input_path}"

        output_dir = Path(output_dir) if output_dir else input_path.parent
        
        soffice_path = find_soffice()
        output_dir.mkdir(parents=True, exist_ok=True)
        
        subprocess.run(
            [
                str(soffice_path),
                "--headless",
                "--invisible",
                "--nologo",
                "--convert-to",
                output_format,
                "--outdir",
                str(output_dir),
                str(input_path),
            ],
            check=True,
            capture_output=True,
            text=True
        )
        
        output_path = output_dir / f"{input_path.stem}.{output_format}"
        if output_path.exists():
            return True, str(output_path), ""
        else:
            return False, "", "Conversion succeeded but output file not found."
            
    except Exception as e:
        return False, "", str(e)
