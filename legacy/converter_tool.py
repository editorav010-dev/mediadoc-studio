#!/usr/bin/env python3
"""
Quick bridge for local conversions between images, PDFs, and LibreOffice-friendly formats.

Examples:
  python converter_tool.py --to pdf --combine-images --output Downloads/merged.pdf \
                            Screenshots/*.png
  python converter_tool.py --to pdf Documents/notes.docx
  python converter_tool.py --to docx --outdir exports PDF/handout.pdf
  python converter_tool.py --gui
"""

from __future__ import annotations

import argparse
import queue
import subprocess
import threading
import shutil
import sys
from pathlib import Path
from typing import Callable, Iterable, Sequence, List, Optional

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except ImportError:  # pragma: no cover - UI optional
    tk = None  # type: ignore

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".tif", ".webp"}
DEFAULT_LIBREOFFICE = Path(r"C:/Program Files/LibreOffice/program/soffice.exe")
THEME_BG = "#030712"
THEME_SECONDARY = "#0f172a"
ACCENT_COLOR = "#38bdf8"
TEXT_COLOR = "#e2e8f0"
CARD_BORDER = "#1e293b"


class ConversionError(Exception):
    pass


def find_soffice(explicit: Path | None) -> Path:
    candidates: List[Path] = []
    if explicit:
        candidates.append(explicit)
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
    raise ConversionError("LibreOffice (`soffice`) executable not found.")


def convert_images_to_pdf(images: Sequence[Path], output: Path) -> Path:
    from PIL import Image

    if len(images) == 0:
        raise ConversionError("Need at least one image when converting to PDF.")

    rgb_frames = []
    for image_path in images:
        with Image.open(image_path) as img:
            rgb_frames.append(img.convert("RGB"))

    output.parent.mkdir(parents=True, exist_ok=True)
    rgb_frames[0].save(output, save_all=True, append_images=rgb_frames[1:])
    return output


def convert_with_soffice(
    files: Iterable[Path],
    target_ext: str,
    outdir: Path,
    soffice_path: Path,
    status_callback: Callable[[str], None] | None = None,
) -> List[Path]:
    outdir.mkdir(parents=True, exist_ok=True)
    converted = []
    for file_path in files:
        if not file_path.exists():
            raise ConversionError(f"Input not found: {file_path}")
        if status_callback:
            status_callback(f"LibreOffice converting {file_path.name} → .{target_ext}")
        subprocess.run(
            [
                str(soffice_path),
                "--headless",
                "--invisible",
                "--nologo",
                "--convert-to",
                target_ext,
                "--outdir",
                str(outdir),
                str(file_path),
            ],
            check=True,
        )
        converted.append(outdir / f"{file_path.stem}.{target_ext}")
    return converted


