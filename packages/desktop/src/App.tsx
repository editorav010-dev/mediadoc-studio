import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

type Screen = "home" | "document" | "audio" | "download" | "image";

interface TaskResult {
  success: boolean;
  output_path: string;
  error_message: string;
}

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  return (
    <div className="app">
      <header className="app-header">
        <h1>Media & Doc Studio</h1>
        <p className="tagline">Convert, download, and extract — privately, locally.</p>
      </header>
      {screen === "home" && <HomeScreen setScreen={setScreen} />}
      {screen === "document" && <DocumentScreen onBack={() => setScreen("home")} />}
      {screen === "audio" && <AudioScreen onBack={() => setScreen("home")} />}
      {screen === "download" && <DownloadScreen onBack={() => setScreen("home")} />}
      {screen === "image" && <ImageScreen onBack={() => setScreen("home")} />}
    </div>
  );
}

function HomeScreen({ setScreen }: { setScreen: (s: Screen) => void }) {
  return (
    <div className="home-grid">
      <button className="feature-tile" onClick={() => setScreen("document")}>
        <span className="tile-icon">📄</span>
        <span className="tile-title">Convert Document</span>
        <span className="tile-desc">DOCX, PDF, XLSX, ODT and more</span>
      </button>
      <button className="feature-tile" onClick={() => setScreen("image")}>
        <span className="tile-icon">🖼️</span>
        <span className="tile-title">Images to PDF</span>
        <span className="tile-desc">Combine images into one PDF</span>
      </button>
      <button className="feature-tile" onClick={() => setScreen("download")}>
        <span className="tile-icon">⬇️</span>
        <span className="tile-title">Download Media</span>
        <span className="tile-desc">Save online videos locally</span>
      </button>
      <button className="feature-tile" onClick={() => setScreen("audio")}>
        <span className="tile-icon">🎵</span>
        <span className="tile-title">Extract Audio</span>
        <span className="tile-desc">MP3, AAC, WAV from any video</span>
      </button>
    </div>
  );
}

