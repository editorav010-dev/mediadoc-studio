SUPPORTED_DOC_CONVERSIONS = {
    "docx": ["pdf", "txt", "odt"],
    "pdf":  ["docx", "txt"],
    "xlsx": ["csv"],
    "csv":  ["xlsx"],
    "odt":  ["docx", "pdf"],
    "rtf":  ["docx", "pdf"],
    "pptx": ["pdf"],
}

SUPPORTED_AUDIO_INPUTS = ["mp4", "mkv", "avi", "mov", "webm", "flv", "mp3", "wav", "flac", "ogg", "m4a"]
SUPPORTED_AUDIO_OUTPUTS = ["mp3", "aac", "wav"]
SUPPORTED_IMAGE_INPUTS  = ["jpg", "jpeg", "png", "webp", "bmp", "tiff"]

def is_doc_conversion_supported(input_fmt: str, output_fmt: str) -> bool:
    return output_fmt in SUPPORTED_DOC_CONVERSIONS.get(input_fmt.lower(), [])

def is_audio_conversion_supported(input_fmt: str, output_fmt: str) -> bool:
    return input_fmt.lower() in SUPPORTED_AUDIO_INPUTS and output_fmt.lower() in SUPPORTED_AUDIO_OUTPUTS

def get_suggested_path(input_fmt: str, output_fmt: str) -> str:
    """For unsupported paths, suggest an alternative route."""
    if input_fmt == "pdf" and output_fmt == "xlsx":
        return "Try: PDF → DOCX first, then DOCX → XLSX"
    return "No alternative path available."
