from click.testing import CliRunner
from packages.domain.cli import cli

runner = CliRunner()

# ── Help & Version ───────────────────────────────────────────────

def test_cli_help():
    result = runner.invoke(cli, ["--help"])
    assert result.exit_code == 0
    assert "convert" in result.output
    assert "download" in result.output
    assert "doctor" in result.output

def test_cli_version():
    result = runner.invoke(cli, ["--version"])
    assert result.exit_code == 0
    assert "0.1.0" in result.output

# ── Convert doc ──────────────────────────────────────────────────

def test_convert_doc_help():
    result = runner.invoke(cli, ["convert", "doc", "--help"])
    assert result.exit_code == 0
    assert "--to" in result.output

def test_convert_doc_unsupported_format(tmp_path):
    """PDF → XLSX is not supported. Should exit with error and suggestion."""
    fake_pdf = tmp_path / "test.pdf"
    fake_pdf.write_text("fake")
    result = runner.invoke(cli, [
        "convert", "doc", str(fake_pdf), "--to", "csv"
    ])
    # csv not in supported outputs for pdf — should fail
    assert result.exit_code != 0 or "not supported" in result.output.lower()

# ── Doctor ───────────────────────────────────────────────────────

def test_doctor_runs():
    """Doctor command should always run and show a table, never crash"""
    result = runner.invoke(cli, ["doctor"])
    assert "ffmpeg" in result.output or "LibreOffice" in result.output
    assert "yt-dlp" in result.output

# ── Download ─────────────────────────────────────────────────────

def test_download_requires_out(tmp_path):
    """Download without --out should show an error"""
    result = runner.invoke(cli, ["download", "https://example.com"])
    assert result.exit_code != 0

def test_download_help():
    result = runner.invoke(cli, ["download", "--help"])
    assert result.exit_code == 0
    assert "--out" in result.output
    assert "--cookies" in result.output
