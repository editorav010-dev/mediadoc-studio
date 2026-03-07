import os
from pathlib import Path

def resolve_output_path(input_path: str, output_format: str, output_dir: str = None) -> str:
    """
    Given an input file, generate a clean output file path.
    Example: input=notes.docx, format=pdf → notes_converted.pdf
    """
    input = Path(input_path)
    directory = Path(output_dir) if output_dir else input.parent
    output_name = f"{input.stem}_converted.{output_format}"
    return str(directory / output_name)

def handle_naming_collision(output_path: str) -> str:
    """
    If the output file already exists, auto-append a number.
    Example: notes_converted.pdf → notes_converted_1.pdf
    """
    path = Path(output_path)
    counter = 1
    while path.exists():
        path = path.parent / f"{path.stem}_{counter}{path.suffix}"
        counter += 1
    return str(path)
