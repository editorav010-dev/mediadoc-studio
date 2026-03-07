from unittest.mock import patch, MagicMock
from packages.domain.adapters.audio import convert_to_audio

def test_successful_conversion(tmp_path):
    """Happy path: ffmpeg runs and returns exit code 0"""
    fake_input = tmp_path / "test.mp4"
    fake_input.write_text("fake content")
    
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stderr="")
        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            # The function checks if output_path exists; we need to mock or create it.
            output_path_expected = tmp_path / "test.mp3"
            output_path_expected.write_text("fake output")
            
            success, output_path, error = convert_to_audio(
                str(fake_input), "mp3", "192k", str(tmp_path)
            )
    assert success == True
    assert error == ""

def test_missing_dependency(tmp_path):
    """ffmpeg not found — should return false with error, not crash"""
    fake_input = tmp_path / "test.mp4"
    fake_input.write_text("fake content")

    with patch("shutil.which", return_value=None):
        success, output_path, error = convert_to_audio(
            str(fake_input), "mp3", "192k", str(tmp_path)
        )
    assert success == False
    assert "FFmpeg is not available on PATH" in error

def test_conversion_failure(tmp_path):
    """ffmpeg returns non-zero exit code"""
    fake_input = tmp_path / "test.mp4"
    fake_input.write_text("fake content")

    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = Exception("ffmpeg error")
        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            success, output_path, error = convert_to_audio(
                str(fake_input), "mp3", "192k", str(tmp_path)
            )
    assert success == False
    assert "ffmpeg error" in error
