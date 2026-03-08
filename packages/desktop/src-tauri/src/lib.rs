use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct TaskResult {
    pub success: bool,
    pub output_path: String,
    pub error_message: String,
}

fn get_ytdlp_path() -> String {
    // Try common locations
    let candidates = vec![
        "C:\\Users\\avspn\\AppData\\Roaming\\Python\\Python312\\Scripts\\yt-dlp.exe",
        "C:\\Users\\avspn\\AppData\\Local\\Programs\\Python\\Python313\\Scripts\\yt-dlp.exe",
        "C:\\Users\\avspn\\AppData\\Roaming\\Python\\Scripts\\yt-dlp.exe",
        "C:\\Python313\\Scripts\\yt-dlp.exe",
        "yt-dlp",
    ];
    for path in candidates {
        if std::path::Path::new(path).exists() || path == "yt-dlp" {
            return path.to_string();
        }
    }
    "yt-dlp".to_string()
}

#[tauri::command]
async fn convert_document(input_path: String, output_format: String, output_dir: String) -> TaskResult {
    let input = std::path::Path::new(&input_path);
    let input_ext = input.extension().unwrap_or_default().to_string_lossy().to_lowercase();
    
    // Define what LibreOffice can directly convert TO
    let direct_supported = vec!["pdf", "docx", "doc", "odt", "txt", "html", "rtf", "pptx", "xlsx", "csv"];
    
    if !direct_supported.contains(&output_format.as_str()) {
        return TaskResult {
            success: false,
            output_path: String::new(),
            error_message: format!("Converting to {} is not supported yet.", output_format),
        };
    }

    // For PDF→DOCX use LibreOffice Writer import filter
    let convert_arg = match (input_ext.as_str(), output_format.as_str()) {
        ("pdf", "docx") => "docx:writer_pdf_import",
        ("pdf", "doc") => "doc:writer_pdf_import", 
        ("pdf", "odt") => "odt:writer_pdf_import",
        ("pdf", "txt") => "txt:writer_pdf_import",
        _ => &output_format,
    };
    
    let convert_arg_owned = convert_arg.to_string();
    let input_path_clone = input_path.clone();
    let output_dir_clone = output_dir.clone();

    let result = tokio::task::spawn_blocking(move || {
        Command::new("C:\\Program Files\\LibreOffice\\program\\soffice.exe")
            .args(["--headless", "--convert-to", &convert_arg_owned, "--outdir", &output_dir_clone, &input_path_clone])
            .output()
    }).await.unwrap();

    match result {
        Ok(o) if o.status.success() => {
            // Find the output file
            let stem = input.file_stem().unwrap_or_default().to_string_lossy();
            let actual_ext = if output_format.contains(':') { output_format.split(':').next().unwrap_or(&output_format) } else { &output_format };
            let output_file = format!("{}\\{}.{}", output_dir, stem, actual_ext);
            TaskResult { success: true, output_path: output_file, error_message: String::new() }
        },
        Ok(o) => TaskResult {
            success: false,
            output_path: String::new(),
            error_message: format!("Conversion failed. LibreOffice error: {}", String::from_utf8_lossy(&o.stderr)),
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => TaskResult {
            success: false,
            output_path: String::new(),
            error_message: String::from("LibreOffice not found at expected path."),
        },
        Err(e) => TaskResult { success: false, output_path: String::new(), error_message: format!("Error: {}", e) },
    }
}

#[tauri::command]
async fn convert_audio(input_path: String, output_format: String, bitrate: String, output_dir: String) -> TaskResult {
    let input = std::path::Path::new(&input_path);
    let stem = input.file_stem().unwrap_or_default().to_string_lossy();
    let output_file = format!("{}\\{}_converted.{}", output_dir, stem, output_format);
    
    let mut args = vec!["-i".to_string(), input_path.clone(), "-y".to_string()];
    
    let format_args: Vec<&str> = match output_format.as_str() {
        "mp3" => vec!["-c:a", "libmp3lame", "-q:a", "2"], // VBR high quality
        "aac" => vec!["-c:a", "aac", "-b:a", &bitrate],
        "wav" => vec!["-c:a", "pcm_s16le"], // lossless
        "flac" => vec!["-c:a", "flac", "-compression_level", "8"],
        "ogg" => vec!["-c:a", "libvorbis", "-q:a", "6"],
        "m4a" => vec!["-c:a", "aac", "-b:a", &bitrate, "-movflags", "+faststart"],
        "opus" => vec!["-c:a", "libopus", "-b:a", &bitrate],
        _ => vec!["-b:a", &bitrate],
    };
    
    for arg in format_args {
        args.push(arg.to_string());
    }
    args.push(output_file.clone());
    
    let result = tokio::task::spawn_blocking(move || {
        Command::new("C:\\ffmpeg\\bin\\ffmpeg.exe").args(&args).output()
    }).await.unwrap();
    
    match result {
        Ok(o) if o.status.success() => TaskResult { success: true, output_path: output_file, error_message: String::new() },
        Ok(_) => TaskResult { success: false, output_path: String::new(), error_message: String::from("Audio conversion failed. Check the input file.") },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => TaskResult { success: false, output_path: String::new(), error_message: String::from("ffmpeg is not installed. Install it from https://ffmpeg.org/download.html") },
        Err(e) => TaskResult { success: false, output_path: String::new(), error_message: format!("Error: {}", e) },
    }
}

#[tauri::command]
async fn convert_video(
    input_path: String,
    output_format: String,
    output_dir: String,
    quality: String,
    preset: Option<String>,
) -> TaskResult {
    let input = std::path::Path::new(&input_path);
    let stem = input.file_stem().unwrap_or_default().to_string_lossy();
    let output_file = format!("{}\\{}_converted.{}", output_dir, stem, output_format);
    
    // Always use H.264 for maximum compatibility
    // H.265 causes playback issues on Windows without codec packs
    let video_codec = "libx264";
    
    let crf = match quality.as_str() {
        "high" => "18",
        "low" => "28",
        _ => "23",
    };
    
    let preset_val = preset.unwrap_or("medium".to_string());
    let output_dir_clone = output_dir.clone();
    let input_path_clone = input_path.clone();
    let output_file_clone = output_file.clone();
    
    if output_format == "gif" {
        return tokio::task::spawn_blocking(move || {
            let palette_file = format!("{}\\palette.png", output_dir_clone);
            Command::new("C:\\ffmpeg\\bin\\ffmpeg.exe")
                .args(["-i", &input_path_clone, "-vf", "fps=15,scale=480:-1:flags=lanczos,palettegen", "-y", &palette_file])
                .output().ok();
            let result = Command::new("C:\\ffmpeg\\bin\\ffmpeg.exe")
                .args(["-i", &input_path_clone, "-i", &palette_file, "-lavfi", "fps=15,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse", "-y", &output_file_clone])
                .output();
            let _ = std::fs::remove_file(&palette_file);
            match result {
                Ok(o) if o.status.success() => TaskResult { success: true, output_path: output_file_clone, error_message: String::new() },
                Ok(o) => TaskResult { success: false, output_path: String::new(), error_message: format!("GIF conversion failed: {}", String::from_utf8_lossy(&o.stderr)) },
                Err(e) => TaskResult { success: false, output_path: String::new(), error_message: format!("ffmpeg error: {}", e) },
            }
        }).await.unwrap();
    }
    
    // Scale filter — preserve aspect ratio, ensure even dimensions
    let scale_filter = "scale='trunc(iw/2)*2':'trunc(ih/2)*2'";
    
    // Get number of CPU cores, use only half to prevent system freeze
    let cpu_count = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    let threads = ((cpu_count / 2).max(1)).to_string();

    let color_filter = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
    let full_filter = format!("{},{}", scale_filter, color_filter);

    let result = tokio::task::spawn_blocking(move || {
        Command::new("C:\\ffmpeg\\bin\\ffmpeg.exe")
            .args([
                "-i", &input_path_clone,
                "-map_metadata", "0",
                "-map", "0:v:0",
                "-map", "0:a:0?",
                "-c:v", video_codec,
                "-crf", crf,
                "-preset", &preset_val,
                "-profile:v", "high",
                "-level:v", "4.2",
                "-vf", &full_filter,
                "-c:a", "aac",
                "-b:a", "192k",
                "-ac", "2",
                "-ar", "44100",
                "-movflags", "+faststart",
                "-brand", "mp42",
                "-threads", &threads,
                "-y",
                &output_file_clone,
            ])
            .output()
    }).await.unwrap();

    match result {
        Ok(o) if o.status.success() => {
            TaskResult { success: true, output_path: output_file, error_message: String::new() }
        },
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            let error_line = stderr
                .lines()
                .filter(|l| l.contains("Error") || l.contains("Invalid") || l.contains("No such"))
                .last()
                .unwrap_or("Video conversion failed — check the input file format")
                .to_string();
            TaskResult {
                success: false,
                output_path: String::new(),
                error_message: error_line
            }
        },
        Err(e) => TaskResult { success: false, output_path: String::new(), error_message: format!("ffmpeg error: {}", e) },
    }
}

