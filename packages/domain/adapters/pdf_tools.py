import sys
from pathlib import Path

def merge_pdfs(input_paths: list[str], output_path: str) -> dict:
    try:
        from pypdf import PdfWriter, PdfReader
        writer = PdfWriter()
        for path in input_paths:
            reader = PdfReader(path)
            for page in reader.pages:
                writer.add_page(page)
        with open(output_path, "wb") as f:
            writer.write(f)
        return {"success": True, "output_path": output_path, "error_message": ""}
    except Exception as e:
        return {"success": False, "output_path": "", "error_message": str(e)}

def split_pdf(input_path: str, output_dir: str, mode: str, value: str) -> dict:
    try:
        from pypdf import PdfReader, PdfWriter
        reader = PdfReader(input_path)
        total = len(reader.pages)
        stem = Path(input_path).stem
        output_files = []

        if mode == "count":
            n = int(value)
            chunk = 0
            for start in range(0, total, n):
                chunk += 1
                writer = PdfWriter()
                for i in range(start, min(start + n, total)):
                    writer.add_page(reader.pages[i])
                out = str(Path(output_dir) / f"{stem}_part{chunk}.pdf")
                with open(out, "wb") as f:
                    writer.write(f)
                output_files.append(out)

        elif mode == "ranges":
            for idx, rng in enumerate(value.split(",")):
                rng = rng.strip()
                writer = PdfWriter()
                if "-" in rng:
                    parts = rng.split("-")
                    start = int(parts[0].strip()) - 1
                    end = int(parts[1].strip()) if parts[1].strip() != "end" else total
                else:
                    start = int(rng) - 1
                    end = int(rng)
                for i in range(start, min(end, total)):
                    writer.add_page(reader.pages[i])
                out = str(Path(output_dir) / f"{stem}_pages{rng.replace('','')}.pdf")
                with open(out, "wb") as f:
                    writer.write(f)
                output_files.append(out)

        return {"success": True, "output_path": output_dir,
                "error_message": f"Created {len(output_files)} files"}
    except Exception as e:
        return {"success": False, "output_path": "", "error_message": str(e)}

def greyscale_pdf(input_path: str, output_path: str) -> dict:
    try:
        import fitz  # PyMuPDF
        
        doc = fitz.open(input_path)
        out_pdf = fitz.open()
        
        for page in doc:
            # Render page to a greyscale pixmap
            # dpi=150 gives a good balance of quality and file size
            pix = page.get_pixmap(colorspace=fitz.csGRAY, dpi=150)
            
            # Create a new page with the same dimensions
            new_page = out_pdf.new_page(width=page.rect.width, height=page.rect.height)
            
            # Insert the greyscale image into the new PDF page
            new_page.insert_image(page.rect, stream=pix.tobytes("jpeg"))
            
        out_pdf.save(output_path, deflate=True)
        out_pdf.close()
        doc.close()
        
        return {"success": True, "output_path": output_path, "error_message": ""}
    except ImportError:
        return {"success": False, "output_path": "", "error_message": "PyMuPDF (fitz) is required for greyscale conversion. Please run: pip install pymupdf"}
    except Exception as e:
        return {"success": False, "output_path": "", "error_message": str(e)}
