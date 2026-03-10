from unittest.mock import patch, MagicMock
from packages.domain.adapters.downloader import download_media


def test_successful_download(tmp_path):
    """Happy path: yt-dlp runs and returns exit code 0."""
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")
        success, output_path, error = download_media(
            "https://example.com/video", str(tmp_path)
        )

    assert success is True
    assert error == ""


def test_download_failure(tmp_path):
    """yt-dlp returns non-zero exit code with stderr message."""
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(
            returncode=1, stderr="ERROR: Video unavailable", stdout=""
        )
        success, output_path, error = download_media(
            "https://example.com/video", str(tmp_path)
        )

    assert success is False
    assert "Video unavailable" in error


def test_download_with_cookies(tmp_path):
    """Cookies path should be passed as --cookies argument."""
    cookies_file = tmp_path / "cookies.txt"
    cookies_file.write_text("# Netscape cookies")

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stderr="", stdout="")
        download_media(
            "https://example.com/video", str(tmp_path), str(cookies_file)
        )

    call_args = mock_run.call_args[0][0]
    assert "--cookies" in call_args
    assert str(cookies_file) in call_args


def test_download_exception(tmp_path):
    """Unexpected exceptions should be caught and returned as errors."""
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = Exception("Network timeout")
        success, output_path, error = download_media(
            "https://example.com/video", str(tmp_path)
        )

    assert success is False
    assert "Network timeout" in error