#[tauri::command]
async fn convert_image_format(
    input_path: String,
    output_format: String,
    output_dir: String,
) -> TaskResult {
    let script = format!(r#"
from PIL import Image
import os
img = Image.open(r'{}')
stem = os.path.splitext(os.path.basename(r'{}'))[0]
out = os.path.join(r'{}', stem + '_converted.{}')
if '{}' in ('jpg', 'jpeg'):
    img = img.convert('RGB')
    img.save(out, 'JPEG', quality=95)
elif '{}' == 'png':
    img.save(out, 'PNG', optimize=True)
elif '{}' == 'webp':
    img.save(out, 'WEBP', quality=95)
elif '{}' == 'gif':
    img.save(out, 'GIF')
elif '{}' == 'bmp':
    img.save(out, 'BMP')
elif '{}' == 'tiff':
    img.save(out, 'TIFF')
else:
    img.save(out)
print(out)
"#, input_path, input_path, output_dir, output_format,
    output_format, output_format, output_format, output_format,
    output_format, output_format);

    let result = tokio::task::spawn_blocking(move || {
        Command::new("python").args(["-c", &script]).output()
    }).await.unwrap();
    
    match result {
        Ok(o) if o.status.success() => TaskResult {
            success: true,
            output_path: String::from_utf8_lossy(&o.stdout).trim().to_string(),
            error_message: String::new(),
        },
        Ok(o) => TaskResult { success: false, output_path: String::new(), error_message: format!("Failed: {}", String::from_utf8_lossy(&o.stderr)) },
        Err(e) => TaskResult { success: false, output_path: String::new(), error_message: format!("Error: {}", e) },
    }
}