def handle_conversion(
    inputs: Sequence[Path],
    target: str,
    combine_images: bool = False,
    output: Path | None = None,
    outdir: Path | None = None,
    soffice_path: Path | None = None,
    dry_run: bool = False,
    status_callback: Callable[[str], None] | None = None,
) -> List[Path]:
    target = target.lower().lstrip(".")
    if not inputs:
        raise ConversionError("At least one input file is required.")

    if status_callback:
        status_callback(f"Preparing {len(inputs)} file(s) for {target.upper()} conversion")

    normalized_inputs = [Path(p) for p in inputs]
    image_inputs = [p for p in normalized_inputs if p.suffix.lower() in IMAGE_EXTS]
    non_image_inputs = [p for p in normalized_inputs if p.suffix.lower() not in IMAGE_EXTS]

    outdir = (outdir or Path.cwd()).expanduser()
    detected_soffice: Path | None
    try:
        detected_soffice = find_soffice(soffice_path)
    except ConversionError:
        detected_soffice = None
        if target != "pdf" or combine_images:
            raise

    if target == "pdf" and combine_images:
        if not image_inputs:
            raise ConversionError("--combine-images requires at least one image input.")
        if not output:
            raise ConversionError("--output is required when combining images.")
        if status_callback:
            status_callback(f"Combining {len(image_inputs)} image(s) into {output.name}")
        if dry_run:
            return [output]
        return [convert_images_to_pdf(image_inputs, output)]

    if target == "pdf" and image_inputs and not non_image_inputs:
        outputs: List[Path] = []
        if status_callback:
            status_callback(f"Converting {len(image_inputs)} image(s) to PDF")
        for image_path in image_inputs:
            dest = output or outdir / f"{image_path.stem}.pdf"
            if status_callback:
                status_callback(f"  {image_path.name} → {dest.name}")
            if dry_run:
                outputs.append(dest)
                continue
            outputs.append(convert_images_to_pdf([image_path], dest))
        return outputs

    if not detected_soffice:
        raise ConversionError("LibreOffice (`soffice`) is required for this conversion.")

    converted: List[Path] = []
    if dry_run:
        if non_image_inputs:
            converted.extend(outdir / f"{p.stem}.{target}" for p in non_image_inputs)
        if image_inputs:
            converted.extend(outdir / f"{p.stem}.{target}" for p in image_inputs)
        return converted

    if non_image_inputs:
        converted.extend(
            convert_with_soffice(
                non_image_inputs,
                target,
                outdir,
                detected_soffice,
                status_callback,
            )
        )
    if image_inputs:
        converted.extend(
            convert_with_soffice(
                image_inputs,
                target,
                outdir,
                detected_soffice,
                status_callback,
            )
        )

    return converted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert common file types between images, PDFs, and LibreOffice formats."
    )
    parser.add_argument(
        "--to",
        required=False,
        help="Target extension (`pdf`, `docx`, `xlsx`, `csv`, `txt`, etc.). Required unless --gui is used.",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        help="Single output file (required when combining images).",
    )
    parser.add_argument(
        "--outdir",
        "-d",
        type=Path,
        default=Path.cwd(),
        help="Directory to drop converted files (default: current working dir).",
    )
    parser.add_argument(
        "--combine-images",
        action="store_true",
        help="When converting multiple images to PDF, keep them in a single document.",
    )
    parser.add_argument(
        "--soffice-path",
        type=Path,
        help="Explicit LibreOffice path if not on PATH.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Echo what would run without executing.",
    )
    parser.add_argument(
        "--gui",
        action="store_true",
        help="Launch the graphical converter interface.",
    )
    parser.add_argument("inputs", nargs="*", type=Path)
    return parser.parse_args()


TARGET_OPTIONS = ["pdf", "docx", "xlsx", "csv", "txt", "odt", "rtf", "pptx"]


