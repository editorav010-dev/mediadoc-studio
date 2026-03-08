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
fn convert_document(input_path: String, output_format: String, output_dir: String) -> TaskResult {
    let result = Command::new("C:\\Program Files\\LibreOffice\\program\\soffice.exe")
        .args(["--headless", "--convert-to", &output_format, "--outdir", &output_dir, &input_path])
        .output();
    match result {
        Ok(o) if o.status.success() => TaskResult { success: true, output_path: output_dir, error_message: String::new() },
        Ok(o) => TaskResult { success: false, output_path: String::new(), error_message: format!("Conversion failed: {}", String::from_utf8_lossy(&o.stderr)) },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => TaskResult { success: false, output_path: String::new(), error_message: String::from("LibreOffice is not installed. Please install it from https://www.libreoffice.org") },
        Err(e) => TaskResult { success: false, output_path: String::new(), error_message: format!("Error: {}", e) },
    }
}

#[tauri::command]
fn convert_audio(input_path: String, output_format: String, bitrate: String, output_dir: String) -> TaskResult {
    let input = std::path::Path::new(&input_path);
    let stem = input.file_stem().unwrap_or_default().to_string_lossy();
    let output_file = format!("{}\\{}_converted.{}", output_dir, stem, output_format);
    let mut args = vec!["-i".to_string(), input_path.clone(), "-y".to_string()];
    if output_format != "wav" { args.push("-b:a".to_string()); args.push(bitrate.clone()); }
    args.push(output_file.clone());
    let result = Command::new("C:\\ffmpeg\\bin\\ffmpeg.exe").args(&args).output();
    match result {
        Ok(o) if o.status.success() => TaskResult { success: true, output_path: output_file, error_message: String::new() },
        Ok(_) => TaskResult { success: false, output_path: String::new(), error_message: String::from("Audio conversion failed. Check the input file.") },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => TaskResult { success: false, output_path: String::new(), error_message: String::from("ffmpeg is not installed. Install it from https://ffmpeg.org/download.html") },
        Err(e) => TaskResult { success: false, output_path: String::new(), error_message: format!("Error: {}", e) },
    }
}

#[tauri::command]
fn download_media(url: String, output_dir: String, cookies_path: Option<String>) -> TaskResult {
    let output_template = format!("{}\\%(title)s.%(ext)s", output_dir);
    let mut args = vec!["--no-playlist".to_string(), "--retries".to_string(), "3".to_string(), "--continue".to_string(), "-o".to_string(), output_template, url.clone()];
    if let Some(cookies) = cookies_path { if !cookies.is_empty() { args.push("--cookies".to_string()); args.push(cookies); } }
    let result = Command::new(get_ytdlp_path()).args(&args).output();
    match result {
        Ok(o) if o.status.success() => TaskResult { success: true, output_path: output_dir, error_message: String::new() },
        Ok(o) => { let stderr = String::from_utf8_lossy(&o.stderr).to_lowercase(); let msg = if stderr.contains("video unavailable") || stderr.contains("private") { "This video is not available. It may be private or region-locked.".to_string() } else { format!("Download failed: {}", stderr) }; TaskResult { success: false, output_path: String::new(), error_message: msg } },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => TaskResult { success: false, output_path: String::new(), error_message: String::from("yt-dlp is not installed. Install it from https://github.com/yt-dlp/yt-dlp") },
        Err(e) => TaskResult { success: false, output_path: String::new(), error_message: format!("Error: {}", e) },
    }
}

#[tauri::command]
fn images_to_pdf(image_paths: Vec<String>, output_path: String) -> TaskResult {
    let paths_str = image_paths.iter().map(|p| format!("r'{}'", p.replace("\\", "\\\\"))).collect::<Vec<_>>().join(",");
    let script = format!("from PIL import Image; imgs=[Image.open(p).convert('RGB') for p in [{}]]; imgs[0].save(r'{}',save_all=True,append_images=imgs[1:])", paths_str, output_path.replace("\\", "\\\\"));
    let result = Command::new("python").args(["-c", &script]).output();
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            convert_document,
            convert_audio,
            download_media,
            images_to_pdf,
            check_dependencies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