function DocumentScreen({ onBack }: { onBack: () => void }) {
  const [inputFile, setInputFile] = useState("");
  const [outputFormat, setOutputFormat] = useState("pdf");
  const [outputDir, setOutputDir] = useState("");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const formats = ["pdf", "docx", "txt", "odt", "csv"];

  async function pickFile() {
    const selected = await open({ multiple: false, filters: [{ name: "Documents", extensions: ["docx","pdf","xlsx","csv","txt","odt","rtf","pptx"] }] });
    if (selected) setInputFile(selected as string);
  }

  async function pickOutputDir() {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setOutputDir(selected as string);
  }

  async function runConversion() {
    if (!inputFile || !outputDir) return;
    setStatus("converting");
    setResult(null);
    try {
      const res = await invoke<TaskResult>("convert_document", { inputPath: inputFile, outputFormat, outputDir });
      setResult(res);
      setStatus(res.success ? "done" : "error");
    } catch (e) {
      setResult({ success: false, output_path: "", error_message: String(e) });
      setStatus("error");
    }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>Convert Document</h2>
      <div className="form">
        <label>Input File</label>
        <div className="file-row">
          <span className="file-path">{inputFile || "No file selected"}</span>
          <button className="btn-secondary" onClick={pickFile}>Browse</button>
        </div>
        <label>Output Format</label>
        <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)}>
          {formats.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </select>
        <label>Output Folder</label>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickOutputDir}>Browse</button>
        </div>
        <button className="btn-primary" onClick={runConversion} disabled={!inputFile || !outputDir || status === "converting"}>
          {status === "converting" ? "Converting..." : "Convert"}
        </button>
      </div>
      {status === "done" && result?.success && <div className="result-success">✅ Done! Saved to: <strong>{result.output_path}</strong></div>}
      {status === "error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

function AudioScreen({ onBack }: { onBack: () => void }) {
  const [inputFile, setInputFile] = useState("");
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState("192k");
  const [outputDir, setOutputDir] = useState("");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);

  async function pickFile() {
    const selected = await open({ multiple: false, filters: [{ name: "Media", extensions: ["mp4","mkv","avi","mov","webm","flv","mp3","wav","flac","ogg","m4a"] }] });
    if (selected) setInputFile(selected as string);
  }

  async function pickOutputDir() {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setOutputDir(selected as string);
  }

  async function runConversion() {
    if (!inputFile || !outputDir) return;
    setStatus("converting");
    try {
      const res = await invoke<TaskResult>("convert_audio", { inputPath: inputFile, outputFormat, bitrate, outputDir });
      setResult(res);
      setStatus(res.success ? "done" : "error");
    } catch (e) {
      setResult({ success: false, output_path: "", error_message: String(e) });
      setStatus("error");
    }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>Extract Audio</h2>
      <div className="form">
        <label>Input File</label>
        <div className="file-row">
          <span className="file-path">{inputFile || "No file selected"}</span>
          <button className="btn-secondary" onClick={pickFile}>Browse</button>
        </div>
        <label>Output Format</label>
        <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)}>
          <option value="mp3">MP3</option>
          <option value="aac">AAC</option>
          <option value="wav">WAV (lossless)</option>
        </select>
        <label>Bitrate</label>
        <select value={bitrate} onChange={e => setBitrate(e.target.value)}>
          <option value="128k">128 kbps</option>
          <option value="192k">192 kbps (recommended)</option>
          <option value="320k">320 kbps (high quality)</option>
        </select>
        <label>Output Folder</label>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickOutputDir}>Browse</button>
        </div>
        <button className="btn-primary" onClick={runConversion} disabled={!inputFile || !outputDir || status === "converting"}>
          {status === "converting" ? "Extracting..." : "Extract Audio"}
        </button>
      </div>
      {status === "done" && result?.success && <div className="result-success">✅ Done! Saved to: <strong>{result.output_path}</strong></div>}
      {status === "error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

function DownloadScreen({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [status, setStatus] = useState<"idle"|"downloading"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);

  async function pickOutputDir() {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setOutputDir(selected as string);
  }

  async function runDownload() {
    if (!url || !outputDir) return;
    setStatus("downloading");
    try {
      const res = await invoke<TaskResult>("download_media", { url, outputDir, cookiesPath: null });
      setResult(res);
      setStatus(res.success ? "done" : "error");
    } catch (e) {
      setResult({ success: false, output_path: "", error_message: String(e) });
      setStatus("error");
    }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>Download Media</h2>
      <p className="legal-note">⚠️ Only download content you have the legal right to download.</p>
      <div className="form">
        <label>Video URL</label>
        <input type="text" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
        <label>Save To Folder</label>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickOutputDir}>Browse</button>
        </div>
        <button className="btn-primary" onClick={runDownload} disabled={!url || !outputDir || status === "downloading"}>
          {status === "downloading" ? "Downloading..." : "Download"}
        </button>
      </div>
      {status === "done" && result?.success && <div className="result-success">✅ Downloaded! Saved to: <strong>{result.output_path}</strong></div>}
      {status === "error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

function PlaceholderScreen({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>{title}</h2>
      <p style={{ color: "#666" }}>Coming next week.</p>
    </div>
  );
}

function ImageScreen({ onBack }: { onBack: () => void }) {
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState("");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function pickImages() {
    const selected = await open({ multiple: true, filters: [{ name: "Images", extensions: ["jpg","jpeg","png","webp","bmp","tiff"] }] });
    if (selected) setImageFiles(Array.isArray(selected) ? selected : [selected as string]);
  }

  async function pickOutputPath() {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setOutputPath(selected as string);
  }

  async function runConversion() {
    if (!imageFiles.length || !outputPath) return;
    setStatus("converting");
    try {
      const outFile = outputPath + "\\combined.pdf";
      const res = await invoke<TaskResult>("images_to_pdf", { imagePaths: imageFiles, outputPath: outFile });
      setStatus(res.success ? "done" : "error");
      setErrorMsg(res.error_message);
    } catch (e) {
      setStatus("error");
      setErrorMsg(String(e));
    }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h2>Images to PDF</h2>
      <div className="form">
        <label>Select Images</label>
        <div className="file-row">
          <span className="file-path">{imageFiles.length ? `${imageFiles.length} image(s) selected` : "No images selected"}</span>
          <button className="btn-secondary" onClick={pickImages}>Browse</button>
        </div>
        <label>Output Folder</label>
        <div className="file-row">
          <span className="file-path">{outputPath || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickOutputPath}>Browse</button>
        </div>
        <button className="btn-primary" onClick={runConversion} disabled={!imageFiles.length || !outputPath || status === "converting"}>
          {status === "converting" ? "Converting..." : "Combine to PDF"}
        </button>
      </div>
      {status === "done" && <div className="result-success">✅ PDF saved to: <strong>{outputPath}</strong></div>}
      {status === "error" && <div className="result-error">❌ {errorMsg}</div>}
    </div>
  );
}

export default App;
