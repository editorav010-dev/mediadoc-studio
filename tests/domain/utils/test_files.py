import pytest
from pathlib import Path
from packages.domain.utils.files import resolve_output_path, handle_naming_collision

def test_resolve_output_path_basic():
    input_path = "document.docx"
    output_format = "pdf"
    
    result = resolve_output_path(input_path, output_format)
    assert result.endswith("document_converted.pdf")

def test_resolve_output_path_with_dir(tmp_path):
    input_path = "document.docx"
    output_format = "pdf"
    
    result = resolve_output_path(input_path, output_format, str(tmp_path))
    assert str(tmp_path) in result
    assert result.endswith("document_converted.pdf")

def test_handle_naming_collision_no_collision(tmp_path):
    output_path = tmp_path / "document_converted.pdf"
    
    result = handle_naming_collision(str(output_path))
    assert result == str(output_path)

def test_handle_naming_collision_adds_number(tmp_path):
    output_path = tmp_path / "document_converted.pdf"
    output_path.write_text("content")
    
    result = handle_naming_collision(str(output_path))
    assert result == str(tmp_path / "document_converted_1.pdf")