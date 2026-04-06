import sys
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

def apply_watermark(input_path: str, output_path: str, text: str, font_size: int, opacity: int, color: str, position: str) -> dict:
    try:
        # Load image
        img = Image.open(input_path).convert("RGBA")
        width, height = img.size
        
        # Create an overlay for the watermark
        overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        
        # Load font (try common Windows font first, then fallback)
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
            
        # Get text size
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        
        # Calculate position
        x, y = 0, 0
        if position == 'TL': x, y = 20, 20
        elif position == 'TC': x, y = (width - tw) // 2, 20
        elif position == 'TR': x, y = width - tw - 20, 20
        elif position == 'ML': x, y = 20, (height - th) // 2
        elif position == 'C':  x, y = (width - tw) // 2, (height - th) // 2
        elif position == 'MR': x, y = width - tw - 20, (height - th) // 2
        elif position == 'BL': x, y = 20, height - th - 20
        elif position == 'BC': x, y = (width - tw) // 2, height - th - 20
        elif position == 'BR': x, y = width - tw - 20, height - th - 20
        else: x, y = (width - tw) // 2, (height - th) // 2 # default center
        
        # Set color with opacity
        alpha = int(255 * (opacity / 100))
        fill_color = (255, 255, 255, alpha) if color.lower() == "white" else (0, 0, 0, alpha)
        
        # Draw the text
        draw.text((x, y), text, font=font, fill=fill_color)
        
        # Composite and save as PNG (required for opacity)
        out = Image.alpha_composite(img, overlay)
        
        # Ensure output directory exists
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        out.save(output_path, "PNG")
        
        return {"success": True, "output_path": output_path, "error_message": ""}
    except Exception as e:
        return {"success": False, "output_path": "", "error_message": str(e)}

if __name__ == "__main__":
    # Internal CLI for debugging if needed
    pass