#[tauri::command]
async fn download_media(url: String, output_dir: String, cookies_path: Option<String>) -> TaskResult {
    let output_template = format!("{}\\%(title)s.%(ext)s", output_dir);
    let mut args = vec!["--no-playlist".to_string(), "--retries".to_string(), "3".to_string(), "--continue".to_string(), "-o".to_string(), output_template, url.clone()];
    if let Some(cookies) = cookies_path { if !cookies.is_empty() { args.push("--cookies".to_string()); args.push(cookies); } }
    
    let result = tokio::task::spawn_blocking(move || {
        Command::new(get_ytdlp_path()).args(&args).output()
    }).await.unwrap();
    
    match result {
        Ok(o) if o.status.success() => TaskResult { success: true, output_path: output_dir, error_message: String::new() },
        Ok(o) => { let stderr = String::from_utf8_lossy(&o.stderr).to_lowercase(); let msg = if stderr.contains("video unavailable") || stderr.contains("private") { "This video is not available. It may be private or region-locked.".to_string() } else { format!("Download failed: {}", stderr) }; TaskResult { success: false, output_path: String::new(), error_message: msg } },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => TaskResult { success: false, output_path: String::new(), error_message: String::from("yt-dlp is not installed. Install it from https://github.com/yt-dlp/yt-dlp") },
        Err(e) => TaskResult { success: false, output_path: String::new(), error_message: format!("Error: {}", e) },
    }
}

