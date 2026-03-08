#!/usr/bin/env python3
"""
Media & Doc Studio — CLI
Usage: python -m packages.domain.cli [COMMAND] [OPTIONS]
"""

import click
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from pathlib import Path

console = Console()

# ─────────────────────────────────────────────
# ROOT COMMAND GROUP
# ─────────────────────────────────────────────

@click.group()
@click.version_option(version="0.1.0", prog_name="MediaDoc Studio")
def cli():
    """
    Media & Doc Studio — local file conversion and media download utility.

    Run any command with --help for details.

    Examples:\n
      python -m packages.domain.cli convert doc notes.docx --to pdf\n
      python -m packages.domain.cli convert audio interview.mp4 --to mp3\n
      python -m packages.domain.cli convert image scan1.jpg scan2.jpg --output report.pdf\n
      python -m packages.domain.cli download https://example.com/video --out ~/Downloads\n
      python -m packages.domain.cli doctor
    """
    pass


# ─────────────────────────────────────────────
# CONVERT GROUP
# ─────────────────────────────────────────────

@cli.group()
def convert():
    """Convert documents, audio files, or images to PDF."""
    pass


@convert.command("doc")
@click.argument("input_file", type=click.Path(exists=True))
@click.option("--to", "output_format", required=True,
              type=click.Choice(["pdf", "docx", "txt", "odt", "csv", "xlsx"]),
              help="Target format to convert to.")
@click.option("--out", "output_dir", default=None,
              type=click.Path(), help="Output directory. Defaults to same folder as input.")
def convert_doc(input_file, output_format, output_dir):
    """
    Convert a document to a different format.

    INPUT_FILE: Path to the document you want to convert.

    Supported input formats: DOCX, PDF, XLSX, CSV, TXT, ODT, RTF, PPTX

    Examples:\n
      python -m packages.domain.cli convert doc report.docx --to pdf\n
      python -m packages.domain.cli convert doc notes.odt --to docx --out ~/Desktop
    """
    from packages.domain.adapters.document import convert_document
    from packages.domain.utils.validators import is_doc_conversion_supported

    input_path = Path(input_file)
    input_fmt = input_path.suffix.lstrip(".").lower()

    if not is_doc_conversion_supported(input_fmt, output_format):
        console.print(f"[red]✗ Converting {input_fmt.upper()} → {output_format.upper()} is not supported.[/red]")
        from packages.domain.utils.validators import get_suggested_path
        suggestion = get_suggested_path(input_fmt, output_format)
        if suggestion:
            console.print(f"[yellow]💡 Suggestion: {suggestion}[/yellow]")
        raise SystemExit(1)

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"),
                  transient=True) as progress:
        progress.add_task(f"Converting {input_path.name} to {output_format.upper()}...", total=None)
        success, output_path, error = convert_document(input_file, output_format, output_dir)

    if success:
        console.print(f"[green]✓ Done![/green] Output saved to: [bold]{output_path}[/bold]")
    else:
        console.print(f"[red]✗ Conversion failed:[/red] {error}")
        raise SystemExit(1)


@convert.command("audio")
@click.argument("input_file", type=click.Path(exists=True))
@click.option("--to", "output_format", required=True,
              type=click.Choice(["mp3", "aac", "wav"]),
              help="Target audio format.")
@click.option("--bitrate", default="192k",
              type=click.Choice(["128k", "192k", "320k"]),
              help="Audio bitrate. Default: 192k. (Not used for WAV lossless.)")
@click.option("--out", "output_dir", default=None,
              type=click.Path(), help="Output directory.")
def convert_audio(input_file, output_format, bitrate, output_dir):
    """
    Extract or convert audio from a video or audio file.

    INPUT_FILE: Path to the video or audio file.

    Supported input formats: MP4, MKV, AVI, MOV, WEBM, FLV, MP3, WAV, FLAC, OGG, M4A

    Examples:\n
      python -m packages.domain.cli convert audio interview.mp4 --to mp3\n
      python -m packages.domain.cli convert audio podcast.wav --to aac --bitrate 128k
    """
    from packages.domain.adapters.audio import convert_to_audio

    input_path = Path(input_file)

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"),
                  transient=True) as progress:
        progress.add_task(f"Extracting audio from {input_path.name}...", total=None)
        success, output_path, error = convert_to_audio(
            input_file, output_format, bitrate, output_dir
        )

    if success:
        console.print(f"[green]✓ Done![/green] Audio saved to: [bold]{output_path}[/bold]")
    else:
        console.print(f"[red]✗ Conversion failed:[/red] {error}")
        raise SystemExit(1)


