from packages.domain.utils.errors import get_error_message, ERROR_MESSAGES


def test_known_error_key():
    """Known error keys should return their specific message."""
    assert get_error_message("file_not_found") == ERROR_MESSAGES["file_not_found"]
    assert "could not be found" in get_error_message("file_not_found")


def test_dependency_missing_keys():
    """All dependency-missing keys should return specific messages."""
    assert "ffmpeg" in get_error_message("dependency_missing_ffmpeg").lower()
    assert "libreoffice" in get_error_message("dependency_missing_soffice").lower()
    assert "yt-dlp" in get_error_message("dependency_missing_ytdlp").lower()


def test_unknown_key_fallback():
    """Unknown error keys should fall back to the 'unknown' message."""
    result = get_error_message("some_random_key_that_does_not_exist")
    assert result == ERROR_MESSAGES["unknown"]
    assert "Something went wrong" in result


def test_all_keys_return_strings():
    """Every error message should be a non-empty string."""
    for key, msg in ERROR_MESSAGES.items():
        assert isinstance(msg, str)
        assert len(msg) > 0
