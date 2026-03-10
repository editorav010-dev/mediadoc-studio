import pytest
from unittest.mock import patch, MagicMock
from packages.domain.utils.dependency_check import check_dependencies

@patch("packages.domain.utils.dependency_check.shutil.which")
@patch("packages.domain.utils.dependency_check.find_soffice")
def test_all_dependencies_found(mock_find_soffice, mock_which):
    """When all dependencies exist, check_dependencies returns True."""
    mock_which.return_value = "/usr/bin/ffmpeg"
    mock_find_soffice.return_value = "/usr/bin/soffice"
    with patch.dict('sys.modules', {'yt_dlp': MagicMock()}):
        assert check_dependencies() is True

@patch("packages.domain.utils.dependency_check.shutil.which")
@patch("packages.domain.utils.dependency_check.find_soffice")
def test_missing_ffmpeg(mock_find_soffice, mock_which, capsys):
    """When ffmpeg is missing, return False and print it."""
    mock_which.return_value = None
    mock_find_soffice.return_value = "/usr/bin/soffice"
    
    assert check_dependencies() is False
    captured = capsys.readouterr()
    assert "ffmpeg" in captured.out

@patch("packages.domain.utils.dependency_check.shutil.which")
@patch("packages.domain.utils.dependency_check.find_soffice")
def test_missing_soffice(mock_find_soffice, mock_which, capsys):
    """When soffice is missing, return False and print it."""
    mock_which.return_value = "/usr/bin/ffmpeg"
    mock_find_soffice.side_effect = Exception("Not found")
    
    assert check_dependencies() is False
    captured = capsys.readouterr()
    assert "soffice" in captured.out