class ConverterGUI:
    def __init__(self):
        if tk is None:
            raise ConversionError("Tkinter is required for the GUI.")
        self.files: List[Path] = []
        self.root = tk.Tk()
        self.root.title("Easy Converter")
        self.root.geometry("720x520")
        self.root.columnconfigure(0, weight=1)
        self.style = ttk.Style(self.root)
        self._apply_theme()
        self.target_var = tk.StringVar(value="pdf")
        self.combine_var = tk.BooleanVar(value=False)
        self.output_var = tk.StringVar()
        self.outdir_var = tk.StringVar(value=str(Path.home() / "Downloads"))
        self.soffice_var = tk.StringVar()
        self._worker_thread: threading.Thread | None = None
        self._worker_queue: queue.Queue = queue.Queue()
        self._media_thread: threading.Thread | None = None
        self._media_queue: queue.Queue = queue.Queue()
        self.active_tab = "doc"
        self.build_ui()
        self.root.after(200, self._poll_worker_queue)
        self.root.after(200, self._poll_media_queue)

    def _apply_theme(self):
        self.root.configure(bg=THEME_BG)
        try:
            self.style.theme_use("clam")
        except tk.TclError:
            pass
        self.style.configure(
            "Dark.TLabelframe",
            background=THEME_SECONDARY,
            borderwidth=0,
            foreground=TEXT_COLOR,
        )
        self.style.configure("Dark.TLabel", background=THEME_SECONDARY, foreground=TEXT_COLOR)
        self.style.configure("Dark.TButton", background=THEME_SECONDARY, foreground=TEXT_COLOR)
        self.style.configure(
            "Accent.TButton",
            background=ACCENT_COLOR,
            foreground="#030712",
            focusthickness=0,
        )
        self.style.configure(
            "Dark.TEntry",
            fieldbackground=THEME_BG,
            background=THEME_BG,
            foreground=TEXT_COLOR,
        )
        self.style.configure("Dark.TCombobox", fieldbackground=THEME_BG, foreground=TEXT_COLOR)
        self.style.configure("Dark.TCheckbutton", background=THEME_SECONDARY, foreground=TEXT_COLOR)
        self.style.map(
            "Accent.TButton",
            background=[("active", "#60a5fa")],
            foreground=[("active", "#030712")],
        )
        self.style.configure("Dark.TFrame", background=THEME_SECONDARY)
        self.style.configure("Dark.TSeparator", background=THEME_BG)
        self.style.configure(
            "Card.TFrame", background=THEME_SECONDARY, borderwidth=1, relief="flat"
        )

    def build_ui(self):
        main_frame = tk.Frame(self.root, bg=THEME_BG)
        main_frame.grid(row=0, column=0, sticky="nsew")
        self.root.rowconfigure(0, weight=1)
        self.root.columnconfigure(0, weight=1)

        header = tk.Frame(main_frame, bg=THEME_SECONDARY, pady=12, padx=16)
        header.grid(row=0, column=0, sticky="ew", padx=8, pady=(8, 4))
        header.grid_columnconfigure(0, weight=1)
        tk.Label(
            header,
            text="Media & Doc Studio",
            bg=THEME_SECONDARY,
            fg=ACCENT_COLOR,
            font=("Segoe UI", 18, "bold"),
        ).grid(row=0, column=0, sticky="w")
        tk.Label(
            header,
            text="Split workflows for downloads, local media handling, and document conversions.",
            bg=THEME_SECONDARY,
            fg=TEXT_COLOR,
            font=("Segoe UI", 10),
        ).grid(row=1, column=0, sticky="w")

        tab_frame = tk.Frame(main_frame, bg=THEME_BG)
        tab_frame.grid(row=1, column=0, sticky="ew", padx=8, pady=(0, 4))
        tab_frame.columnconfigure(0, weight=1)
        tab_frame.columnconfigure(1, weight=1)
        self.tab_buttons: dict[str, tk.Button] = {}
        self._create_tab_button(tab_frame, "media", "Media tools", 0, self._show_media_view)
        self._create_tab_button(tab_frame, "doc", "Doc tools", 1, self._show_doc_view)

        content_container = tk.Frame(main_frame, bg=THEME_BG)
        content_container.grid(row=2, column=0, sticky="nsew", padx=8, pady=8)
        main_frame.rowconfigure(2, weight=1)
        content_container.rowconfigure(0, weight=1)
        content_container.columnconfigure(0, weight=1)
        self.doc_view = tk.Frame(content_container, bg=THEME_BG)
        self.media_view = tk.Frame(content_container, bg=THEME_BG)
        for view in (self.doc_view, self.media_view):
            view.grid(row=0, column=0, sticky="nsew")

        self._build_doc_view()
        self._build_media_view()
        self._show_doc_view()

    def _create_tab_button(self, parent: tk.Frame, key: str, text: str, column: int, command: Callable[[], None]):
        btn = tk.Button(
            parent,
            text=text,
            command=command,
            relief="flat",
            bg=THEME_SECONDARY,
            fg=TEXT_COLOR,
            activebackground=ACCENT_COLOR,
            activeforeground="#030712",
            bd=0,
            pady=8,
        )
        btn.grid(row=0, column=column, sticky="ew", padx=(0, 4) if column == 0 else (4, 0))
        self.tab_buttons[key] = btn

    def _set_tab_active(self, key: str):
        self.active_tab = key
        for name, button in self.tab_buttons.items():
            if name == key:
                button.configure(bg=ACCENT_COLOR, fg="#030712")
            else:
                button.configure(bg=THEME_SECONDARY, fg=TEXT_COLOR)

    def _show_doc_view(self):
        self.doc_view.tkraise()
        self._set_tab_active("doc")

    def _show_media_view(self):
        self.media_view.tkraise()
        self._set_tab_active("media")

    def _build_doc_view(self):
        doc = self.doc_view
        doc.columnconfigure(0, weight=3)
        doc.columnconfigure(1, weight=2)
        doc.rowconfigure(1, weight=1)

        source_card, source_body = self._create_card(doc, "Source files", row=0, column=0, sticky="nsew")
        self.listbox = tk.Listbox(
            source_body,
            height=8,
            selectmode="extended",
            exportselection=False,
            bg=THEME_BG,
            fg=TEXT_COLOR,
            selectbackground=ACCENT_COLOR,
            selectforeground="#030712",
            highlightthickness=0,
            bd=0,
        )
        self.listbox.pack(fill="both", expand=True, padx=8, pady=(4, 8))
        btn_row = tk.Frame(source_body, bg=THEME_SECONDARY)
        btn_row.pack(fill="x", padx=8, pady=(0, 8))
        self.add_button = ttk.Button(
            btn_row, text="Add files", command=self.add_files, style="Dark.TButton"
        )
        self.add_button.pack(side="left", expand=True, fill="x", padx=(0, 4))
        self.remove_button = ttk.Button(
            btn_row, text="Remove", command=self.remove_selected, style="Dark.TButton"
        )
        self.remove_button.pack(side="left", expand=True, fill="x", padx=2)
        self.clear_button = ttk.Button(
            btn_row, text="Clear", command=self.clear_files, style="Dark.TButton"
        )
        self.clear_button.pack(side="left", expand=True, fill="x", padx=(2, 0))

        controls_card, controls_body = self._create_card(
            doc, "Conversion settings", row=0, column=1, sticky="nsew"
        )
        controls_card.columnconfigure(1, weight=1)
        ttk.Label(controls_body, text="Target format", style="Dark.TLabel").grid(
            row=0, column=0, sticky="w", padx=4, pady=4
        )
        self.target_combo = ttk.Combobox(
            controls_body,
            values=TARGET_OPTIONS,
            textvariable=self.target_var,
            state="normal",
            style="Dark.TCombobox",
        )
        self.target_combo.grid(row=0, column=1, sticky="ew", padx=4, pady=4)
        self.target_combo.bind("<<ComboboxSelected>>", lambda _: self.set_default_output())
        self.combine_checkbox = ttk.Checkbutton(
            controls_body,
            text="Combine images into single PDF",
            variable=self.combine_var,
            command=self.set_default_output,
            style="Dark.TCheckbutton",
        )
        self.combine_checkbox.grid(row=1, column=0, columnspan=2, sticky="w", padx=4, pady=4)
        ttk.Label(controls_body, text="Output file", style="Dark.TLabel").grid(
            row=2, column=0, sticky="w", padx=4, pady=4
        )
        self.output_entry = ttk.Entry(
            controls_body, textvariable=self.output_var, style="Dark.TEntry"
        )
        self.output_entry.grid(row=2, column=1, sticky="ew", padx=4, pady=4)
        self.choose_output_btn = ttk.Button(
            controls_body, text="Browse", command=self.choose_output, style="Dark.TButton"
        )
        self.choose_output_btn.grid(row=2, column=2, padx=4, pady=4)
        ttk.Label(controls_body, text="Output directory", style="Dark.TLabel").grid(
            row=3, column=0, sticky="w", padx=4, pady=4
        )
        self.outdir_entry = ttk.Entry(
            controls_body, textvariable=self.outdir_var, style="Dark.TEntry"
        )
        self.outdir_entry.grid(row=3, column=1, sticky="ew", padx=4, pady=4)
        self.choose_outdir_btn = ttk.Button(
            controls_body, text="Browse", command=self.choose_outdir, style="Dark.TButton"
        )
        self.choose_outdir_btn.grid(row=3, column=2, padx=4, pady=4)
        ttk.Label(controls_body, text="LibreOffice (optional)", style="Dark.TLabel").grid(
            row=4, column=0, sticky="w", padx=4, pady=4
        )
        self.soffice_entry = ttk.Entry(
            controls_body, textvariable=self.soffice_var, style="Dark.TEntry"
        )
        self.soffice_entry.grid(row=4, column=1, sticky="ew", padx=4, pady=4)
        self.choose_soffice_btn = ttk.Button(
            controls_body, text="Locate", command=self.choose_soffice, style="Dark.TButton"
        )
        self.choose_soffice_btn.grid(row=4, column=2, padx=4, pady=4)
        self.convert_button = ttk.Button(
            controls_body, text="Convert now", command=self.run_conversion, style="Accent.TButton"
        )
        self.convert_button.grid(row=5, column=0, columnspan=3, pady=(10, 4), padx=4, sticky="ew")

        status_card, status_body = self._create_card(
            doc, "Live activity", row=1, column=0, columnspan=2, sticky="nsew"
        )
        self.status_text = tk.Text(
            status_body,
            height=9,
            state="disabled",
            bg=THEME_SECONDARY,
            fg=TEXT_COLOR,
            insertbackground=TEXT_COLOR,
            relief="flat",
            bd=0,
            highlightthickness=0,
        )
        self.status_text.pack(fill="both", expand=True, padx=8, pady=8)

        self._toggle_widgets = [
            self.add_button,
            self.remove_button,
            self.clear_button,
            self.combine_checkbox,
            self.choose_output_btn,
            self.choose_outdir_btn,
            self.choose_soffice_btn,
            self.output_entry,
            self.outdir_entry,
            self.soffice_entry,
        ]
        self.set_default_output()

    def _build_media_view(self):
        media = self.media_view
        media.columnconfigure(0, weight=1)
        media.rowconfigure(1, weight=1)

        download_card, download_body = self._create_card(
            media, "Media downloader", row=0, column=0, sticky="nsew"
        )
        download_body.columnconfigure(1, weight=1)
        ttk.Label(
            download_body,
            text="Paste an internet video URL (YouTube, Instagram, etc.)",
            style="Dark.TLabel",
        ).grid(row=0, column=0, columnspan=3, sticky="w", padx=4, pady=4)
        self.media_url_var = tk.StringVar()
        self.media_url_entry = ttk.Entry(
            download_body, textvariable=self.media_url_var, style="Dark.TEntry"
        )
        self.media_url_entry.grid(row=1, column=0, columnspan=2, sticky="ew", padx=4, pady=4)
        paste_btn = ttk.Button(
            download_body,
            text="Paste clipboard",
            command=self._paste_media_url,
            style="Dark.TButton",
        )
        paste_btn.grid(row=1, column=2, sticky="ew", padx=4, pady=4)

        self.use_js_runtime_var = tk.BooleanVar(value=True)
        js_frame = tk.Frame(download_body, bg=THEME_SECONDARY)
        js_frame.grid(row=2, column=0, columnspan=3, sticky="ew", padx=4, pady=2)
        self.js_check = ttk.Checkbutton(
            js_frame,
            text="Use JS runtime",
            variable=self.use_js_runtime_var,
            style="Dark.TCheckbutton",
        )
        self.js_check.pack(side="left", padx=(0, 4))
        self.js_runtime_var = tk.StringVar(value="deno")
        self.js_runtime_entry = ttk.Entry(
            js_frame, textvariable=self.js_runtime_var, width=16, style="Dark.TEntry"
        )
        self.js_runtime_entry.pack(side="left", padx=(0, 4))
        tk.Label(
            js_frame, text="(ex: deno)", bg=THEME_SECONDARY, fg=TEXT_COLOR, font=("Segoe UI", 8)
        ).pack(side="left")

        self.download_button = ttk.Button(
            download_body,
            text="Download video",
            command=self._download_media,
            style="Accent.TButton",
        )
        self.download_button.grid(row=3, column=0, columnspan=3, sticky="ew", padx=4, pady=4)

        cookies_frame = tk.Frame(download_body, bg=THEME_SECONDARY)
        cookies_frame.grid(row=4, column=0, columnspan=3, sticky="ew", padx=4, pady=2)
        self.use_browser_cookies_var = tk.BooleanVar(value=False)
        self.cookie_check = ttk.Checkbutton(
            cookies_frame,
            text="Use browser cookies (Chrome)",
            variable=self.use_browser_cookies_var,
            style="Dark.TCheckbutton",
        )
        self.cookie_check.pack(side="left", padx=(0, 6))
        tk.Label(
            cookies_frame,
            text="or custom file",
            bg=THEME_SECONDARY,
            fg=TEXT_COLOR,
            font=("Segoe UI", 8),
        ).pack(side="left", padx=(0, 4))
        self.cookies_path_var = tk.StringVar()
        self.cookies_entry = ttk.Entry(
            cookies_frame, textvariable=self.cookies_path_var, style="Dark.TEntry"
        )
        self.cookies_entry.pack(side="left", expand=True, fill="x", padx=(0, 4))
        self.cookies_browse_btn = ttk.Button(
            cookies_frame,
            text="Browse",
            command=self._browse_cookies,
            style="Dark.TButton",
        )
        self.cookies_browse_btn.pack(side="left")

        ttk.Label(
            download_body,
            text=f"Downloads folder: {Path.home()/ 'Downloads'}",
            style="Dark.TLabel",
        ).grid(row=5, column=0, columnspan=3, sticky="w", padx=4, pady=(0, 4))

        convert_card, convert_body = self._create_card(
            media, "Media conversions", row=1, column=0, sticky="nsew"
        )
        convert_body.columnconfigure(1, weight=1)
        ttk.Label(convert_body, text="Source media file", style="Dark.TLabel").grid(
            row=0, column=0, sticky="w", padx=4, pady=4
        )
        self.media_file_var = tk.StringVar()
        self.media_file_entry = ttk.Entry(
            convert_body, textvariable=self.media_file_var, style="Dark.TEntry"
        )
        self.media_file_entry.grid(row=0, column=1, sticky="ew", padx=4, pady=4)
        self.media_browse_button = ttk.Button(
            convert_body,
            text="Browse",
            command=self._browse_media_file,
            style="Dark.TButton",
        )
        self.media_browse_button.grid(row=0, column=2, sticky="ew", padx=4, pady=4)
        ttk.Label(convert_body, text="Target format", style="Dark.TLabel").grid(
            row=1, column=0, sticky="w", padx=4, pady=4
        )
        self.media_format_var = tk.StringVar(value="mp3")
        self.media_format_combo = ttk.Combobox(
            convert_body,
            values=["mp3", "aac", "wav"],
            textvariable=self.media_format_var,
            state="readonly",
            style="Dark.TCombobox",
        )
        self.media_format_combo.grid(row=1, column=1, sticky="ew", padx=4, pady=4)
        self.media_convert_button = ttk.Button(
            convert_body,
            text="Convert to audio",
            command=self._start_media_conversion,
            style="Accent.TButton",
        )
        self.media_convert_button.grid(
            row=2, column=0, columnspan=3, sticky="ew", padx=4, pady=(8, 4)
        )

        self.media_controls = [
            self.media_url_entry,
            self.media_file_entry,
            self.media_format_combo,
            self.media_browse_button,
            self.js_check,
            self.js_runtime_entry,
            self.cookies_entry,
            self.cookies_browse_btn,
            paste_btn,
        ]

    def _paste_media_url(self):
        try:
            text = self.root.clipboard_get().strip()
        except tk.TclError:
            return
        if text:
            self.media_url_var.set(text)

    def _browse_cookies(self):
        selected = filedialog.askopenfilename(title="Select cookies file")
        if selected:
            self.cookies_path_var.set(selected)

    def _download_media(self):
        url = self.media_url_var.get().strip()
        if not url:
            messagebox.showwarning("No URL", "Please paste a video link first.")
            return
        if self._media_thread and self._media_thread.is_alive():
            messagebox.showinfo("Busy", "Wait for the current media task to finish.")
            return
        self.log(f"Starting download: {url}")
        self._set_media_busy(True)
        self._media_thread = threading.Thread(
            target=self._media_worker,
            args=("download",),
            kwargs={
                "url": url,
                "use_js_runtime": self.use_js_runtime_var.get(),
                "js_runtime": self.js_runtime_var.get().strip(),
                "use_browser_cookies": self.use_browser_cookies_var.get(),
                "cookies_file": self.cookies_path_var.get().strip(),
            },
            daemon=True,
        )
        self._media_thread.start()

    def _start_media_conversion(self):
        file_path = Path(self.media_file_var.get().strip())
        if not file_path.exists():
            messagebox.showwarning("No file", "Choose a local media file before converting.")
            return
        if self._media_thread and self._media_thread.is_alive():
            messagebox.showinfo("Busy", "Wait for the current media task to finish.")
            return
        target_format = self.media_format_var.get()
        self.log(f"Converting {file_path.name} → .{target_format}")
        self._set_media_busy(True)
        self._media_thread = threading.Thread(
            target=self._media_worker,
            args=("convert",),
            kwargs={"file_path": file_path, "fmt": target_format},
            daemon=True,
        )
        self._media_thread.start()

    def _media_worker(self, task: str, **kwargs):
        try:
            if task == "download":
                downloads_dir = Path.home() / "Downloads"
                downloads_dir.mkdir(parents=True, exist_ok=True)
                output_template = str(downloads_dir / "%(title)s.%(ext)s")
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
                    kwargs["url"],
                ]
                if kwargs.get("use_js_runtime") and kwargs.get("js_runtime"):
                    args.extend(["--js-runtimes", kwargs["js_runtime"]])
                if kwargs.get("use_browser_cookies"):
                    args.extend(["--cookies-from-browser", "chrome"])
                else:
                    cookies_path = kwargs.get("cookies_file", "")
                    if cookies_path:
                        args.extend(["--cookies", cookies_path])
                subprocess.run(args, check=True)
                self._media_queue.put(("log", f"Video downloaded to {downloads_dir}"))
            elif task == "convert":
                ffmpeg_path = shutil.which("ffmpeg")
                if not ffmpeg_path:
                    raise ConversionError("FFmpeg is not available on PATH.")
                source = kwargs["file_path"]
                fmt = kwargs["fmt"]
                output = source.with_suffix(f".{fmt}")
                args = [
                    ffmpeg_path,
                    "-y",
                    "-i",
                    str(source),
                    "-vn",
                    "-hide_banner",
                    "-loglevel",
                    "warning",
                ]
                if fmt == "mp3":
                    args += ["-ab", "192k"]
                args.append(str(output))
                subprocess.run(args, check=True)
                self._media_queue.put(("log", f"Created {output.name}"))
        except subprocess.CalledProcessError as exc:
            self._media_queue.put(("error", str(exc)))
        except Exception as exc:
            self._media_queue.put(("error", str(exc)))
        finally:
            self._media_queue.put(("done", None))

    def _poll_media_queue(self):
        try:
            while True:
                msg_type, payload = self._media_queue.get_nowait()
                if msg_type == "log" and isinstance(payload, str):
                    self.log(payload)
                elif msg_type == "error" and isinstance(payload, str):
                    messagebox.showerror("Media task failed", payload)
                    self.log(f"ERROR: {payload}")
                    self._set_media_busy(False)
                    self._media_thread = None
                elif msg_type == "done":
                    self._set_media_busy(False)
                    self._media_thread = None
        except queue.Empty:
            pass
        finally:
            self.root.after(200, self._poll_media_queue)

    def _set_media_busy(self, busy: bool):
        state = "disabled" if busy else "normal"
        for widget in self.media_controls:
            widget.configure(state=state)
        self.download_button.configure(state=state)
        self.media_convert_button.configure(state=state)

    def _browse_media_file(self):
        selected = filedialog.askopenfilename(title="Select media file")
        if selected:
            self.media_file_var.set(selected)

    def add_files(self):
        paths = filedialog.askopenfilenames(title="Select source files")
        for path in paths:
            p = Path(path)
            if p not in self.files:
                self.files.append(p)
        self.refresh_listbox()

    def remove_selected(self):
        selections = list(self.listbox.curselection())
        for index in reversed(selections):
            self.files.pop(index)
        self.refresh_listbox()

    def clear_files(self):
        self.files.clear()
        self.refresh_listbox()

    def refresh_listbox(self):
        self.listbox.delete(0, tk.END)
        for path in self.files:
            self.listbox.insert(tk.END, str(path))

    def set_default_output(self):
        ext = self.target_var.get() or "pdf"
        target_ext = ext.lstrip(".")
        default_dir = Path(self.outdir_var.get() or Path.home() / "Downloads")
        default_file = default_dir / f"converted.{target_ext}"
        self.output_var.set(str(default_file))

    def choose_output(self):
        ext = self.target_var.get() or "pdf"
        target_ext = ext.lstrip(".")
        existing = self.output_var.get().strip()
        if existing:
            initial_file = Path(existing)
        else:
            initial_file = Path(self.outdir_var.get() or Path.home()) / f"converted.{target_ext}"
        selected = filedialog.asksaveasfilename(
            defaultextension=f".{target_ext}",
            initialfile=initial_file.name,
            initialdir=str(initial_file.parent),
        )
        if selected:
            self.output_var.set(selected)

    def choose_outdir(self):
        selected = filedialog.askdirectory(initialdir=self.outdir_var.get())
        if selected:
            self.outdir_var.set(selected)
            self.set_default_output()

    def choose_soffice(self):
        selected = filedialog.askopenfilename(title="Locate soffice executable")
        if selected:
            self.soffice_var.set(selected)

    def log(self, text: str):
        self.status_text.configure(state="normal")
        self.status_text.insert("end", text + "\n")
        self.status_text.see("end")
        self.status_text.configure(state="disabled")

    def _set_busy(self, busy: bool):
        state = "disabled" if busy else "normal"
        for widget in self._toggle_widgets:
            widget.configure(state=state)
        combo_state = "disabled" if busy else "normal"
        self.target_combo.configure(state=combo_state)
        self.listbox.configure(state="disabled" if busy else "normal")
        self.convert_button.configure(state=state)

    def run_conversion(self):
        if not self.files:
            messagebox.showwarning("No files", "Add at least one source file first.")
            return
        if self._worker_thread and self._worker_thread.is_alive():
            messagebox.showinfo("Conversion running", "Wait for the current conversion to finish.")
            return
        target = self.target_var.get().strip() or "pdf"
        combine = self.combine_var.get()
        outdir = Path(self.outdir_var.get() or Path.cwd())
        output = Path(self.output_var.get()) if self.output_var.get().strip() else None
        soffice_path = (
            Path(self.soffice_var.get()) if self.soffice_var.get().strip() else None
        )
        self.log(f"Starting conversion to {target.upper()}...")
        self._set_busy(True)
        self._worker_queue = queue.Queue()
        self._worker_thread = threading.Thread(
            target=self._conversion_worker,
            args=(list(self.files), target, combine, output, outdir, soffice_path, self._worker_queue),
            daemon=True,
        )
        self._worker_thread.start()

    def _conversion_worker(
        self,
        inputs: list[Path],
        target: str,
        combine: bool,
        output: Path | None,
        outdir: Path,
        soffice_path: Path | None,
        queue_ref: queue.Queue,
    ):
        try:
            outputs = handle_conversion(
                inputs=inputs,
                target=target,
                combine_images=combine,
                output=output,
                outdir=outdir,
                soffice_path=soffice_path,
                status_callback=lambda text: queue_ref.put(("log", text)),
            )
        except ConversionError as exc:
            queue_ref.put(("error", str(exc)))
            return
        except subprocess.CalledProcessError as exc:
            queue_ref.put(("error", str(exc)))
            return
        queue_ref.put(("result", outputs))

    def _poll_worker_queue(self):
        try:
            while True:
                msg_type, payload = self._worker_queue.get_nowait()
                if msg_type == "log" and isinstance(payload, str):
                    self.log(payload)
                elif msg_type == "error" and isinstance(payload, str):
                    messagebox.showerror("Conversion failed", payload)
                    self.log(f"ERROR: {payload}")
                    self._set_busy(False)
                    self._worker_thread = None
                elif msg_type == "result" and isinstance(payload, list):
                    self._handle_worker_result(payload)
        except queue.Empty:
            pass
        finally:
            self.root.after(200, self._poll_worker_queue)

    def _handle_worker_result(self, outputs: List[Path]):
        self._worker_thread = None
        self._set_busy(False)
        if outputs:
            messagebox.showinfo("Done", f"Converted {len(outputs)} file(s).")
            self.log(f"Converted {len(outputs)} file(s):")
            for path in outputs:
                self.log(f"  {path}")
        else:
            self.log("No files were converted.")

    def run(self):
        self.root.mainloop()

    def _create_card(self, parent, title, **grid_opts):
        frame = tk.Frame(parent, bg=THEME_SECONDARY, highlightbackground=CARD_BORDER, highlightthickness=1)
        frame.grid(padx=8, pady=8, **grid_opts)
        frame.columnconfigure(0, weight=1)
        label = tk.Label(
            frame,
            text=title,
            bg=THEME_SECONDARY,
            fg=ACCENT_COLOR,
            font=("Segoe UI", 10, "bold"),
        )
        label.grid(row=0, column=0, sticky="w", padx=8, pady=(4, 0))
        separator = ttk.Separator(frame, orient="horizontal", style="Dark.TSeparator")
        separator.grid(row=1, column=0, sticky="ew", padx=8, pady=4)
        body = tk.Frame(frame, bg=THEME_SECONDARY)
        body.grid(row=2, column=0, sticky="nsew", padx=8, pady=(0, 8))
        frame.rowconfigure(2, weight=1)
        return frame, body


def run_gui():
    gui = ConverterGUI()
    gui.run()


def main() -> int:
    args = parse_args()

    if args.gui:
        run_gui()
        return 0

    if not args.to:
        raise ConversionError("--to is required unless --gui is specified.")
    if not args.inputs:
        raise ConversionError("Provide at least one input file or use --gui.")

    converted = handle_conversion(
        inputs=args.inputs,
        target=args.to,
        combine_images=args.combine_images,
        output=args.output,
        outdir=args.outdir,
        soffice_path=args.soffice_path,
        dry_run=args.dry_run,
    )

    if not args.dry_run:
        for path in converted:
            print(path)
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ConversionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
