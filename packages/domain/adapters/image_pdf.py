from pathlib import Path
from typing import List, Tuple

def images_to_pdf(image_paths: List[str | Path], output_path: str | Path) -> Tuple[bool, str, str]:
    try:
        from PIL import Image
        
        if not image_paths:
            return False, "", "Need at least one image when converting to PDF."
            
        rgb_frames = []
        for img_path in image_paths:
            img_path = Path(img_path)
            if not img_path.exists():
                return False, "", f"Image not found: {img_path}"
            with Image.open(img_path) as img:
                rgb_frames.append(img.convert("RGB").copy())
                
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        rgb_frames[0].save(output_path, save_all=True, append_images=rgb_frames[1:])
        return True, str(output_path), ""
    except Exception as e:
        return False, "", str(e)
