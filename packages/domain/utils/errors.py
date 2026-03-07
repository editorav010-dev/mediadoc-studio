# Why this file exists:
# The original script showed raw Python exceptions to users.
# This maps every known error to a friendly, human-readable message.

ERROR_MESSAGES = {
    "file_not_found": "The file could not be found. Check the path and try again.",
    "file_corrupted": "This file could not be read. It may be corrupted or password-protected.",
    "unsupported_format": "This conversion is not supported. Check the supported formats list.",
    "dependency_missing_ffmpeg": "ffmpeg is not installed. Click here to set it up.",
    "dependency_missing_soffice": "LibreOffice is not installed. Click here to set it up.",
    "dependency_missing_ytdlp": "yt-dlp is not installed. Click here to set it up.",
    "network_error": "Network error. Check your internet connection and try again.",
    "permission_denied": "Cannot save to this folder. Choose a different output folder.",
    "video_unavailable": "This video is not available. It may be private, region-locked, or require login.",
    "unknown": "Something went wrong. Use Export Diagnostics to get details.",
}

def get_error_message(error_key: str) -> str:
    return ERROR_MESSAGES.get(error_key, ERROR_MESSAGES["unknown"])
