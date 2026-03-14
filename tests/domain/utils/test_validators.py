from packages.domain.utils.validators import (
    is_doc_conversion_supported,
    is_audio_conversion_supported,
    get_suggested_path,
    SUPPORTED_DOC_CONVERSIONS,
)


# ── Document conversion validation ──────────────────────────────

def test_supported_doc_conversion():
    """Known supported paths should return True."""
    assert is_doc_conversion_supported("docx", "pdf") is True
    assert is_doc_conversion_supported("xlsx", "csv") is True
    assert is_doc_conversion_supported("odt", "docx") is True
    assert is_doc_conversion_supported("txt", "pdf") is True


def test_unsupported_doc_conversion():
    """Unsupported paths should return False."""
    assert is_doc_conversion_supported("pdf", "xlsx") is False
    assert is_doc_conversion_supported("jpg", "pdf") is False
    assert is_doc_conversion_supported("docx", "mp3") is False


def test_case_insensitive_doc_formats():
    """Input format matching should be case-insensitive."""
    assert is_doc_conversion_supported("DOCX", "pdf") is True
    assert is_doc_conversion_supported("Xlsx", "csv") is True


# ── Audio conversion validation ──────────────────────────────────

def test_supported_audio_conversion():
    """Known supported audio conversions should return True."""
    assert is_audio_conversion_supported("mp4", "mp3") is True
    assert is_audio_conversion_supported("wav", "aac") is True
    assert is_audio_conversion_supported("flac", "wav") is True


def test_unsupported_audio_conversion():
    """Unsupported audio conversions should return False."""
    assert is_audio_conversion_supported("pdf", "mp3") is False
    assert is_audio_conversion_supported("mp4", "flac") is False


# ── Suggestions ──────────────────────────────────────────────────

def test_suggestion_pdf_to_xlsx():
    """PDF → XLSX should suggest a two-step path."""
    suggestion = get_suggested_path("pdf", "xlsx")
    assert "PDF" in suggestion and "DOCX" in suggestion


def test_suggestion_no_alternative():
    """Unsupported paths with no suggestion should return a default."""
    suggestion = get_suggested_path("bmp", "mp3")
    assert "No alternative" in suggestion