#[tauri::command]
async fn images_to_pdf(image_paths: Vec<String>, output_path: String) -> TaskResult {
    let paths_str = image_paths.iter().map(|p| format!("r'{}'", p.replace("\\", "\\\\"))).collect::<Vec<_>>().join(",");
    let script = format!("from PIL import Image; imgs=[Image.open(p).convert('RGB') for p in [{}]]; imgs[0].save(r'{}',save_all=True,append_images=imgs[1:])", paths_str, output_path.replace("\\", "\\\\"));
    
    let result = tokio::task::spawn_blocking(move || {
        Command::new("python").args(["-c", &script]).output()
    }).await.unwrap();
    
    match result {
        Ok(o) if o.status.success() => TaskResult { success: true, output_path: output_path, error_message: String::new() },
        Ok(o) => TaskResult { success: false, output_path: String::new(), error_message: format!("Failed: {}", String::from_utf8_lossy(&o.stderr)) },
        Err(e) => TaskResult { success: false, output_path: String::new(), error_message: format!("Error: {}", e) },
    }
}

#[tauri::command]
fn check_dependencies() -> serde_json::Value {
    let ytdlp_path = get_ytdlp_path();
    let deps = vec![
        ("C:\\Program Files\\LibreOffice\\program\\soffice.exe", "LibreOffice"), 
        ("C:\\ffmpeg\\bin\\ffmpeg.exe", "ffmpeg"), 
        (ytdlp_path.as_str(), "yt-dlp")
    ];
    let results: Vec<serde_json::Value> = deps.iter().map(|(cmd, name)| {
        let found = Command::new(cmd).arg("--version").output().is_ok();
        serde_json::json!({ "name": name, "command": cmd, "installed": found })
    }).collect();
    serde_json::json!(results)
}

