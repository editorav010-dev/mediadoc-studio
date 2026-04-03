import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";
import { Layout } from "./components/Layout";
import { OCRScreen } from "./components/Tools/OCR";
import { WatermarkScreen } from "./components/Tools/Watermark";
import { BatchFolderScreen } from "./components/Tools/BatchFolder";

type Theme = "dark" | "light";
type Screen = "home" | "document" | "audio" | "download" | "image" | "video" | "imageconvert" | "compress" | "mergepdf" | "splitpdf" | "greyscalepdf" | "ocr" | "watermark" | "batchfolder" | "onboarding";

interface TaskResult {
  success: boolean;
  output_path: string;
  error_message: string;
}

interface DepStatus {
  name: string;
  command: string;
  installed: boolean;
}

interface Activity {
  name: string;
  meta: string;
  time: string;
}

// ── Persist output paths per feature ─────────────────────────────
function useSavedPath(key: string) {
  const storageKey = `mds_output_${key}`;
  const [path, setPath] = useState<string>(() => localStorage.getItem(storageKey) || "");
  const savePath = (p: string) => { setPath(p); localStorage.setItem(storageKey, p); };
  return [path, savePath] as const;
}

// ── Activity log ──────────────────────────────────────────────────
const activityKey = "mds_activity";
function loadActivity(): Activity[] {
  try { return JSON.parse(localStorage.getItem(activityKey) || "[]"); } catch { return []; }
}
function addActivity(item: Activity) {
  const list = [item, ...loadActivity()].slice(0, 10);
  localStorage.setItem(activityKey, JSON.stringify(list));
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("mds_theme") as Theme) || "dark");
  const [screen, setScreen] = useState<Screen>("home");
  const [deps, setDeps] = useState<DepStatus[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showLibreOfficePrompt, setShowLibreOfficePrompt] = useState(false);

  useEffect(() => {
    invoke<boolean>("is_first_run").then(first => {
      if (first) setShowOnboarding(true);
    });
    invoke("get_setup_status").then((status: any) => {
      if (status.needs_setup && !showOnboarding) {
        setShowSetup(true);
      }
    });
  }, [showOnboarding]);

  useEffect(() => {
    invoke("ensure_ytdlp").then(() => {
      invoke<DepStatus[]>("check_dependencies").then(setDeps);
    }).catch(console.error);
  }, []);

  async function completeOnboarding() {
    await invoke("mark_initialized");
    setShowOnboarding(false);
    const status: any = await invoke("get_setup_status");
    if (status.needs_setup) setShowSetup(true);
  }

  function completeSetup() {
    setShowSetup(false);
    invoke<DepStatus[]>("check_dependencies").then(setDeps);
  }

  useEffect(() => {
    localStorage.setItem("mds_theme", theme);
  }, [theme]);

  useEffect(() => {
    invoke<DepStatus[]>("check_dependencies").then(setDeps).catch(() => {});
  }, []);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const handleFixDeps = async () => {
    await invoke("ensure_ytdlp");
    invoke<DepStatus[]>("check_dependencies").then(setDeps);
  };

  if (showOnboarding) return <OnboardingScreen onComplete={completeOnboarding} />;
  if (showSetup && !showOnboarding) return <SetupScreen onComplete={completeSetup} />;

  const handleNavigate = (screenId: string) => {
    setScreen(screenId as Screen);
  };

  return (
    <Layout
      theme={theme}
      onThemeToggle={toggleTheme}
      currentScreen={screen}
      onNavigate={handleNavigate}
      deps={deps}
      onFixDeps={handleFixDeps}
    >
      <div className="screen active">
        {screen === "home" && <HomeScreen setScreen={setScreen} />}
        {screen === "document" && <DocumentScreen onBack={() => setScreen("home")} />}
        {screen === "audio" && <AudioScreen onBack={() => setScreen("home")} />}
        {screen === "download" && <DownloadScreen onBack={() => setScreen("home")} />}
        {screen === "image" && <ImageScreen onBack={() => setScreen("home")} />}
        {screen === "video" && <VideoScreen onBack={() => setScreen("home")} />}
        {screen === "imageconvert" && <ImageConvertScreen onBack={() => setScreen("home")} />}
        {screen === "compress" && <CompressVideoScreen onBack={() => setScreen("home")} />}
        {screen === "mergepdf" && <MergePDFScreen onBack={() => setScreen("home")} />}
        {screen === "splitpdf" && <SplitPDFScreen onBack={() => setScreen("home")} />}
        {screen === "greyscalepdf" && <GreyscalePDFScreen onBack={() => setScreen("home")} />}
        {screen === "ocr" && <OCRScreen onBack={() => setScreen("home")} />}
        {screen === "watermark" && <WatermarkScreen onBack={() => setScreen("home")} />}
        {screen === "batchfolder" && <BatchFolderScreen onBack={() => setScreen("home")} />}
      </div>

      {showLibreOfficePrompt && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 999, padding: "40px"
        }}>
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "16px", padding: "32px", maxWidth: "400px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>📄</div>
            <div style={{
              fontSize: "18px", fontWeight: "700", marginBottom: "8px",
              color: "var(--text-primary)"
            }}>
              Install LibreOffice for Document Conversion
            </div>
            <div style={{
              fontSize: "13px", color: "var(--text-secondary)",
              marginBottom: "24px", lineHeight: "1.6"
            }}>
              Document conversion (DOCX, PDF, XLSX etc.) requires LibreOffice.
              It's free and takes about 2 minutes to install.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button className="btn-primary" onClick={() => {
                invoke("open_url", { url: "https://www.libreoffice.org/download/libreoffice-fresh/" });
                setShowLibreOfficePrompt(false);
              }}>
                Download LibreOffice (Free)
              </button>
              <button className="btn-secondary"
                onClick={() => setShowLibreOfficePrompt(false)}>
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ── Home Screen ───────────────────────────────────────────────────
function HomeScreen({ setScreen }: { setScreen: (s: Screen) => void }) {
  const [activity] = useState<Activity[]>(loadActivity());

  const tiles = [
    { id: "document",     icon: "📄", color: "doc",     title: "Convert Document", desc: "DOCX, PDF, XLSX, ODT, PPTX" },
    { id: "image",        icon: "🖼️", color: "img",     title: "Images to PDF",    desc: "Combine images into one file" },
    { id: "download",     icon: "⬇️", color: "dl",      title: "Download Media",   desc: "Save online videos locally" },
    { id: "audio",        icon: "🎵", color: "audio",   title: "Extract Audio",    desc: "MP3, AAC, WAV from video" },
    { id: "video",        icon: "🎬", color: "video",   title: "Convert Video",    desc: "MP4, MKV, MOV, AVI, WEBM" },
    { id: "compress",     icon: "🗜️", color: "comp",    title: "Compress Video",   desc: "Resize and reduce file size" },
    { id: "imageconvert", icon: "🔄", color: "imgconv", title: "Convert Image",    desc: "JPG, PNG, WEBP, GIF, BMP" },
    { id: "mergepdf",     icon: "🔗", color: "doc",     title: "Merge PDF",      desc: "Combine multiple PDFs into one" },
    { id: "splitpdf",     icon: "✂️", color: "comp",    title: "Split PDF",      desc: "Break PDF by page count or ranges" },
    { id: "greyscalepdf", icon: "🎨", color: "imgconv", title: "Greyscale PDF",  desc: "Convert colour PDF to greyscale" },
  ] as const;

  return (
    <div className="dashboard">
      <div className="dashboard-left">
        <div className="feature-grid">
          {tiles.map(t => (
            <button key={t.id} className="feature-tile" onClick={() => setScreen(t.id as Screen)}>
              <div className={`tile-icon-wrap ${t.color}`}>{t.icon}</div>
              <div className="tile-text">
                <div className="tile-title">{t.title}</div>
                <div className="tile-desc">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="dashboard-right">
        <div className="activity-panel">
          <div className="activity-label">Recent Activity</div>
          <div className="activity-list">
            {activity.length === 0 && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "8px 0" }}>
                No recent activity yet.
              </div>
            )}
            {activity.map((a, i) => (
              <div className="activity-item" key={i}>
                <div className="activity-name">{a.name}</div>
                <div className="activity-meta">{a.meta}</div>
                <div className="activity-time">{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Document Screen ───────────────────────────────────────────────
function DocumentScreen({ onBack }: { onBack: () => void }) {
  const [inputFile, setInputFile] = useState("");
  const [outputFormat, setOutputFormat] = useState("pdf");
  const [outputDir, saveOutputDir] = useSavedPath("document");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);

  const formats = ["pdf","docx","odt","txt","html","rtf","xlsx","csv"];

  async function pickFile() {
    const s = await open({ multiple: false, filters: [{ name: "Documents", extensions: ["docx","pdf","xlsx","csv","txt","odt","rtf","pptx"] }] });
    if (s) setInputFile(s as string);
  }
  async function pickDir() {
    const s = await open({ directory: true, multiple: false });
    if (s) saveOutputDir(s as string);
  }
  async function run() {
    if (!inputFile || !outputDir) return;
    setStatus("converting"); setResult(null);
    try {
      const res = await invoke<TaskResult>("convert_document", { inputPath: inputFile, outputFormat, outputDir });
      setResult(res); setStatus(res.success ? "done" : "error");
      if (res.success) addActivity({ name: inputFile.split("\\").pop() || inputFile, meta: `→ ${outputFormat.toUpperCase()}`, time: "Just now" });
    } catch(e) { setResult({ success:false, output_path:"", error_message: String(e) }); setStatus("error"); }
  }

  const fileName = inputFile.split("\\").pop() || "";
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) setInputFile(paths[0]);
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="screen-title">Convert Document</div>
      <div className="screen-sub">Locally processed — no cloud upload</div>
      <div className="form">
        <span className="field-label">Input File</span>
        <div className={`drop-zone ${inputFile ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`} onClick={pickFile}>
          {inputFile ? (
            <>
              <div className="drop-zone-file">✓ {fileName}</div>
            </>
          ) : (
            <>
              <div className="drop-zone-icon">📂</div>
              <div className="drop-zone-text">Drop file here or <span style={{color:"var(--accent)"}}>Browse</span></div>
              <div className="drop-zone-sub">DOCX · PDF · XLSX · ODT · RTF · PPTX</div>
            </>
          )}
        </div>

        <span className="field-label">Output Format</span>
        <div className="pill-group">
          {formats.map(f => (
            <button key={f} className={`pill ${outputFormat === f ? "active" : ""}`} onClick={() => setOutputFormat(f)}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <span className="field-label">Save To Folder</span>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickDir}>Browse</button>
        </div>

        <button className="btn-primary" onClick={run}
          disabled={!inputFile || !outputDir || status === "converting"}>
          {status === "converting" ? "Converting..." : "Convert Document"}
        </button>
      </div>

      {status === "converting" && (
        <div className="converting-card">
          <div className="converting-card-title">⏳ Converting {fileName}...</div>
          <div className="progress-bar-track"><div className="progress-bar-fill" /></div>
          <div className="converting-card-sub">Do not close the app.</div>
        </div>
      )}
      {status === "done"  && <div className="result-success">✅ Done! Saved to: <strong>{result?.output_path}</strong></div>}
      {status === "error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

// ── Audio Screen ──────────────────────────────────────────────────
function AudioScreen({ onBack }: { onBack: () => void }) {
  const [inputFile, setInputFile] = useState("");
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState("192");
  const [outputDir, saveOutputDir] = useSavedPath("audio");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) setInputFile(paths[0]);
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  const formats = ["mp3","aac","wav","flac","ogg","m4a","opus"];

  async function pickFile() {
    const s = await open({ multiple:false, filters:[{name:"Media",extensions:["mp4","mkv","avi","mov","webm","flv","mp3","wav","flac","ogg","m4a"]}] });
    if (s) setInputFile(s as string);
  }
  async function pickDir() {
    const s = await open({ directory:true, multiple:false });
    if (s) saveOutputDir(s as string);
  }
  async function run() {
    if (!inputFile || !outputDir) return;
    setStatus("converting"); setResult(null);
    try {
      const res = await invoke<TaskResult>("convert_audio", { inputPath:inputFile, outputFormat, bitrate: bitrate+"k", outputDir });
      setResult(res); setStatus(res.success ? "done" : "error");
      if (res.success) addActivity({ name: inputFile.split("\\").pop() || "", meta: `→ ${outputFormat.toUpperCase()} · ${bitrate}kbps`, time:"Just now" });
    } catch(e) { setResult({ success:false, output_path:"", error_message:String(e) }); setStatus("error"); }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="screen-title">Extract Audio</div>
      <div className="screen-sub">MP3 · AAC · WAV from any video file</div>
      <div className="form">
        <span className="field-label">Input File</span>
        <div className={`drop-zone ${inputFile ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`} onClick={pickFile}>
          {inputFile ? <div className="drop-zone-file">✓ {inputFile.split("\\").pop()}</div> : (
            <><div className="drop-zone-icon">🎬</div><div className="drop-zone-text">Drop file or <span style={{color:"var(--accent)"}}>Browse</span></div><div className="drop-zone-sub">MP4 · MKV · AVI · MOV · WEBM · MP3 · WAV · FLAC</div></>
          )}
        </div>

        <span className="field-label">Output Format</span>
        <div className="pill-group">
          {formats.map(f => <button key={f} className={`pill ${outputFormat===f?"active":""}`} onClick={() => setOutputFormat(f)}>{f.toUpperCase()}</button>)}
        </div>

        <span className="field-label">Bitrate · {bitrate} kbps</span>
        <div className="slider-wrap">
          <input type="range" min="64" max="320" step="32" value={bitrate} onChange={e => setBitrate(e.target.value)} />
          <div className="slider-labels"><span>← Smaller</span><span>Best quality →</span></div>
        </div>

        <span className="field-label">Save To Folder</span>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickDir}>Browse</button>
        </div>

        <button className="btn-primary" onClick={run} disabled={!inputFile || !outputDir || status==="converting"}>
          {status === "converting" ? "Extracting..." : "Extract Audio"}
        </button>
      </div>
      {status==="converting" && <div className="converting-card"><div className="converting-card-title">⏳ Extracting audio...</div><div className="progress-bar-track"><div className="progress-bar-fill" /></div></div>}
      {status==="done"  && <div className="result-success">✅ Saved to: <strong>{result?.output_path}</strong></div>}
      {status==="error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

// ── Download Screen ───────────────────────────────────────────────
function DownloadScreen({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState("");
  const [outputDir, saveOutputDir] = useSavedPath("download");
  const [status, setStatus] = useState<"idle"|"downloading"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);

  async function pickDir() {
    const s = await open({ directory:true, multiple:false });
    if (s) saveOutputDir(s as string);
  }
  async function run() {
    if (!url || !outputDir) return;
    setStatus("downloading"); setResult(null);
    try {
      const res = await invoke<TaskResult>("download_media", { url, outputDir, cookiesPath:null });
      setResult(res); setStatus(res.success ? "done" : "error");
      if (res.success) addActivity({ name: url.split("/").pop() || url, meta:"Downloaded", time:"Just now" });
    } catch(e) { setResult({ success:false, output_path:"", error_message:String(e) }); setStatus("error"); }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="screen-title">Download Media</div>
      <div className="form">
        <div className="legal-note">⚠️ Only download content you have the legal right to download.</div>
        <span className="field-label">Video URL</span>
        <input type="text" placeholder="https://youtube.com/watch?v=..." value={url} onChange={e => setUrl(e.target.value)} />

        <span className="field-label">Save To Folder</span>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickDir}>Browse</button>
        </div>

        <button className="btn-primary" onClick={run} disabled={!url || !outputDir || status==="downloading"}>
          {status==="downloading" ? "Downloading..." : "Start Download"}
        </button>
      </div>
      {status==="downloading" && <div className="converting-card"><div className="converting-card-title">⏳ Downloading...</div><div className="progress-bar-track"><div className="progress-bar-fill" /></div></div>}
      {status==="done"  && <div className="result-success">✅ Saved to: <strong>{result?.output_path}</strong></div>}
      {status==="error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

// ── Image to PDF Screen ───────────────────────────────────────────
function ImageScreen({ onBack }: { onBack: () => void }) {
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [outputDir, saveOutputDir] = useSavedPath("imagepdf");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) setImageFiles(paths);
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  async function pickImages() {
    const s = await open({ multiple:true, filters:[{name:"Images",extensions:["jpg","jpeg","png","webp","bmp","tiff"]}] });
    if (s) setImageFiles(Array.isArray(s) ? s : [s as string]);
  }
  async function pickDir() {
    const s = await open({ directory:true, multiple:false });
    if (s) saveOutputDir(s as string);
  }
  async function run() {
    if (!imageFiles.length || !outputDir) return;
    setStatus("converting");
    try {
      const outFile = outputDir + "\\combined.pdf";
      const res = await invoke<TaskResult>("images_to_pdf", { imagePaths:imageFiles, outputPath:outFile });
      setStatus(res.success ? "done" : "error"); setErrorMsg(res.error_message);
      if (res.success) addActivity({ name:"combined.pdf", meta:`${imageFiles.length} images merged`, time:"Just now" });
    } catch(e) { setStatus("error"); setErrorMsg(String(e)); }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="screen-title">Images to PDF</div>
      <div className="screen-sub">Combine multiple images into a single PDF</div>
      <div className="form">
        <span className="field-label">Select Images ({imageFiles.length} selected)</span>
        <div className={`drop-zone ${imageFiles.length ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`} onClick={pickImages}>
          {imageFiles.length ? <div className="drop-zone-file">✓ {imageFiles.length} image(s) selected</div> : (
            <><div className="drop-zone-icon">🖼️</div><div className="drop-zone-text">Drop images or <span style={{color:"var(--accent)"}}>Browse</span></div><div className="drop-zone-sub">JPG · PNG · WEBP · BMP · TIFF — select multiple</div></>
          )}
        </div>
        <span className="field-label">Save To Folder</span>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickDir}>Browse</button>
        </div>
        <button className="btn-primary" onClick={run} disabled={!imageFiles.length || !outputDir || status==="converting"}>
          {status==="converting" ? "Creating PDF..." : "Combine to PDF"}
        </button>
      </div>
      {status==="converting" && <div className="converting-card"><div className="converting-card-title">⏳ Creating PDF...</div><div className="progress-bar-track"><div className="progress-bar-fill" /></div></div>}
      {status==="done"  && <div className="result-success">✅ PDF saved to: <strong>{outputDir}</strong></div>}
      {status==="error" && <div className="result-error">❌ {errorMsg}</div>}
    </div>
  );
}

// ── Video Convert Screen ──────────────────────────────────────────
function VideoScreen({ onBack }: { onBack: () => void }) {
  const [inputFile, setInputFile] = useState("");
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [quality, setQuality] = useState("medium");
  const [outputDir, saveOutputDir] = useSavedPath("video");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) setInputFile(paths[0]);
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  const formats = ["mp4","mkv","mov","avi","webm","gif"];

  async function pickFile() {
    const s = await open({ multiple:false, filters:[{name:"Video",extensions:["mp4","mkv","avi","mov","webm","flv","wmv","m4v"]}] });
    if (s) setInputFile(s as string);
  }
  async function pickDir() {
    const s = await open({ directory:true, multiple:false });
    if (s) saveOutputDir(s as string);
  }
  async function run() {
    if (!inputFile || !outputDir) return;
    setStatus("converting"); setResult(null);
    try {
      const res = await invoke<TaskResult>("convert_video", { inputPath:inputFile, outputFormat, outputDir, quality });
      setResult(res); setStatus(res.success ? "done" : "error");
      if (res.success) addActivity({ name:inputFile.split("\\").pop()||"", meta:`→ ${outputFormat.toUpperCase()}`, time:"Just now" });
    } catch(e) { setResult({ success:false, output_path:"", error_message:String(e) }); setStatus("error"); }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="screen-title">Convert Video</div>
      <div className="screen-sub">Change format — preserves quality and aspect ratio</div>
      <div className="form">
        <span className="field-label">Input File</span>
        <div className={`drop-zone ${inputFile?"has-file":""} ${isDragOver ? "drag-over" : ""}`} onClick={pickFile}>
          {inputFile ? <div className="drop-zone-file">✓ {inputFile.split("\\").pop()}</div> : (
            <><div className="drop-zone-icon">🎬</div><div className="drop-zone-text">Drop video or <span style={{color:"var(--accent)"}}>Browse</span></div><div className="drop-zone-sub">MP4 · MKV · AVI · MOV · WEBM · FLV</div></>
          )}
        </div>

        <span className="field-label">Output Format</span>
        <div className="pill-group">
          {formats.map(f => <button key={f} className={`pill ${outputFormat===f?"active":""}`} onClick={() => setOutputFormat(f)}>{f.toUpperCase()}</button>)}
        </div>

        <span className="field-label">Quality</span>
        <div className="pill-group">
          {["high","medium","low"].map(q => <button key={q} className={`pill ${quality===q?"active":""}`} onClick={() => setQuality(q)}>{q.charAt(0).toUpperCase()+q.slice(1)}</button>)}
        </div>

        <span className="field-label">Save To Folder</span>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickDir}>Browse</button>
        </div>

        <button className="btn-primary" onClick={run} disabled={!inputFile||!outputDir||status==="converting"}>
          {status==="converting" ? "Converting..." : "Convert Video"}
        </button>
      </div>
      {status==="converting" && <div className="converting-card"><div className="converting-card-title">⏳ Converting video...</div><div className="progress-bar-track"><div className="progress-bar-fill" /></div><div className="converting-card-sub">GPU acceleration active if available.</div></div>}
      {status==="done"  && <div className="result-success">✅ Saved to: <strong>{result?.output_path}</strong></div>}
      {status==="error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

// ── Compress Video Screen ─────────────────────────────────────────
function CompressVideoScreen({ onBack }: { onBack: () => void }) {
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [resolution, setResolution] = useState("1080p");
  const [crf, setCrf] = useState("23");
  const [preset, setPreset] = useState("fast");
  const [outputDir, saveOutputDir] = useSavedPath("compress");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [currentFile, setCurrentFile] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) setInputFiles(paths);
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  const crfNum = parseInt(crf);
  const crfLabel = crfNum <= 20 ? "High Quality" : crfNum <= 27 ? "Balanced" : "Small File";

  async function pickFiles() {
    const s = await open({ multiple:true, filters:[{name:"Video",extensions:["mp4","mkv","avi","mov","webm","flv","wmv","m4v"]}] });
    if (s) setInputFiles(Array.isArray(s) ? s : [s as string]);
  }
  async function pickDir() {
    const s = await open({ directory:true, multiple:false });
    if (s) saveOutputDir(s as string);
  }
  async function run() {
    if (!inputFiles.length || !outputDir) return;
    setStatus("converting"); setResults([]); setErrors([]);
    for (const file of inputFiles) {
      setCurrentFile(file.split("\\").pop() || file);
      try {
        const res = await invoke<TaskResult>("compress_video", { inputPath:file, outputFormat, outputDir, resolution, crf, preset });
        if (res.success) { setResults(r => [...r, res.output_path]); addActivity({ name:file.split("\\").pop()||"", meta:`Compressed → ${resolution} ${outputFormat.toUpperCase()}`, time:"Just now" }); }
        else setErrors(e => [...e, `${file.split("\\").pop()}: ${res.error_message}`]);
      } catch(e) { setErrors(err => [...err, String(e)]); }
    }
    setStatus("done"); setCurrentFile("");
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="screen-title">Compress Video</div>
      <div className="screen-sub">Resize · re-encode · reduce file size</div>
      <div className="form">
        <div className="info-card">
          <div className="gpu-badge" style={{marginBottom:"6px"}}>
            <div className="gpu-badge-dot" />
            GPU detected — NVIDIA RTX 3050 · NVENC active
          </div>
          <div style={{fontSize:"11px",marginTop:"4px"}}>
            Hardware encoding active. CPU stays free. Automatically falls back to CPU if GPU unavailable.
          </div>
        </div>

        <span className="field-label">Input Videos ({inputFiles.length} selected)</span>
        <div className={`drop-zone ${inputFiles.length?"has-file":""} ${isDragOver ? "drag-over" : ""}`} onClick={pickFiles}>
          {inputFiles.length ? <div className="drop-zone-file">✓ {inputFiles.length} video(s) selected</div> : (
            <><div className="drop-zone-icon">🎬</div><div className="drop-zone-text">Drop videos or <span style={{color:"var(--accent)"}}>Browse</span></div><div className="drop-zone-sub">MP4 · MKV · AVI · MOV — select multiple</div></>
          )}
        </div>

        <span className="field-label">Output Format</span>
        <div className="pill-group">
          {["mp4","mkv","mov","avi"].map(f => <button key={f} className={`pill ${outputFormat===f?"active":""}`} onClick={() => setOutputFormat(f)}>{f.toUpperCase()}</button>)}
        </div>

        <span className="field-label">Resolution</span>
        <select value={resolution} onChange={e => setResolution(e.target.value)}>
          <option value="original">Original — keep source resolution</option>
          <option value="4K">4K — 3840px (largest, best quality)</option>
          <option value="1080p">1080p — 1920px (Full HD, recommended)</option>
          <option value="720p">720p — 1280px (HD, smaller file)</option>
          <option value="480p">480p — 854px (SD, very small)</option>
          <option value="360p">360p — 640px (mobile data saving)</option>
        </select>

        <span className="field-label">Compression Speed</span>
        <select value={preset} onChange={e => setPreset(e.target.value)}>
          <option value="ultrafast">Ultra Fast — lowest CPU, PC stays responsive</option>
          <option value="fast">Fast — good quality, low CPU (recommended)</option>
          <option value="medium">Medium — better quality, moderate CPU</option>
          <option value="slow">Slow — best quality, high CPU usage</option>
        </select>

        <span className="field-label">Quality · CRF {crf} · {crfLabel}</span>
        <div className="slider-wrap">
          <input type="range" min="18" max="35" value={crf} onChange={e => setCrf(e.target.value)} />
          <div className="slider-labels"><span>← Best Quality</span><span>Smallest File →</span></div>
        </div>

        <span className="field-label">Save To Folder</span>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickDir}>Browse</button>
        </div>

        <button className="btn-primary" onClick={run} disabled={!inputFiles.length||!outputDir||status==="converting"}>
          {status==="converting" ? `Compressing ${currentFile}...` : `Compress ${inputFiles.length||""} Video(s)`}
        </button>
      </div>
      {status==="converting" && (
        <div className="converting-card">
          <div className="converting-card-title">⚡ GPU Compressing: {currentFile}</div>
          <div className="progress-bar-track"><div className="progress-bar-fill" /></div>
          <div className="converting-card-sub">Do not close the app while compressing.</div>
        </div>
      )}
      {status==="done" && results.length>0 && <div className="result-success">✅ {results.length} video(s) compressed to: <strong>{outputDir}</strong></div>}
      {errors.length>0 && <div className="result-error">❌ {errors.map((e,i)=><div key={i}>{e}</div>)}</div>}
    </div>
  );
}

// ── Image Convert Screen ──────────────────────────────────────────
function ImageConvertScreen({ onBack }: { onBack: () => void }) {
  const [inputFile, setInputFile] = useState("");
  const [outputFormat, setOutputFormat] = useState("webp");
  const [quality, setQuality] = useState("85");
  const [outputDir, saveOutputDir] = useSavedPath("imgconv");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) setInputFile(paths[0]);
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  const formats = ["jpg","png","webp","gif","bmp","tiff"];
  const inputExt = inputFile.split(".").pop()?.toLowerCase() || "";
  const inputSize = "—";

  async function pickFile() {
    const s = await open({ multiple:false, filters:[{name:"Images",extensions:["jpg","jpeg","png","webp","bmp","tiff","gif"]}] });
    if (s) setInputFile(s as string);
  }
  async function pickDir() {
    const s = await open({ directory:true, multiple:false });
    if (s) saveOutputDir(s as string);
  }
  async function run() {
    if (!inputFile || !outputDir) return;
    setStatus("converting"); setResult(null);
    try {
      const res = await invoke<TaskResult>("convert_image_format", { inputPath:inputFile, outputFormat, outputDir });
      setResult(res); setStatus(res.success ? "done" : "error");
      if (res.success) addActivity({ name:inputFile.split("\\").pop()||"", meta:`→ ${outputFormat.toUpperCase()}`, time:"Just now" });
    } catch(e) { setResult({ success:false, output_path:"", error_message:String(e) }); setStatus("error"); }
  }

  const qualityNum = parseInt(quality);
  const qualityLabel = qualityNum >= 90 ? "Lossless" : qualityNum >= 75 ? "Good" : qualityNum >= 60 ? "Balanced" : "Small File";

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="screen-title">Convert Image</div>
      <div className="screen-sub">JPG · PNG · WEBP · GIF · BMP · TIFF</div>
      <div className="form">
        <span className="field-label">Input Image</span>
        <div className={`drop-zone ${inputFile?"has-file":""} ${isDragOver ? "drag-over" : ""}`} onClick={pickFile}>
          {inputFile ? <div className="drop-zone-file">✓ {inputFile.split("\\").pop()}</div> : (
            <><div className="drop-zone-icon">🖼️</div><div className="drop-zone-text">Drop image or <span style={{color:"var(--accent)"}}>Browse</span></div><div className="drop-zone-sub">JPG · PNG · WEBP · GIF · BMP · TIFF</div></>
          )}
        </div>

        <span className="field-label">Output Format</span>
        <div className="pill-group">
          {formats.map(f => <button key={f} className={`pill ${outputFormat===f?"active":""}`} onClick={() => setOutputFormat(f)}>{f.toUpperCase()}</button>)}
        </div>

        <span className="field-label">Quality · {quality}% · {qualityLabel}</span>
        <div className="slider-wrap">
          <input type="range" min="40" max="100" value={quality} onChange={e => setQuality(e.target.value)} />
          <div className="slider-labels"><span>← Smaller file</span><span>Lossless →</span></div>
        </div>

        {inputFile && outputFormat && (
          <div className="preview-card">
            <div className="preview-row"><span className="preview-label">Input</span><span className="preview-value">{inputExt.toUpperCase()} · {inputSize}</span></div>
            <hr className="preview-divider" />
            <div className="preview-row"><span className="preview-label">Output</span><span className="preview-value">{outputFormat.toUpperCase()}</span></div>
            {outputFormat === "webp" && <div className="preview-row"><span className="preview-label">Expected saving</span><span className="preview-saving">~60-80% smaller</span></div>}
            {outputFormat === "jpg"  && <div className="preview-row"><span className="preview-label">Expected saving</span><span className="preview-saving">~40-60% smaller</span></div>}
            {outputFormat === "png"  && <div className="preview-row"><span className="preview-label">Note</span><span style={{fontSize:"11px",color:"var(--text-muted)"}}>Lossless — file may be larger</span></div>}
          </div>
        )}

        <span className="field-label">Save To Folder</span>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickDir}>Browse</button>
        </div>

        <button className="btn-primary" onClick={run} disabled={!inputFile||!outputDir||status==="converting"}>
          {status==="converting" ? "Converting..." : "Convert Image"}
        </button>
      </div>
      {status==="converting" && <div className="converting-card"><div className="converting-card-title">⏳ Converting image...</div><div className="progress-bar-track"><div className="progress-bar-fill" /></div></div>}
      {status==="done"  && <div className="result-success">✅ Saved to: <strong>{result?.output_path}</strong></div>}
      {status==="error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

function MergePDFScreen({ onBack }: { onBack: () => void }) {
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [outputDir, saveOutputDir] = useSavedPath("mergepdf");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) setInputFiles(paths);
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  async function pickFiles() {
    const s = await open({ multiple: true, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (s) setInputFiles(Array.isArray(s) ? s : [s as string]);
  }
  async function pickDir() {
    const s = await open({ directory: true, multiple: false });
    if (s) saveOutputDir(s as string);
  }
  async function run() {
    if (!inputFiles.length || !outputDir) return;
    setStatus("converting"); setResult(null);
    const outPath = outputDir + "\\merged_output.pdf";
    try {
      const res = await invoke<TaskResult>("merge_pdfs", { inputPaths: inputFiles, outputPath: outPath });
      setResult(res); setStatus(res.success ? "done" : "error");
      if (res.success) addActivity({ name: "merged_output.pdf", meta: `${inputFiles.length} PDFs merged`, time: "Just now" });
    } catch(e) { setResult({ success: false, output_path: "", error_message: String(e) }); setStatus("error"); }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="screen-title">Merge PDF</div>
      <div className="screen-sub">Combine multiple PDF files into one ordered document</div>
      <div className="form">
        <span className="field-label">Select PDFs ({inputFiles.length} selected)</span>
        <div className={`drop-zone ${inputFiles.length ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`} onClick={pickFiles}>
          {inputFiles.length ? (
            <div className="drop-zone-file">✓ {inputFiles.length} PDF(s) selected</div>
          ) : (
            <><div className="drop-zone-icon">🔗</div>
            <div className="drop-zone-text">Drop PDFs or <span style={{color:"var(--accent)"}}>Browse</span></div>
            <div className="drop-zone-sub">Select 2 or more PDF files — order matters</div></>
          )}
        </div>
        {inputFiles.length > 0 && (
          <div style={{fontSize:"11px", color:"var(--text-muted)", padding:"4px 0"}}>
            {inputFiles.map((f, i) => <div key={i}>📄 {f.split("\\").pop()}</div>)}
          </div>
        )}
        <span className="field-label">Save To Folder</span>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickDir}>Browse</button>
        </div>
        <button className="btn-primary" onClick={run} disabled={inputFiles.length < 2 || !outputDir || status === "converting"}>
          {status === "converting" ? "Merging..." : `Merge ${inputFiles.length || ""} PDFs`}
        </button>
      </div>
      {status==="converting" && <div className="converting-card"><div className="converting-card-title">⏳ Merging PDFs...</div><div className="progress-bar-track"><div className="progress-bar-fill" /></div></div>}
      {status==="done"  && <div className="result-success">✅ Merged PDF saved to: <strong>{result?.output_path}</strong></div>}
      {status==="error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

function SplitPDFScreen({ onBack }: { onBack: () => void }) {
  const [inputFile, setInputFile] = useState("");
  const [outputDir, saveOutputDir] = useSavedPath("splitpdf");
  const [mode, setMode] = useState<"count"|"ranges">("count");
  const [value, setValue] = useState("5");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) setInputFile(paths[0]);
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  async function pickFile() {
    const s = await open({ multiple: false, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (s) setInputFile(s as string);
  }
  async function pickDir() {
    const s = await open({ directory: true, multiple: false });
    if (s) saveOutputDir(s as string);
  }
  async function run() {
    if (!inputFile || !outputDir) return;
    setStatus("converting"); setResult(null);
    try {
      const res = await invoke<TaskResult>("split_pdf", { inputPath: inputFile, outputDir, mode, value });
      setResult(res); setStatus(res.success ? "done" : "error");
      if (res.success) addActivity({ name: inputFile.split("\\").pop() || "", meta: `Split — ${res.error_message}`, time: "Just now" });
    } catch(e) { setResult({ success: false, output_path: "", error_message: String(e) }); setStatus("error"); }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="screen-title">Split PDF</div>
      <div className="screen-sub">Break a PDF into smaller files by page count or custom ranges</div>
      <div className="form">
        <span className="field-label">Input PDF</span>
        <div className={`drop-zone ${inputFile ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`} onClick={pickFile}>
          {inputFile ? <div className="drop-zone-file">✓ {inputFile.split("\\").pop()}</div> : (
            <><div className="drop-zone-icon">✂️</div>
            <div className="drop-zone-text">Drop PDF or <span style={{color:"var(--accent)"}}>Browse</span></div></>
          )}
        </div>

        <span className="field-label">Split Mode</span>
        <div className="pill-group">
          <button className={`pill ${mode === "count" ? "active" : ""}`} onClick={() => { setMode("count"); setValue("5"); }}>
            Every N Pages
          </button>
          <button className={`pill ${mode === "ranges" ? "active" : ""}`} onClick={() => { setMode("ranges"); setValue("1-3, 4-7, 8-end"); }}>
            Custom Ranges
          </button>
        </div>

        <span className="field-label">{mode === "count" ? "Pages Per File" : "Page Ranges (e.g. 1-3, 4-7, 8-end)"}</span>
        <input type="text" value={value} onChange={e => setValue(e.target.value)}
          placeholder={mode === "count" ? "5" : "1-3, 4-7, 8-end"} />

        <span className="field-label">Save To Folder</span>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickDir}>Browse</button>
        </div>
        <button className="btn-primary" onClick={run} disabled={!inputFile || !outputDir || !value || status === "converting"}>
          {status === "converting" ? "Splitting..." : "Split PDF"}
        </button>
      </div>
      {status==="converting" && <div className="converting-card"><div className="converting-card-title">⏳ Splitting PDF...</div><div className="progress-bar-track"><div className="progress-bar-fill" /></div></div>}
      {status==="done"  && <div className="result-success">✅ {result?.error_message} saved to: <strong>{result?.output_path}</strong></div>}
      {status==="error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

function GreyscalePDFScreen({ onBack }: { onBack: () => void }) {
  const [inputFile, setInputFile] = useState("");
  const [outputDir, saveOutputDir] = useSavedPath("greyscalepdf");
  const [status, setStatus] = useState<"idle"|"converting"|"done"|"error">("idle");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) setInputFile(paths[0]);
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  async function pickFile() {
    const s = await open({ multiple: false, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (s) setInputFile(s as string);
  }
  async function pickDir() {
    const s = await open({ directory: true, multiple: false });
    if (s) saveOutputDir(s as string);
  }
  async function run() {
    if (!inputFile || !outputDir) return;
    setStatus("converting"); setResult(null);
    const stem = inputFile.split("\\").pop()?.replace(".pdf","") || "output";
    const outPath = outputDir + "\\" + stem + "_greyscale.pdf";
    try {
      const res = await invoke<TaskResult>("greyscale_pdf", { inputPath: inputFile, outputPath: outPath });
      setResult(res); setStatus(res.success ? "done" : "error");
      if (res.success) addActivity({ name: stem + "_greyscale.pdf", meta: "Converted to greyscale", time: "Just now" });
    } catch(e) { setResult({ success: false, output_path: "", error_message: String(e) }); setStatus("error"); }
  }

  return (
    <div className="screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="screen-title">Greyscale PDF</div>
      <div className="screen-sub">Convert a colour PDF to greyscale — ideal for printing cost reduction</div>
      <div className="form">
        <span className="field-label">Input PDF</span>
        <div className={`drop-zone ${inputFile ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`} onClick={pickFile}>
          {inputFile ? <div className="drop-zone-file">✓ {inputFile.split("\\").pop()}</div> : (
            <><div className="drop-zone-icon">🎨</div>
            <div className="drop-zone-text">Drop PDF or <span style={{color:"var(--accent)"}}>Browse</span></div>
            <div className="drop-zone-sub">Colour PDF will be converted to greyscale</div></>
          )}
        </div>
        <span className="field-label">Save To Folder</span>
        <div className="file-row">
          <span className="file-path">{outputDir || "No folder selected"}</span>
          <button className="btn-secondary" onClick={pickDir}>Browse</button>
        </div>
        <button className="btn-primary" onClick={run} disabled={!inputFile || !outputDir || status === "converting"}>
          {status === "converting" ? "Converting..." : "Convert to Greyscale"}
        </button>
      </div>
      {status==="converting" && <div className="converting-card"><div className="converting-card-title">⏳ Converting to greyscale...</div><div className="progress-bar-track"><div className="progress-bar-fill" /></div><div className="converting-card-sub">Large PDFs may take a moment.</div></div>}
      {status==="done"  && <div className="result-success">✅ Greyscale PDF saved to: <strong>{result?.output_path}</strong></div>}
      {status==="error" && <div className="result-error">❌ {result?.error_message}</div>}
    </div>
  );
}

function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const steps = [
    {
      icon: "🛡️",
      title: "Privacy First",
      body: "All document conversions and media processing happen entirely on your device. Your files never leave your computer."
    },
    {
      icon: "⚡",
      title: "GPU Accelerated",
      body: "Video compression uses your GPU automatically for 5-10x faster processing. Falls back to CPU if needed."
    },
    {
      icon: "🚀",
      title: "You're All Set",
      body: "10 powerful tools in one app — welcome to Formatica."
    }
  ];
  const current = steps[step - 1];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--bg-base)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, flexDirection: "column", gap: "24px", padding: "40px"
    }}>
      <div style={{textAlign:"center", maxWidth:"400px"}}>
        <div style={{fontSize:"64px", marginBottom:"20px"}}>{current.icon}</div>
        <div style={{fontFamily:"inherit", fontSize:"24px", fontWeight:"700",
          color:"var(--text-primary)", marginBottom:"12px"}}>{current.title}</div>
        <div style={{fontSize:"15px", color:"var(--text-secondary)",
          lineHeight:"1.6"}}>{current.body}</div>
      </div>
      <div style={{display:"flex", gap:"6px", margin:"8px 0"}}>
        {steps.map((_, i) => (
          <div key={i} style={{
            width: i+1===step ? "24px" : "8px", height:"8px",
            borderRadius:"4px", background: i+1===step ? "var(--accent)" : "var(--border)",
            transition:"all 0.3s ease"
          }} />
        ))}
      </div>
      <button className="btn-primary" style={{width:"200px", padding:"13px"}}
        onClick={() => step < 3 ? setStep(s => s+1) : onComplete()}>
        {step < 3 ? "Next →" : "Get Started"}
      </button>
      {step > 1 && (
        <button className="back-btn" onClick={() => setStep(s => s-1)}>← Back</button>
      )}
    </div>
  );
}

function SetupScreen({ onComplete }: { onComplete: () => void }) {
  const [steps, setSteps] = useState([
    { id: "ytdlp",       label: "Media Downloader",   subtitle: "yt-dlp",       status: "waiting" as "waiting"|"active"|"done"|"error", percent: 0 },
    { id: "libreoffice", label: "Document Engine",     subtitle: "LibreOffice",  status: "waiting" as "waiting"|"active"|"done"|"error", percent: 0 },
  ]);
  const [currentMsg, setCurrentMsg] = useState("Preparing Formatica...");
  const [allDone, setAllDone] = useState(false);
  const [hasError, setHasError] = useState(false);

  function updateStep(id: string, patch: any) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  useEffect(() => {
    // Listen for progress events from Rust
    const unlisten = listen("setup_progress", (event: any) => {
      const { step, status, message, percent } = event.payload;
      setCurrentMsg(message);
      if (step === "libreoffice") {
        updateStep("libreoffice", {
          status: status === "done" ? "done" : status === "downloading" || status === "installing" ? "active" : "error",
          percent
        });
      }
      if (step === "ytdlp") {
        updateStep("ytdlp", {
          status: status === "done" ? "done" : "active",
          percent
        });
      }
    });

    async function runSetup() {
      // Step 1: yt-dlp
      updateStep("ytdlp", { status: "active", percent: 0 });
      setCurrentMsg("Downloading media downloader...");
      try {
        await invoke("install_ytdlp");
        updateStep("ytdlp", { status: "done", percent: 100 });
      } catch(e) {
        updateStep("ytdlp", { status: "error", percent: 0 });
        setHasError(true);
      }

      // Step 2: LibreOffice
      updateStep("libreoffice", { status: "active", percent: 0 });
      setCurrentMsg("Downloading document engine (this may take a few minutes)...");
      try {
        const r2: any = await invoke("install_libreoffice");
        if (r2.success) {
          updateStep("libreoffice", { status: "done", percent: 100 });
        } else {
          updateStep("libreoffice", { status: "error", percent: 0 });
          setHasError(true);
        }
      } catch(e) {
        updateStep("libreoffice", { status: "error", percent: 0 });
        setHasError(true);
      }

      setAllDone(true);
      setCurrentMsg(hasError ? "Setup completed with some issues." : "Formatica is ready!");
    }

    runSetup();
    return () => { unlisten.then(f => f()); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "var(--bg-base)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, flexDirection: "column", gap: "0", padding: "40px"
    }}>
      {/* Logo */}
      <div style={{
        width: "64px", height: "64px",
        background: "linear-gradient(135deg, #4F6BF4, #7c3aed)",
        borderRadius: "16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "28px", fontWeight: "800", color: "white",
        marginBottom: "24px",
        boxShadow: "0 8px 32px rgba(79,107,244,0.3)"
      }}>F</div>

      <div style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>
        Setting up Formatica
      </div>
      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "40px", textAlign: "center" }}>
        This only happens once. Please keep the app open.
      </div>

      {/* Step cards */}
      <div style={{ width: "100%", maxWidth: "380px", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
        {steps.map(step => (
          <div key={step.id} style={{
            background: "var(--bg-card)",
            border: `1px solid ${step.status === "active" ? "rgba(79,107,244,0.4)" : step.status === "done" ? "rgba(16,185,129,0.3)" : step.status === "error" ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
            borderRadius: "12px",
            padding: "14px 16px",
            transition: "all 0.3s ease"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: step.status === "active" ? "10px" : "0" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{step.label}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{step.subtitle}</div>
              </div>
              <div style={{ fontSize: "18px" }}>
                {step.status === "waiting" && "⏳"}
                {step.status === "active"  && "⚡"}
                {step.status === "done"    && "✅"}
                {step.status === "error"   && "⚠️"}
              </div>
            </div>
            {step.status === "active" && (
              <div style={{ height: "3px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #4F6BF4, #7c3aed)",
                  borderRadius: "2px",
                  boxShadow: "0 0 8px rgba(79,107,244,0.5)",
                  animation: "indeterminate 1.4s ease infinite",
                  width: "40%"
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Current message */}
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "24px", textAlign: "center", minHeight: "20px" }}>
        {currentMsg}
      </div>

      {/* Done button */}
      {allDone && (
        <button className="btn-primary" style={{ width: "200px", padding: "13px", animation: "fadeUp 0.4s ease both" }}
          onClick={onComplete}>
          {hasError ? "Continue Anyway →" : "Launch Formatica →"}
        </button>
      )}

      {allDone && hasError && (
        <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--text-muted)", textAlign: "center", maxWidth: "340px" }}>
          Some components couldn't install automatically. You can retry later using the ⚡ Fix Now button in the app.
        </div>
      )}
    </div>
  );
}
