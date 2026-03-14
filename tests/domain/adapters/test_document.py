from unittest.mock import patch, MagicMock
from packages.domain.adapters.document import convert_document


def test_successful_conversion(tmp_path):
    """Happy path: soffice runs and produces an output file."""
    fake_input = tmp_path / "report.docx"
    fake_input.write_text("fake content")
    output_dir = tmp_path / "output"

    with patch("packages.domain.adapters.document.find_soffice") as mock_find:
        mock_find.return_value = "/usr/bin/soffice"
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            # Simulate LibreOffice creating the output file
            output_dir.mkdir(parents=True, exist_ok=True)
            expected_output = output_dir / "report.pdf"
            expected_output.write_text("pdf content")

            success, output_path, error = convert_document(
                str(fake_input), "pdf", str(output_dir)
            )

    assert success is True
    assert error == ""
    assert "report.pdf" in output_path


def test_file_not_found(tmp_path):
    """Should return error when input file doesn't exist."""
    success, output_path, error = convert_document(
        str(tmp_path / "nonexistent.docx"), "pdf", str(tmp_path)
    )
    assert success is False
    assert "Input not found" in error


def test_soffice_not_found(tmp_path):
    """Should return error when LibreOffice is not installed."""
    fake_input = tmp_path / "report.docx"
    fake_input.write_text("fake content")

    with patch("packages.domain.adapters.document.find_soffice") as mock_find:
        mock_find.side_effect = RuntimeError("LibreOffice (`soffice`) executable not found.")
        success, output_path, error = convert_document(
            str(fake_input), "pdf", str(tmp_path)
        )

    assert success is False
    assert "LibreOffice" in error


def test_output_dir_defaults_to_parent(tmp_path):
    """When output_dir is None, should use the input file's parent."""
    fake_input = tmp_path / "report.docx"
    fake_input.write_text("fake content")

    with patch("packages.domain.adapters.document.find_soffice") as mock_find:
        mock_find.return_value = "/usr/bin/soffice"
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            expected_output = tmp_path / "report.pdf"
            expected_output.write_text("pdf content")

            success, output_path, error = convert_document(
                str(fake_input), "pdf", None
            )

    assert success is True
    assert str(tmp_path) in output_path