#[tauri::command]
async fn compress_video(
    input_path: String,
    output_format: String,
    output_dir: String,
    resolution: String,
    crf: String,
    preset: String,
) -> TaskResult {
    let input = std::path::Path::new(&input_path);
    let stem = input.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let output_file = format!("{}\\{}_compressed.{}", output_dir, stem, output_format);

    let cpu_count = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let threads = ((cpu_count / 2).max(1)).to_string();

    let scale_filter = match resolution.as_str() {
        "4K"    => "scale='if(gt(iw,ih),3840,-2)':'if(gt(iw,ih),-2,3840)'",
        "1080p" => "scale='if(gt(iw,ih),1920,-2)':'if(gt(iw,ih),-2,1920)'",
        "720p"  => "scale='if(gt(iw,ih),1280,-2)':'if(gt(iw,ih),-2,1280)'",
        "480p"  => "scale='if(gt(iw,ih),854,-2)':'if(gt(iw,ih),-2,854)'",
        "360p"  => "scale='if(gt(iw,ih),640,-2)':'if(gt(iw,ih),-2,640)'",
        _       => "scale='trunc(iw/2)*2':'trunc(ih/2)*2'",
    }.to_string();

    let color_filter = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
    let full_filter = format!("{},{}", scale_filter, color_filter);

    let safe_preset = match preset.as_str() {
        "ultrafast"|"superfast"|"veryfast"|"faster"|
        "fast"|"medium"|"slow"|"slower"|"veryslow" => preset.to_string(),
        _ => "fast".to_string(),
    };

    let output_file_clone = output_file.clone();
    let input_clone = input_path.clone();
    let filter_clone = full_filter.clone();
    let crf_clone = crf.clone();
    let preset_clone = safe_preset.clone();
    let threads_clone = threads.clone();

    // Run ffmpeg in a background thread so UI never freezes
    let result = tokio::task::spawn_blocking(move || {

        // ── Try NVIDIA NVENC first ───────────────────────────────
        let nvidia = Command::new("C:\\ffmpeg\\bin\\ffmpeg.exe")
            .args([
                "-hwaccel", "cuda",
                "-hwaccel_output_format", "cuda",
                "-i", &input_clone,
                "-map_metadata", "0",
                "-map", "0:v:0",
                "-map", "0:a:0?",
                "-vf", &filter_clone,
                "-c:v", "h264_nvenc",
                "-preset", "p4",
                "-cq", &crf_clone,
                "-profile:v", "high",
                "-level:v", "4.2",
                "-c:a", "aac",
                "-b:a", "192k",
                "-ac", "2",
                "-ar", "44100",
                "-movflags", "+faststart",
                "-y",
                &output_file_clone,
            ])
            .output();

        if let Ok(o) = nvidia {
            if o.status.success() {
                return TaskResult {
                    success: true,
                    output_path: output_file_clone.clone(),
                    error_message: "✓ Used NVIDIA GPU (NVENC)".to_string(),
                };
            }
        }

        // ── Try AMD AMF second ───────────────────────────────────
        let amd = Command::new("C:\\ffmpeg\\bin\\ffmpeg.exe")
            .args([
                "-hwaccel", "d3d11va",
                "-i", &input_clone,
                "-map_metadata", "0",
                "-map", "0:v:0",
                "-map", "0:a:0?",
                "-vf", &filter_clone,
                "-c:v", "h264_amf",
                "-quality", "balanced",
                "-qp_i", &crf_clone,
                "-qp_p", &crf_clone,
                "-profile:v", "high",
                "-c:a", "aac",
                "-b:a", "192k",
                "-ac", "2",
                "-ar", "44100",
                "-movflags", "+faststart",
                "-y",
                &output_file_clone,
            ])
            .output();

        if let Ok(o) = amd {
            if o.status.success() {
                return TaskResult {
                    success: true,
                    output_path: output_file_clone.clone(),
                    error_message: "✓ Used AMD GPU (AMF)".to_string(),
                };
            }
        }

        // ── Try Intel QuickSync third ────────────────────────────
        let intel = Command::new("C:\\ffmpeg\\bin\\ffmpeg.exe")
            .args([
                "-hwaccel", "qsv",
                "-i", &input_clone,
                "-map_metadata", "0",
                "-map", "0:v:0",
                "-map", "0:a:0?",
                "-vf", &filter_clone,
                "-c:v", "h264_qsv",
                "-global_quality", &crf_clone,
                "-profile:v", "high",
                "-c:a", "aac",
                "-b:a", "192k",
                "-ac", "2",
                "-ar", "44100",
                "-movflags", "+faststart",
                "-y",
                &output_file_clone,
            ])
            .output();

        if let Ok(o) = intel {
            if o.status.success() {
                return TaskResult {
                    success: true,
                    output_path: output_file_clone.clone(),
                    error_message: "✓ Used Intel QuickSync GPU".to_string(),
                };
            }
        }

        // ── CPU fallback ─────────────────────────────────────────
        let cpu = Command::new("C:\\ffmpeg\\bin\\ffmpeg.exe")
            .args([
                "-i", &input_clone,
                "-map_metadata", "0",
                "-map", "0:v:0",
                "-map", "0:a:0?",
                "-c:v", "libx264",
                "-crf", &crf_clone,
                "-preset", &preset_clone,
                "-profile:v", "high",
                "-level:v", "4.2",
                "-vf", &filter_clone,
                "-c:a", "aac",
                "-b:a", "192k",
                "-ac", "2",
                "-ar", "44100",
                "-movflags", "+faststart",
                "-threads", &threads_clone,
                "-y",
                &output_file_clone,
            ])
            .output();

        match cpu {
            Ok(o) if o.status.success() => TaskResult {
                success: true,
                output_path: output_file_clone,
                error_message: "✓ Used CPU encoding (no GPU detected)".to_string(),
            },
            Ok(o) => {
                let stderr = String::from_utf8_lossy(&o.stderr);
                let error_line = stderr.lines()
                    .filter(|l| l.contains("Error") || l.contains("Invalid") || l.contains("failed"))
                    .last()
                    .unwrap_or("Compression failed — check input file format")
                    .to_string();
                TaskResult { success: false, output_path: String::new(), error_message: error_line }
            },
            Err(e) => TaskResult {
                success: false,
                output_path: String::new(),
                error_message: format!("ffmpeg not found: {}", e),
            },
        }
    }).await.unwrap();

    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            convert_document,
            convert_audio,
            convert_video,
            compress_video,
            convert_image_format,
            download_media,
            images_to_pdf,
            check_dependencies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