@convert.command("image")
@click.argument("input_files", nargs=-1, required=True, type=click.Path(exists=True))
@click.option("--output", "output_path", required=True,
              type=click.Path(), help="Full output path for the PDF (e.g. combined.pdf)")
def convert_image(input_files, output_path):
    """
    Combine one or more images into a single PDF.

    INPUT_FILES: One or more image paths. Order matters — first image = first page.

    Supported formats: JPG, PNG, WEBP, BMP, TIFF

    Examples:\n
      python -m packages.domain.cli convert image scan.jpg --output document.pdf\n
      python -m packages.domain.cli convert image p1.jpg p2.jpg p3.jpg --output combined.pdf
    """
    from packages.domain.adapters.image_pdf import images_to_pdf

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"),
                  transient=True) as progress:
        progress.add_task(f"Combining {len(input_files)} image(s) into PDF...", total=None)
        success, out_path, error = images_to_pdf(list(input_files), output_path)

    if success:
        console.print(f"[green]✓ Done![/green] PDF saved to: [bold]{out_path}[/bold]")
    else:
        console.print(f"[red]✗ Failed:[/red] {error}")
        raise SystemExit(1)


# ─────────────────────────────────────────────
# DOWNLOAD COMMAND
# ─────────────────────────────────────────────

@cli.command("download")
@click.argument("url")
@click.option("--out", "output_dir", required=True,
              type=click.Path(), help="Directory to save the downloaded file.")
@click.option("--cookies", "cookies_path", default=None,
              type=click.Path(), help="Path to a Netscape cookies.txt file for authenticated downloads.")
def download(url, output_dir, cookies_path):
    """
    Download a video or audio file from a URL.

    URL: The full URL of the media to download.

    The downloader is intended for content you have the legal
    right to download (your own content, Creative Commons, etc.)

    Examples:\n
      python -m packages.domain.cli download https://example.com/video --out ~/Downloads\n
      python -m packages.domain.cli download https://example.com/video --out ~/Downloads --cookies cookies.txt
    """
    from packages.domain.adapters.downloader import download_media

    console.print(f"[cyan]↓ Starting download...[/cyan]")
    console.print(f"  URL: {url}")
    console.print(f"  Output: {output_dir}")

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"),
                  transient=True) as progress:
        progress.add_task("Downloading...", total=None)
        success, out_path, error = download_media(url, output_dir, cookies_path)

    if success:
        console.print(f"[green]✓ Downloaded![/green] File saved to: [bold]{out_path}[/bold]")
    else:
        console.print(f"[red]✗ Download failed:[/red] {error}")
        raise SystemExit(1)


# ─────────────────────────────────────────────
# DOCTOR COMMAND (dependency check)
# ─────────────────────────────────────────────

@cli.command("doctor")
def doctor():
    """
    Check that all required dependencies are installed.

    Checks for: LibreOffice (soffice), ffmpeg, yt-dlp

    Run this first if any conversions are failing.

    Example:\n
      python -m packages.domain.cli doctor
    """
    from packages.domain.utils.dependency_check import check_dependencies
    import shutil
    import sys

    console.print("\n[bold]Media & Doc Studio — Dependency Check[/bold]\n")

    # In a real app we'd map results to 'Dep' class
    # Simplified here to just show checking dependencies based on function output
    
    missing = []
    dependencies = {
        "ffmpeg": {"installed": bool(shutil.which("ffmpeg"))},
        "LibreOffice": {"installed": False},
        "yt-dlp": {"installed": False}
    }
    
    try:
        from packages.domain.adapters.document import find_soffice
        find_soffice()
        dependencies["LibreOffice"]["installed"] = True
    except Exception:
        pass

    try:
        import yt_dlp
        dependencies["yt-dlp"]["installed"] = True
    except ImportError:
        pass

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Dependency", style="bold")
    table.add_column("Status")
    table.add_column("Version")
    table.add_column("Install Command")

    all_good = True

    for name, data in dependencies.items():
        if data["installed"]:
            status = "[green][OK][/green] Installed"
            version = "—"
            install = "—"
        else:
            status = "[red][X][/red] Missing"
            version = "—"
            install = "[yellow]Please install via appropriate package manager[/yellow]" 
            all_good = False

        table.add_row(name, status, version, install)

    console.print(table)

    if all_good:
        console.print("\n[green][OK] All dependencies found. You're good to go![/green]\n")
    else:
        console.print("\n[red][X] Some dependencies are missing.[/red]")
        console.print("Install them using the commands above, then run [bold]doctor[/bold] again.\n")
        raise SystemExit(1)


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    cli()
