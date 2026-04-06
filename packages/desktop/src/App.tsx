import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";
import { Layout } from "./components/Layout";

type Theme = "dark" | "light";
type Screen = 
  | "home" | "document" | "image" | "download" | "audio" | "video" | "imageconvert" 
  | "compress" | "mergepdf" | "splitpdf" | "greyscalepdf" | "onboarding"
  | "ocr" | "watermark" | "batchfolder" | "queue" | "shortcuts" | "settings" | "monitor"
  | "media_download";

const STAGES = ["Input", "Configuration", "Processing"];

interface TaskResult {
  success: boolean;
  outputPath: string;
  errorMessage: string;
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

interface ProcessTask {
  id: string;
  name: string;
  tool: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  timeRemaining?: string;
  startTime: number;
  inputPath: string;
  outputPath?: string;
  error?: string;
}

interface ToolScreenProps {
  onBack: () => void;
  addTask: (task: Omit<ProcessTask, "id" | "startTime" | "progress" | "status">) => string;
  updateTask: (id: string, patch: Partial<ProcessTask>) => void;
  tasks: ProcessTask[];
  state: any;
  updateState: (patch: any) => void;
  deps: DepStatus[];
  onFixDeps: () => void;
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
  // Dispatch custom event to notify HistoryPanel
  window.dispatchEvent(new Event('mds_activity_updated'));
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("mds_theme") as Theme) || "dark");
  const [screen, setScreen] = useState<Screen>("home");
  const [deps, setDeps] = useState<DepStatus[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [toast, setToast] = useState<{ key: string; action: string } | null>(null);
  const [tasks, setTasks] = useState<ProcessTask[]>([]);
  const [screenStates, setScreenStates] = useState<Record<string, any>>({});

  const getScreenState = (id: string, defaults: any) => screenStates[id] || defaults;
  const updateScreenState = (id: string, patch: any) => {
    setScreenStates((prev: Record<string, any>) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch }
    }));
  };

  const addTask = (task: Omit<ProcessTask, "id" | "startTime" | "progress" | "status">) => {
    const newTask: ProcessTask = {
      ...task,
      id: Math.random().toString(36).substring(7),
      startTime: Date.now(),
      progress: 0,
      status: "processing"
    };
    setTasks((prev: ProcessTask[]) => [newTask, ...prev]);
    return newTask.id;
  };

  const updateTask = (id: string, patch: Partial<ProcessTask>) => {
    setTasks((prev: ProcessTask[]) => prev.map((t: ProcessTask) => t.id === id ? { ...t, ...patch } : t));
  };

  const removeTask = (id: string) => {
    setTasks((prev: ProcessTask[]) => prev.filter((t: ProcessTask) => t.id !== id));
  };

  const showKbdToast = (key: string, action: string) => {
    setToast({ key, action });
    setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => {
    invoke<boolean>("is_first_run").then((first: boolean) => {
      if (first) setShowOnboarding(true);
    });
    invoke("get_setup_status").then((status: any) => {
      if (status.needs_setup && !showOnboarding) {
        setShowSetup(true);
      }
    });
  }, [showOnboarding]);

  useEffect(() => {
    invoke<DepStatus[]>("check_dependencies").then(setDeps).catch(console.error);
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
  }, [screen]); // Refetch on screen change to stay synced

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = (e.ctrlKey || e.metaKey ? "ctrl+" : "") + e.key.toLowerCase();
      
      const map: Record<string, { action: string; screen: Screen }> = {
        "ctrl+1": { action: "Convert document", screen: "document" },
        "ctrl+2": { action: "Images to PDF", screen: "image" },
        "ctrl+3": { action: "Merge PDF", screen: "mergepdf" },
        "ctrl+4": { action: "Split PDF", screen: "splitpdf" },
        "ctrl+5": { action: "OCR PDF", screen: "ocr" },
        "ctrl+6": { action: "Compress video", screen: "compress" },
        "ctrl+7": { action: "Convert image", screen: "imageconvert" },
        "ctrl+8": { action: "Watermark", screen: "watermark" },
        "ctrl+q": { action: "Queue", screen: "queue" },
        "ctrl+,": { action: "Settings", screen: "settings" },
        "ctrl+m": { action: "Resource monitor", screen: "monitor" },
        "ctrl+/": { action: "Shortcuts", screen: "shortcuts" },
      };

      if (map[key]) {
        e.preventDefault();
        showKbdToast(map[key].action, key.toUpperCase().replace("CTRL+", "Ctrl + "));
        setScreen(map[key].screen);
      }

      if (key === "ctrl+d") {
        e.preventDefault();
        toggleTheme();
        showKbdToast("Toggle Theme", "Ctrl + D");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const handleFixDeps = async () => {
    setShowSetup(true);
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
        {screen === "document" && (
          <DocumentScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks}
            state={getScreenState("document", { stage: 1, file: null, outputName: "" })}
            updateState={(p: any) => updateScreenState("document", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "image" && (
          <ImageScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks}
            state={getScreenState("image", { stage: 1, files: [], outputName: "combined_images" })}
            updateState={(p: any) => updateScreenState("image", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "ocr" && (
          <OCRScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks}
            state={getScreenState("ocr", { stage: 1, file: null, outputName: "", activeTaskId: null })}
            updateState={(p: any) => updateScreenState("ocr", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "watermark" && (
          <WatermarkScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks}
            state={getScreenState("watermark", { stage: 1, file: null, outputName: "", activeTaskId: null })}
            updateState={(p: any) => updateScreenState("watermark", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "compress" && (
          <CompressVideoScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks} 
            state={getScreenState("compress", { stage: 1, files: [], activeTaskIds: [] })}
            updateState={(p: any) => updateScreenState("compress", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "mergepdf" && (
          <MergePDFScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks} 
            state={getScreenState("mergepdf", { stage: 1, files: [], outputName: "merged_document" })}
            updateState={(p: any) => updateScreenState("mergepdf", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "splitpdf" && (
          <SplitPDFScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks} 
            state={getScreenState("splitpdf", { stage: 1, file: null, mode: "count", value: "5" })}
            updateState={(p: any) => updateScreenState("splitpdf", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "greyscalepdf" && (
          <GreyscalePDFScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks} 
            state={getScreenState("greyscalepdf", { stage: 1, file: null, outputName: "" })}
            updateState={(p: any) => updateScreenState("greyscalepdf", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "audio" && (
          <AudioScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks} 
            state={getScreenState("audio", { stage: 1, file: null, outputName: "" })}
            updateState={(p: any) => updateScreenState("audio", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "video" && (
          <VideoScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks} 
            state={getScreenState("video", { stage: 1, file: null, outputName: "" })}
            updateState={(p: any) => updateScreenState("video", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "imageconvert" && (
          <ImageConvertScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks} 
            state={getScreenState("imageconvert", { stage: 1, file: null, outputName: "" })}
            updateState={(p: any) => updateScreenState("imageconvert", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "download" && (
          <DownloadScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks} 
            state={getScreenState("download", { stage: 1, url: "", outputName: "", format: "mp4" })}
            updateState={(p: any) => updateScreenState("download", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "media_download" && (
          <DownloadScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks} 
            state={getScreenState("media_download", { stage: 1, url: "", outputName: "", format: "mp4" })}
            updateState={(p: any) => updateScreenState("media_download", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "batchfolder" && (
          <BatchFolderScreen 
            onBack={() => setScreen("home")} 
            addTask={addTask} 
            updateTask={updateTask} 
            tasks={tasks} 
            state={getScreenState("batchfolder", { stage: 1, path: "", action: "pdf_to_docx" })}
            updateState={(p: any) => updateScreenState("batchfolder", p)}
            deps={deps}
            onFixDeps={handleFixDeps}
          />
        )}
        {screen === "queue" && <QueueScreen onBack={() => setScreen("home")} tasks={tasks} removeTask={removeTask} />}
        {screen === "shortcuts" && <ShortcutsScreen onBack={() => setScreen("home")} />}
        {screen === "settings" && <SettingsScreen onBack={() => setScreen("home")} />}
        {screen === "monitor" && <MonitorScreen onBack={() => setScreen("home")} />}
      </div>

      {toast && (
        <div className={`kbd-toast ${toast ? "show" : ""}`}>
          <span className="kt-key">{toast.key}</span>
          <span>{toast.action}</span>
        </div>
      )}
    </Layout>
  );
}

// ── Home Screen ───────────────────────────────────────────────────
function HomeScreen({ setScreen }: { setScreen: (s: Screen) => void }) {

  const tiles = [
    { id: "document",     icon: "📄", color: "doc",     title: "Convert Document", desc: "DOCX, PDF, XLSX, ODT, PPTX" },
    { id: "image",        icon: "🖼️", color: "img",     title: "Images to PDF",    desc: "Combine images into one file" },
    { id: "media_download", icon: "📥", color: "dl",      title: "Media Downloader", desc: "Save online videos locally" },
    { id: "audio",        icon: "🎵", color: "audio",   title: "Extract Audio",    desc: "MP3, AAC, WAV from video" },
    { id: "video",        icon: "🎬", color: "video",   title: "Convert Video",    desc: "MP4, MKV, MOV, AVI, WEBM" },
    { id: "compress",     icon: "🗜️", color: "comp",    title: "Compress Video",   desc: "Resize and reduce file size" },
    { id: "imageconvert", icon: "🔄", color: "imgconv", title: "Convert Image",    desc: "JPG, PNG, WEBP, GIF, BMP" },
    { id: "mergepdf",     icon: "🔗", color: "doc",     title: "Merge PDF",      desc: "Combine multiple PDFs into one" },
    { id: "splitpdf",     icon: "✂️", color: "comp",    title: "Split PDF",      desc: "Break PDF by page count or ranges" },
    { id: "greyscalepdf", icon: "🎨", color: "imgconv", title: "Greyscale PDF",  desc: "Convert colour PDF to greyscale" },
    { id: "ocr",          icon: "🔍", color: "doc",     title: "OCR PDF",        desc: "Convert scanned PDFs to text" },
    { id: "watermark",    icon: "💧", color: "imgconv", title: "Watermark",      desc: "Protect images with overlays" },
    { id: "batchfolder",  icon: "📁", color: "comp",    title: "Batch Folder",   desc: "Convert entire folders at once" },
  ] as const;

  return (
    <div className="screen active">
      <div className="pt">All Tools</div>
      <div className="ps">Select a module to begin processing your files</div>
      <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
        {tiles.map(t => (
          <button key={t.id} className="panel" onClick={() => setScreen(t.id as Screen)} style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}>
            <div className="tl" style={{ marginBottom: '12px' }}>
              <div className="logo" style={{ background: `var(--accent)`, width: '32px', height: '32px' }}>{t.icon}</div>
              <div className="appname" style={{ color: 'var(--text)', fontSize: '14px' }}>{t.title}</div>
            </div>
            <div className="ps" style={{ marginBottom: 0 }}>{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Document Screen ───────────────────────────────────────────────
function DocumentScreen({ onBack, addTask, updateTask, tasks, state, updateState }: ToolScreenProps) {
  const { stage, file, outputFormat = "pdf", outputName, activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("document");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFile = (f: any) => updateState({ file: f });
  const setOutputFormat = (f: string) => updateState({ outputFormat: f });
  const setOutputName = (n: string) => updateState({ outputName: n });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);
  const formats = ["pdf","docx","odt","txt","html","rtf","xlsx","csv"];

  useEffect(() => {
    if (file && !outputName) {
      setOutputName(file.name.split('.').slice(0, -1).join('.') + "_converted");
    }
  }, [file]);

  const pickFile = async () => {
    const selected = await open({ multiple: false, filters: [{ name: "Documents", extensions: ["docx","pdf","xlsx","csv","txt","odt","rtf","pptx"] }] });
    if (selected && !Array.isArray(selected)) {
      setFile({ name: selected.split(/[\\/]/).pop(), path: selected });
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory: true, multiple: false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const run = async () => {
    if (!file || !outputDir) return;
    setStage(3);
    
    const tid = addTask({
      name: outputName + "." + outputFormat,
      tool: "DOC Convert",
      inputPath: file.path,
    });
    setActiveTaskId(tid);

    try {
      const res = await invoke<TaskResult>("convert_document", { 
        inputPath: file.path, 
        outputFormat: outputFormat, 
        outputDir: outputDir,
        outputName: outputName
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ 
          name: file.name, 
          meta: `→ ${outputFormat.toUpperCase()}`, 
          time: "Just now" 
        });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) {
        setFile({ name: paths[0].split(/[\\/]/).pop(), path: paths[0] });
        setStage(2);
      }
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
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">Document Converter</div>
          <div className="ps">Professional local document transformation</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>
      
      {stage === 1 && (
        <div className={`panel animate-in ${isDragOver ? "drag-over" : ""}`} style={{ padding: '60px' }}>
          <div className="plabel" style={{ textAlign: 'center' }}>Stage 1: Select Document</div>
          <div className="dz" onClick={pickFile}>
            <div className="dz-icon">📄</div>
            <div className="dz-main">Drop file or <span className="bl">Browse</span></div>
            <div className="dz-sub">DOCX · PDF · XLSX · ODT · RTF · PPTX</div>
          </div>
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Configuration</div>
          
          <div className="srow">
            <div className="slabel">Adjust Filename</div>
            <div className="sfield">
              <input className="sinput" value={outputName} onChange={e => setOutputName(e.target.value)} />
              <div className="sbtn">.{outputFormat}</div>
            </div>
          </div>

          <div className="fmt-gl" style={{ marginTop: '20px' }}>Target Format</div>
          <div className="fmtb">
            {formats.map(f => (
              <div key={f} className={`fb ${outputFormat === f ? "active" : ""}`} onClick={() => setOutputFormat(f)}>
                {f.toUpperCase()}
              </div>
            ))}
          </div>

          <div className="srow" style={{ marginTop: '20px' }}>
            <div className="slabel">Save To Folder</div>
            <div className="sfield">
              <input className="sinput" value={outputDir || "No folder selected"} readOnly />
              <button className="sbtn" onClick={pickDir}>Browse</button>
            </div>
          </div>

          <div className="info-card" style={{ marginTop: '20px' }}>
             <div className="ps" style={{ margin: 0 }}>Documents are processed locally using the LibreOffice engine.</div>
          </div>

          <button className="abtn primary" style={{ marginTop: '24px' }} onClick={() => setStage(3)} disabled={!outputDir}>
            Proceed to Conversion →
          </button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => { setFile(null); setStage(1); }}>Change File</button>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
           {!activeTask ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Summary:</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', margin: '8px 0' }}>{file.name} ➜ {outputName}.{outputFormat}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Destination: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={run}>⚡ Start Conversion</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Config</button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  {activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}
                </div>
                <div className="pt">{activeTask.status === "processing" ? "Converting..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
                <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
                
                <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ 
                    width: `${activeTask.progress || 100}%`,
                    animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none'
                  }} />
                </div>

                {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open File</button>
                    <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => updateState({ stage: 1, file: null, outputName: "", activeTaskId: null })}>🔄 Convert More</button>
                  </div>
                )}

                {activeTask.status === "failed" && (
                  <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>
                )}
                {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry</button>}

                {activeTask.status === "processing" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button className="abtn secondary" onClick={onBack}>Run in Background</button>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

// ── Audio Screen ──────────────────────────────────────────────────
function AudioScreen({ onBack, addTask, updateTask, tasks, state, updateState }: ToolScreenProps) {
  const { stage, file, outputFormat = "mp3", outputName, bitrate = "192", activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("audio");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFile = (f: any) => updateState({ file: f });
  const setOutputFormat = (f: string) => updateState({ outputFormat: f });
  const setOutputName = (n: string) => updateState({ outputName: n });
  const setBitrate = (b: string) => updateState({ bitrate: b });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);
  const formats = ["mp3","aac","wav","flac","ogg","m4a","opus"];

  useEffect(() => {
    if (file) {
      setOutputName(file.name.split('.').slice(0, -1).join('.') + "_audio");
    }
  }, [file]);

  const pickFile = async () => {
    const s = await open({ multiple:false, filters:[{name:"Media",extensions:["mp4","mkv","avi","mov","webm","flv","mp3","wav","flac","ogg","m4a"]}] });
    if (s && !Array.isArray(s)) {
      setFile({ name: s.split(/[\\/]/).pop(), path: s });
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory:true, multiple:false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const run = async () => {
    if (!file || !outputDir) return;
    
    const tid = addTask({
      name: outputName + "." + outputFormat,
      tool: "Audio Extract",
      inputPath: file.path,
    });
    setActiveTaskId(tid);

    try {
      const res = await invoke<TaskResult>("convert_audio", { 
        inputPath: file.path, 
        outputFormat: outputFormat, 
        bitrate: bitrate + "k", 
        outputDir: outputDir,
        outputName: outputName
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ 
          name: file.name, 
          meta: `→ ${outputFormat.toUpperCase()} (${bitrate}k)`, 
          time: "Just now" 
        });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) {
        setFile({ name: paths[0].split(/[\\/]/).pop(), path: paths[0] });
        setStage(2);
      }
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
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">Audio Extractor</div>
          <div className="ps">Extract or convert high-quality audio tracks</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>
      
      {stage === 1 && (
        <div className={`panel animate-in ${isDragOver ? "drag-over" : ""}`} style={{ padding: '60px' }}>
          <div className="plabel" style={{ textAlign: 'center' }}>Stage 1: Select Media</div>
          <div className="dz" onClick={pickFile}>
            <div className="dz-icon">🎵</div>
            <div className="dz-main">Drop audio/video or <span className="bl">Browse</span></div>
            <div className="dz-sub">MP4 · MKV · MP3 · WAV · FLAC</div>
          </div>
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Configuration & Settings</div>
          
          <div className="srow">
            <div className="slabel">Adjust Filename</div>
            <div className="sfield">
              <input className="sinput" value={outputName} onChange={e => setOutputName(e.target.value)} />
              <div className="sbtn">.{outputFormat}</div>
            </div>
          </div>

          <div className="fmt-gl" style={{ marginTop: '20px' }}>Target Format</div>
          <div className="fmtb">
            {formats.map(f => (
              <div key={f} className={`fb ${outputFormat === f ? "active" : ""}`} onClick={() => setOutputFormat(f)}>
                {f.toUpperCase()}
              </div>
            ))}
          </div>

          <div className="srow" style={{ marginTop: '20px' }}>
            <div className="slabel">Audio Quality: {bitrate} kbps</div>
            <div className="slider-wrap">
              <input type="range" min="64" max="320" step="32" value={bitrate} onChange={e => setBitrate(e.target.value)} style={{ width: '100%' }} />
              <div className="slider-labels"><span>Smaller</span><span>High Quality</span></div>
            </div>
          </div>

          <div className="srow" style={{ marginTop: '20px' }}>
            <div className="slabel">Save To Folder</div>
            <div className="sfield">
              <input className="sinput" value={outputDir || "No folder selected"} readOnly />
              <button className="sbtn" onClick={pickDir}>Browse</button>
            </div>
          </div>

          <button className="abtn primary" style={{ marginTop: '24px' }} onClick={() => setStage(3)} disabled={!outputDir}>
            Proceed to Extraction →
          </button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => { setFile(null); setStage(1); }}>Change File</button>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
           {!activeTask ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Summary:</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', margin: '8px 0' }}>{file.name} ➜ {outputName}.{outputFormat}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bitrate: {bitrate}kbps · Output: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={run}>⚡ Start Extraction</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Settings</button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  {activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}
                </div>
                <div className="pt">{activeTask.status === "processing" ? "Extracting..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
                <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
                
                <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ 
                    width: `${activeTask.progress || 100}%`,
                    animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none'
                  }} />
                </div>

                {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open File</button>
                    <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => updateState({ stage: 1, file: null, outputName: "", activeTaskId: null })}>🔄 Convert More</button>
                  </div>
                )}

                {activeTask.status === "failed" && (
                  <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>
                )}
                {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry Setup</button>}

                {activeTask.status === "processing" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button className="abtn secondary" onClick={() => onBack()}>Run in Background</button>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
}




// ── Image to PDF Screen ───────────────────────────────────────────
function ImageScreen({ onBack, addTask, updateTask, tasks, state, updateState }: ToolScreenProps) {
  const { stage, files = [], outputName = "combined_images", layout = "A4", activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("imagepdf");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFiles = (f: any[]) => updateState({ files: f });
  const setOutputName = (n: string) => updateState({ outputName: n });
  const setLayout = (l: string) => updateState({ layout: l });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);

  useEffect(() => {
    if (files.length > 0 && outputName === "combined_images") {
      const base = files[0].name.split('.').slice(0, -1).join('.');
      setOutputName(`${base}_bundle`);
    }
  }, [files]);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) {
        const newImgFiles = paths.map((p: string) => ({ name: p.split(/[\\/]/).pop(), path: p }));
        setFiles([...files, ...newImgFiles]);
        setStage(2);
      }
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  const pickFiles = async () => {
    const selected = await open({ multiple: true, filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }] });
    if (selected && Array.isArray(selected)) {
      const newImgFiles = selected.map((p: string) => ({ name: p.split(/[\\/]/).pop(), path: p }));
      setFiles([...files, ...newImgFiles]);
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory: true, multiple: false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const run = async () => {
    if (files.length === 0 || !outputDir || !outputName) return;
    
    const tid = addTask({
      name: `${outputName}.pdf`,
      tool: "Images to PDF",
      inputPath: `${files.length} images`,
    });
    setActiveTaskId(tid);

    try {
      const res = await invoke<TaskResult>("images_to_pdf", { 
        imagePaths: files.map((f: any) => f.path), 
        outputPath: outputDir + "\\" + outputName + ".pdf"
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ name: outputName + ".pdf", meta: "Images → PDF", time: "Just now" });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  return (
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">Images to PDF</div>
          <div className="ps">Combine multiple photos into a single PDF</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>

      {stage === 1 && (
        <div className="animate-in">
          <div className={`panel ${isDragOver ? "drag-over" : ""}`} style={{ padding: '40px' }}>
            <div className="plabel" style={{ textAlign: 'center' }}>Stage 1: Select Images</div>
            <div className="dz" onClick={pickFiles}>
              <div className="dz-icon">📸</div>
              <div className="dz-main">Drop Images or <span className="bl">Browse</span></div>
              <div className="dz-sub">Select one or more images to combine</div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="panel" style={{ marginTop: '20px' }}>
              <div className="plabel">Selected Images ({files.length})</div>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {files.map((f: { name: string; path: string }, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                    <span>{f.name}</span>
                    <button style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }} onClick={() => setFiles(files.filter((_: any, idx: number) => idx !== i))}>Remove</button>
                  </div>
                ))}
              </div>
              <button className="abtn primary" style={{ marginTop: '20px' }} onClick={() => setStage(2)}>Continue to Configuration →</button>
            </div>
          )}
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Configuration & Destination</div>
          
          <div className="srow">
            <div className="slabel">Set PDF Filename</div>
            <div className="sfield">
              <input className="sinput" value={outputName} onChange={e => setOutputName(e.target.value)} />
              <div className="sbtn">.pdf</div>
            </div>
          </div>

          <div className="fmt-gl" style={{ marginTop: '20px' }}>Page Layout</div>
          <div className="fmtb">
            <div className={`fb ${layout === "A4" ? "active" : ""}`} onClick={() => setLayout("A4")}>A4 Paper</div>
            <div className={`fb ${layout === "Fit" ? "active" : ""}`} onClick={() => setLayout("Fit")}>Fit to Image</div>
          </div>

          <div className="srow" style={{ marginTop: '24px' }}>
             <div className="slabel">Save To Folder</div>
             <div className="sfield">
               <input className="sinput" value={outputDir || "No folder selected"} readOnly />
               <button className="sbtn" onClick={pickDir}>Browse</button>
             </div>
          </div>

          <button className="abtn primary" style={{ marginTop: '24px' }} onClick={() => setStage(3)} disabled={!outputDir || !outputName}>Review & Generate →</button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Back</button>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
           {!activeTask ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Workflow Summary:</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', margin: '8px 0' }}>{files.length} Images ➜ {outputName}.pdf</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Destination: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={run}>⚡ Start PDF Merger Engine</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Config</button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  {activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}
                </div>
                <div className="pt">{activeTask.status === "processing" ? "Building PDF..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
                <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
                
                <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ 
                    width: `${activeTask.progress || 100}%`,
                    animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none'
                  }} />
                </div>

                {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open File</button>
                    <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => updateState({ stage: 1, files: [], outputName: "", activeTaskId: null })}>🔄 Create More</button>
                  </div>
                )}

                {activeTask.status === "failed" && (
                  <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>
                )}
                {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry Setup</button>}

                {activeTask.status === "processing" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="abtn primary" onClick={() => { setStage(1); setFiles([]); setActiveTaskId(null); }}>Combine More</button>
                    <button className="abtn secondary" onClick={() => onBack()}>Run in Background</button>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

// ── Video Convert Screen ──────────────────────────────────────────
function VideoScreen({ onBack, addTask, updateTask, tasks, state, updateState }: ToolScreenProps) {
  const { stage, file, outputFormat = "mp4", outputName, quality = "medium", activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("video");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFile = (f: any) => updateState({ file: f });
  const setOutputFormat = (f: string) => updateState({ outputFormat: f });
  const setOutputName = (n: string) => updateState({ outputName: n });
  const setQuality = (q: string) => updateState({ quality: q });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);
  const formats = ["mp4","mkv","mov","avi","webm","gif"];

  useEffect(() => {
    if (file) {
      setOutputName(file.name.split('.').slice(0, -1).join('.') + "_converted");
    }
  }, [file]);

  const pickFile = async () => {
    const s = await open({ multiple:false, filters:[{name:"Video",extensions:["mp4","mkv","avi","mov","webm","flv","wmv","m4v"]}] });
    if (s && !Array.isArray(s)) {
      setFile({ name: s.split(/[\\/]/).pop(), path: s });
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory:true, multiple:false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const run = async () => {
    if (!file || !outputDir) return;
    
    const tid = addTask({
      name: outputName + "." + outputFormat,
      tool: "Video Convert",
      inputPath: file.path,
    });
    setActiveTaskId(tid);

    try {
      const res = await invoke<TaskResult>("convert_video", { 
        inputPath: file.path, 
        outputFormat: outputFormat, 
        outputDir: outputDir,
        quality,
        preset: null,
        outputName: outputName
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ 
          name: file.name, 
          meta: `→ ${outputFormat.toUpperCase()} (${quality})`, 
          time: "Just now" 
        });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) {
        setFile({ name: paths[0].split(/[\\/]/).pop(), path: paths[0] });
        setStage(2);
      }
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
    <div className="screen active">
       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">Video Converter</div>
          <div className="ps">Professional local video transcoding</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>
      
      {stage === 1 && (
        <div className={`panel animate-in ${isDragOver ? "drag-over" : ""}`} style={{ padding: '60px' }}>
          <div className="plabel" style={{ textAlign: 'center' }}>Stage 1: Select Video</div>
          <div className="dz" onClick={pickFile}>
            <div className="dz-icon">📹</div>
            <div className="dz-main">{file ? file.name : "Drop video or Browse"}</div>
            <div className="dz-sub">MP4 · MKV · AVI · MOV · WEBM</div>
          </div>
          {file && (
            <button className="abtn primary" style={{ marginTop: '30px' }} onClick={() => setStage(2)}>Continue to Configuration →</button>
          )}
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Configuration & Destination</div>
          
          <div className="srow">
            <div className="slabel">Adjust Filename</div>
            <div className="sfield">
              <input className="sinput" value={outputName} onChange={e => setOutputName(e.target.value)} />
              <div className="sbtn">.{outputFormat}</div>
            </div>
          </div>

          <div className="fmt-gl" style={{ marginTop: '20px' }}>Target Format</div>
          <div className="fmtb">
            {formats.map(f => (
              <div key={f} className={`fb ${outputFormat === f ? "active" : ""}`} onClick={() => setOutputFormat(f)}>
                {f.toUpperCase()}
              </div>
            ))}
          </div>

          <div className="fmt-gl" style={{ marginTop: '20px' }}>Output Quality</div>
          <div className="fmtb">
            {["high", "medium", "low"].map(q => (
              <div key={q} className={`fb ${quality === q ? "active" : ""}`} onClick={() => setQuality(q)}>
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </div>
            ))}
          </div>

          <div className="srow" style={{ marginTop: '24px' }}>
            <div className="slabel">Save To Folder</div>
            <div className="sfield">
              <input className="sinput" value={outputDir || "No folder selected"} readOnly />
              <button className="sbtn" onClick={pickDir}>Browse</button>
            </div>
          </div>

          <button className="abtn primary" style={{ marginTop: '24px' }} onClick={() => setStage(3)} disabled={!outputDir || !outputName}>Review & Transcode →</button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Back</button>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
           {!activeTask ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Workflow Summary:</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', margin: '8px 0' }}>{file.name} ➜ {outputName}.{outputFormat}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quality: {quality.toUpperCase()} · Destination: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={run}>⚡ Start Conversion Engine</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Config</button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  {activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}
                </div>
                <div className="pt">{activeTask.status === "processing" ? "Transcoding Video..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
                <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
                
                <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ 
                    width: `${activeTask.progress || 100}%`,
                    animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none'
                  }} />
                </div>

                {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open File</button>
                    <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => updateState({ stage: 1, file: null, outputName: "", activeTaskId: null })}>🔄 Convert More</button>
                  </div>
                )}

                {activeTask.status === "failed" && (
                  <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>
                )}
                {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry Setup</button>}

                {activeTask.status === "processing" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="gpu-badge" style={{ margin: '0 auto 16px auto' }}>
                      <div className="gpu-badge-dot" />
                      Hardware Accel Active
                    </div>
                    <button className="abtn secondary" onClick={() => onBack()}>Run in Background</button>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

// ── Compress Video Screen ─────────────────────────────────────────
function CompressVideoScreen({ onBack, addTask, updateTask, tasks, state, updateState }: ToolScreenProps) {
  const { stage, files = [], outputFormat = "mp4", resolution = "1080p", crf = "23", preset = "fast", activeTaskIds = [], outputName = "" } = state;
  const [outputDir, saveOutputDir] = useSavedPath("compress");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFiles = (f: any[]) => updateState({ files: f });
  const setOutputFormat = (f: string) => updateState({ outputFormat: f });
  const setResolution = (r: string) => updateState({ resolution: r });
  const setCrf = (c: string) => updateState({ crf: c });
  const setPreset = (p: string) => updateState({ preset: p });
  const setActiveTaskIds = (ids: string[]) => updateState({ activeTaskIds: ids });
  const setOutputName = (n: string) => updateState({ outputName: n });

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) {
        setFiles(paths.map((p: any) => ({ name: p.split(/[\\/]/).pop(), path: p })));
        setStage(2);
      }
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  const pickFiles = async () => {
    const selected = await open({ multiple:true, filters:[{name:"Video",extensions:["mp4","mkv","avi","mov","webm","flv"]}] });
    if (selected && Array.isArray(selected)) {
      setFiles(selected.map(s => ({ name: s.split(/[\\/]/).pop(), path: s })));
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory:true, multiple:false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const run = async () => {
    if (!files.length || !outputDir) return;
    
    const tids: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const finalName = files.length === 1 && outputName 
        ? outputName 
        : (outputName || f.name.split('.').slice(0, -1).join('.')) + (files.length > 1 ? `_${i+1}` : "_compressed");
      
      const tid = addTask({
        name: finalName + "." + outputFormat,
        tool: "Batch Compression",
        inputPath: f.path,
      });
      tids.push(tid);
    }
    setActiveTaskIds(tids);

    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const tid = tids[i];
        try {
            const finalName = files.length === 1 && outputName 
                ? outputName 
                : (outputName || f.name.split('.').slice(0, -1).join('.')) + (files.length > 1 ? `_${i+1}` : "_compressed");

            const res = await invoke<TaskResult>("compress_video", { 
                inputPath: f.path, 
                outputFormat: outputFormat, 
                outputDir: outputDir, 
                resolution, 
                crf, 
                preset,
                outputName: finalName
            });
            if (res.success) {
                updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
                addActivity({ name: f.name, meta: `Compressed to ${resolution}`, time: "Just now" });
            } else {
                updateTask(tid, { status: "failed", error: res.errorMessage });
            }
        } catch(e) {
            updateTask(tid, { status: "failed", error: String(e) });
        }
    }
  };

  const currentActiveTasks = tasks.filter((t: ProcessTask) => activeTaskIds.includes(t.id));
  const completedCount = currentActiveTasks.filter((t: ProcessTask) => t.status !== 'processing').length;

  return (
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">Batch Video Compressor</div>
          <div className="ps">Advanced multi-threaded local compression</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>

      {stage === 1 && (
        <div className={`panel animate-in ${isDragOver ? "drag-over" : ""}`} style={{ padding: '60px' }}>
          <div className="plabel" style={{ textAlign: 'center' }}>Stage 1: Select Videos</div>
          <div className="dz" onClick={pickFiles}>
            <div className="dz-icon">🗜️</div>
            <div className="dz-main">{files.length > 0 ? `${files.length} Videos Ready` : "Drop multiple videos or Browse"}</div>
            <div className="dz-sub">Batch processing supported · Local only</div>
          </div>
          {files.length > 0 && (
            <button className="abtn primary" style={{ marginTop: '30px' }} onClick={() => setStage(2)}>Continue to Settings →</button>
          )}
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Configuration & Destination</div>
          
          <div className="two-col">
              <div>
                <div className="slabel">Target Resolution</div>
                <div className="fmtb" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    {["original", "1080p", "720p", "480p"].map(r => (
                        <div key={r} className={`fb ${resolution === r ? "active" : ""}`} onClick={() => setResolution(r)}>{r === 'original' ? 'Original' : r}</div>
                    ))}
                </div>
              </div>
              <div>
                <div className="slabel">Encoding Speed</div>
                <div className="fmtb" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    {["ultrafast", "fast", "medium", "slow"].map(p => (
                        <div key={p} className={`fb ${preset === p ? "active" : ""}`} onClick={() => setPreset(p)}>{p}</div>
                    ))}
                </div>
              </div>
          </div>

          <div className="srow" style={{ marginTop: '16px' }}>
            <div className="slabel">Compression Intensity (CRF: {crf})</div>
            <input type="range" min="18" max="32" step="1" value={crf} onChange={e => setCrf(e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '4px', opacity: 0.6 }}>
                 <span>High Quality (Large)</span>
                 <span>Balanced</span>
                 <span>Max Compression (Small)</span>
            </div>
          </div>

          <div className="fmt-gl" style={{ marginTop: '20px' }}>Target Format</div>
          <div className="fmtb">
            {["mp4","mkv","mov","avi","webm"].map(f => (
              <div key={f} className={`fb ${outputFormat === f ? "active" : ""}`} onClick={() => setOutputFormat(f)}>
                {f.toUpperCase()}
              </div>
            ))}
          </div>

          <div className="srow" style={{ marginTop: '24px' }}>
            <div className="slabel">Save To Folder</div>
            <div className="sfield">
              <input className="sinput" value={outputDir || "No folder selected"} readOnly />
              <button className="sbtn" onClick={pickDir}>Browse</button>
            </div>
          </div>

          <button className="abtn primary" style={{ marginTop: '24px' }} onClick={() => setStage(3)} disabled={!outputDir}>Review & Compress Batch →</button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Back</button>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTaskIds.length > 0 ? "Batch Processing" : "Ready"}</div>
           {activeTaskIds.length === 0 ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Batch Summary:</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', margin: '8px 0' }}>{files.length} Videos ➜ {outputFormat.toUpperCase()}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Res: {resolution} · CRF: {crf} · Destination: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={run}>⚡ Start Batch Compression</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Settings</button>
             </div>
           ) : (
             <div style={{ padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div className="pt" style={{ fontSize: '18px' }}>{completedCount === files.length ? "Batch Complete" : "Processing Batch..."}</div>
                  <div className="ps">{completedCount}/{files.length} Done</div>
                </div>
                
                <div className="rm-bar-bg" style={{ height: '12px', marginBottom: '24px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ width: `${(completedCount/files.length)*100}%` }} />
                </div>
                
                <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                  {currentActiveTasks.map((t: ProcessTask) => (
                    <div key={t.id} className="info-card" style={{ marginBottom: '8px', padding: '10px', opacity: t.status === 'processing' ? 1 : 0.7 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                          <span style={{ 
                            color: t.status === 'completed' ? 'var(--green)' : t.status === 'failed' ? 'var(--red)' : 'var(--accent)',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}>
                              {t.status === 'completed' ? 'Success ✓' : t.status === 'failed' ? 'Error ❌' : 'Working...'}
                          </span>
                      </div>
                    </div>
                  ))}
                </div>

                {completedCount === files.length && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_in_folder", { path: outputDir }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn secondary bl" onClick={() => { setStage(1); setFiles([]); setActiveTaskIds([]); setOutputName(""); }}>⚡ New Batch</button>
                  </div>
                )}
                {completedCount < files.length && (
                  <button className="abtn secondary" style={{ marginTop: '24px' }} onClick={() => onBack()}>Run in Background</button>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

// ── Image Convert Screen ──────────────────────────────────────────
function ImageConvertScreen({ onBack, addTask, updateTask, tasks, state, updateState }: ToolScreenProps) {
  const { stage, file, outputFormat = "webp", outputName, quality = "85", activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("imgconv");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFile = (f: any) => updateState({ file: f });
  const setOutputFormat = (f: string) => updateState({ outputFormat: f });
  const setOutputName = (n: string) => updateState({ outputName: n });
  const setQuality = (q: string) => updateState({ quality: q });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);
  const formats = ["jpg","png","webp","gif","bmp","tiff"];

  useEffect(() => {
    if (file) {
      setOutputName(file.name.split('.').slice(0, -1).join('.') + "_converted");
    }
  }, [file]);

  const pickFile = async () => {
    const s = await open({ multiple:false, filters:[{name:"Images",extensions:["jpg","jpeg","png","webp","bmp","tiff","gif"]}] });
    if (s && !Array.isArray(s)) {
      setFile({ name: s.split(/[\\/]/).pop(), path: s });
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory:true, multiple:false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const run = async () => {
    if (!file || !outputDir) return;
    
    const tid = addTask({
      name: outputName + "." + outputFormat,
      tool: "Image Convert",
      inputPath: file.path,
    });
    setActiveTaskId(tid);

    try {
      const res = await invoke<TaskResult>("convert_image_format", { 
        inputPath: file.path, 
        outputFormat: outputFormat, 
        outputDir: outputDir,
        outputName: outputName
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ 
          name: file.name, 
          meta: `→ ${outputFormat.toUpperCase()}`, 
          time: "Just now" 
        });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) {
        setFile({ name: paths[0].split(/[\\/]/).pop(), path: paths[0] });
        setStage(2);
      }
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  const qualityNum = parseInt(quality);
  const qualityLabel = qualityNum >= 90 ? "Lossless" : qualityNum >= 75 ? "Good" : qualityNum >= 60 ? "Balanced" : "Small File";

  return (
    <div className="screen active">
       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">Image Converter</div>
          <div className="ps">Professional local image transformation</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>
      
      {stage === 1 && (
        <div className={`panel animate-in ${isDragOver ? "drag-over" : ""}`} style={{ padding: '60px' }}>
          <div className="plabel" style={{ textAlign: 'center' }}>Stage 1: Select Image</div>
          <div className="dz" onClick={pickFile}>
            <div className="dz-icon">🖼️</div>
            <div className="dz-main">{file ? file.name : "Drop image or Browse"}</div>
            <div className="dz-sub">JPG · PNG · WEBP · TIFF</div>
          </div>
          {file && (
            <button className="abtn primary" style={{ marginTop: '30px' }} onClick={() => setStage(2)}>Continue to Configuration →</button>
          )}
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Configuration & Destination</div>
          
          <div className="srow">
            <div className="slabel">Adjust Filename</div>
            <div className="sfield">
              <input className="sinput" value={outputName} onChange={e => setOutputName(e.target.value)} />
              <div className="sbtn">.{outputFormat}</div>
            </div>
          </div>

          <div className="fmt-gl" style={{ marginTop: '20px' }}>Target Format</div>
          <div className="fmtb">
            {formats.map(f => (
              <div key={f} className={`fb ${outputFormat === f ? "active" : ""}`} onClick={() => setOutputFormat(f)}>
                {f.toUpperCase()}
              </div>
            ))}
          </div>

          <div className="srow" style={{ marginTop: '24px' }}>
            <div className="slabel">Output Quality · {quality}% ({qualityLabel})</div>
            <input type="range" min="40" max="100" value={quality} onChange={e => setQuality(e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>

          <div className="srow" style={{ marginTop: '24px' }}>
            <div className="slabel">Save To Folder</div>
            <div className="sfield">
              <input className="sinput" value={outputDir || "No folder selected"} readOnly />
              <button className="sbtn" onClick={pickDir}>Browse</button>
            </div>
          </div>

          <button className="abtn primary" style={{ marginTop: '24px' }} onClick={() => setStage(3)} disabled={!outputDir || !outputName}>Review & Convert →</button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Back</button>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
           {!activeTask ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Workflow Summary:</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', margin: '8px 0' }}>{file.name} ➜ {outputName}.{outputFormat}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Format: {outputFormat.toUpperCase()} · Quality: {quality}% · Destination: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={run}>⚡ Start Conversion Engine</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Config</button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  {activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}
                </div>
                <div className="pt">{activeTask.status === "processing" ? "Processing Image..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
                <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
                
                <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ 
                    width: `${activeTask.progress || 100}%`,
                    animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none'
                  }} />
                </div>

                {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open File</button>
                    <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => updateState({ stage: 1, file: null, outputName: "", activeTaskId: null })}>🔄 Convert More</button>
                  </div>
                )}

                {activeTask.status === "failed" && (
                  <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>
                )}
                {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry Setup</button>}

                {activeTask.status === "processing" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="abtn primary" onClick={() => { setStage(1); setFile(null); setActiveTaskId(null); }}>Process Another</button>
                    <button className="abtn secondary" onClick={() => onBack()}>Run in Background</button>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

function MergePDFScreen({ onBack, addTask, updateTask, tasks, state, updateState, deps, onFixDeps }: ToolScreenProps) {
  const { stage, files = [], outputName = "merged_document", activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("mergepdf");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFiles = (f: any[]) => updateState({ files: f });
  const setOutputName = (n: string) => updateState({ outputName: n });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);

  useEffect(() => {
    if (files.length > 0) {
      setOutputName(files[0].name.split('.').slice(0, -1).join('.') + "_merged");
    }
  }, [files]);

  const pickFiles = async () => {
    const selected = await open({ multiple: true, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (selected && Array.isArray(selected)) {
      setFiles(selected.map(s => ({ name: s.split(/[\\/]/).pop(), path: s })));
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory: true, multiple: false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const run = async () => {
    if (!files.length || !outputDir) return;
    
    const tid = addTask({
      name: outputName + ".pdf",
      tool: "PDF Merger",
      inputPath: files[0].path,
    });
    setActiveTaskId(tid);

    try {
      const outPath = `${outputDir}\\${outputName}.pdf`;
      const res = await invoke<TaskResult>("merge_pdfs", { 
        inputPaths: files.map((f: any) => f.path), 
        outputPath: outPath 
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ name: outputName + ".pdf", meta: `${files.length} PDFs merged`, time: "Just now" });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) {
        setFiles(paths.map((p: any) => ({ name: p.split(/[\\/]/).pop(), path: p })));
        setStage(2);
      }
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
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">PDF <span className="bl">Merger</span></div>
          <div className="ps">Combine multiple PDF files into one</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>

      {stage === 1 && (
        <div className={`panel animate-in ${isDragOver ? "drag-over" : ""}`} style={{ padding: '60px' }}>
          <div className="plabel" style={{ textAlign: 'center' }}>Stage 1: Select PDFs</div>
          <div className="dz" onClick={pickFiles}>
            <div className="dz-icon">📚</div>
            <div className="dz-main">{files.length > 0 ? `${files.length} PDFs selected` : "Drop PDFs or Browse"}</div>
            <div className="dz-sub">Files will be merged in the order they were selected</div>
          </div>
          {files.length > 0 && (
            <button className="abtn primary" style={{ marginTop: '30px' }} onClick={() => setStage(2)}>Continue to Configuration →</button>
          )}
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Configuration & Destination</div>
          
          <div className="srow">
            <div className="slabel">Target Filename</div>
            <div className="sfield">
               <input className="sinput" value={outputName} onChange={e => setOutputName(e.target.value)} />
               <div className="sbtn">.pdf</div>
            </div>
          </div>

          <div className="srow" style={{ marginTop: '24px' }}>
             <div className="slabel">Save To Folder</div>
             <div className="sfield">
               <input className="sinput" value={outputDir || "No folder selected"} readOnly />
               <button className="sbtn" onClick={pickDir}>Browse</button>
             </div>
          </div>

          <button className="abtn primary" style={{ marginTop: '24px' }} onClick={() => setStage(3)} disabled={!outputDir || !outputName || files.length < 2}>Review & Merge →</button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Back</button>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
           {!activeTask ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Workflow Summary:</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', margin: '8px 0' }}>Merging {files.length} files ➜ {outputName}.pdf</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Destination: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={run}>⚡ Start Merge Engine</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Config</button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  {activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}
                </div>
                <div className="pt">{activeTask.status === "processing" ? "Merging PDFs..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
                <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
                
                <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ 
                    width: `${activeTask.progress || 100}%`,
                    animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none'
                  }} />
                </div>

                {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open File</button>
                    <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => updateState({ stage: 1, files: [], outputName: "", activeTaskId: null })}>🔄 Merge More</button>
                  </div>
                )}

                {activeTask.status === "failed" && (
                  <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>
                )}
                {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry Setup</button>}

                {activeTask.status === "processing" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="abtn primary" onClick={() => { setStage(1); setFiles([]); setActiveTaskId(null); }}>Process Another</button>
                    <button className="abtn secondary" onClick={() => onBack()}>Run in Background</button>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

function SplitPDFScreen({ onBack, addTask, updateTask, tasks, state, updateState, deps, onFixDeps }: ToolScreenProps) {
  const { stage, file, mode = "count", value = "5", activeTaskId, outputName = "" } = state;
  const [outputDir, saveOutputDir] = useSavedPath("splitpdf");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFile = (f: any) => updateState({ file: f });
  const setMode = (m: "count" | "ranges") => updateState({ mode: m });
  const setValue = (v: string) => updateState({ value: v });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });
  const setOutputName = (n: string) => updateState({ outputName: n });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);

  useEffect(() => {
    if (file) {
      setOutputName(file.name.split('.').slice(0, -1).join('.') + "_split");
    }
  }, [file]);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) {
        setFile({ name: paths[0].split(/[\\/]/).pop(), path: paths[0] });
        setStage(2);
      }
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  const pickFile = async () => {
    const s = await open({ multiple: false, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (s && !Array.isArray(s)) {
      setFile({ name: s.split(/[\\/]/).pop(), path: s });
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory: true, multiple: false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const run = async () => {
    if (!file || !outputDir) return;
    
    const tid = addTask({
      name: `Split: ${file.name}`,
      tool: "PDF Splitter",
      inputPath: file.path,
    });
    setActiveTaskId(tid);

    try {
      const res = await invoke<TaskResult>("split_pdf", { 
        inputPath: file.path, 
        outputDir: outputDir, 
        mode, 
        value,
        outputPrefix: outputName || file.name.split('.').slice(0, -1).join('.')
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ name: file.name, meta: `Split by ${mode}`, time: "Just now" });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  return (
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">PDF <span className="bl">Splitter</span></div>
          <div className="ps">Extract pages or break documents into segments</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>

      {stage === 1 && (
        <div className={`panel animate-in ${isDragOver ? "drag-over" : ""}`} style={{ padding: '60px' }}>
          <div className="plabel" style={{ textAlign: 'center' }}>Stage 1: Select PDF</div>
          <div className="dz" onClick={pickFile}>
            <div className="dz-icon">✂️</div>
            <div className="dz-main">{file ? file.name : "Drop PDF or Browse"}</div>
            <div className="dz-sub">Single PDF file supported</div>
          </div>
          {file && (
            <button className="abtn primary" style={{ marginTop: '30px' }} onClick={() => setStage(2)}>Continue to Split Rules →</button>
          )}
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Rules & Destination</div>
          
          <div className="slabel">Split Strategy</div>
          <div className="fmtb">
            <div className={`fb ${mode === "count" ? "active" : ""}`} onClick={() => { setMode("count"); setValue("5"); }}>Fixed Page Count</div>
            <div className={`fb ${mode === "ranges" ? "active" : ""}`} onClick={() => { setMode("ranges"); setValue("1-3, 4-7"); }}>Custom Ranges</div>
          </div>

          <div className="srow" style={{ marginTop: '20px' }}>
            <div className="slabel">{mode === "count" ? "Pages per resulting file" : "Range Pattern (e.g. 1-5, 10-12, 15-end)"}</div>
            <input className="sinput" value={value} onChange={e => setValue(e.target.value)} style={{ width: '100%' }} />
          </div>

          <div className="srow" style={{ marginTop: '20px' }}>
            <div className="slabel">Output Filename Prefix</div>
            <input 
              className="sinput" 
              value={outputName} 
              onChange={e => setOutputName(e.target.value)} 
              placeholder="e.g. split_document"
              style={{ width: '100%' }}
            />
          </div>

          <div className="srow" style={{ marginTop: '24px' }}>
            <div className="slabel">Export To Folder</div>
            <div className="sfield">
              <input className="sinput" value={outputDir || "No folder selected"} readOnly />
              <button className="sbtn" onClick={pickDir}>Browse</button>
            </div>
          </div>

          <button className="abtn primary" style={{ marginTop: '24px' }} onClick={() => setStage(3)} disabled={!outputDir || !value}>Review Split Plan →</button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Back</button>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
           {!activeTask ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Workflow Summary:</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', margin: '8px 0' }}>Splitting "{file.name}"</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Strategy: {mode === 'count' ? `Every ${value} pages` : `Ranges: ${value}`}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Destination: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={run}>⚡ Execute Split Order</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Config</button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  {activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}
                </div>
                <div className="pt">{activeTask.status === "processing" ? "Extracting Pages..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
                <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
                
                <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ 
                    width: `${activeTask.progress || 100}%`,
                    animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none'
                  }} />
                </div>

                {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open Results</button>
                    <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => { updateState({ stage: 1, file: null, activeTaskId: null, outputName: "" }); }}>🔄 Split More</button>
                  </div>
                )}

                {activeTask.status === "failed" && (
                  <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>
                )}
                {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry Setup</button>}

                {activeTask.status === "processing" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="abtn primary" onClick={() => { setStage(1); setFile(null); setActiveTaskId(null); }}>Abort & Restart</button>
                    <button className="abtn secondary" onClick={() => onBack()}>Run in Background</button>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

function GreyscalePDFScreen({ onBack, addTask, updateTask, tasks, state, updateState, deps, onFixDeps }: ToolScreenProps) {
  const { stage, file, outputName, activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("greyscalepdf");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFile = (f: any) => updateState({ file: f });
  const setOutputName = (n: string) => updateState({ outputName: n });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);

  useEffect(() => {
    if (file && !outputName) {
      setOutputName(file.name.replace(".pdf", "") + "_greyscale");
    }
  }, [file]);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) {
        setFile({ name: paths[0].split(/[\\/]/).pop(), path: paths[0] });
        setStage(2);
      }
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  const pickFile = async () => {
    const s = await open({ multiple: false, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (s && !Array.isArray(s)) {
      setFile({ name: s.split(/[\\/]/).pop(), path: s });
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory: true, multiple: false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const handleStartProcess = async () => {
    if (!file || !outputDir) return;
    
    const tid = addTask({
      name: outputName + ".pdf",
      tool: "Greyscale PDF",
      inputPath: file.path,
    });
    setActiveTaskId(tid);

    const outPath = outputDir + "\\" + outputName + ".pdf";
     try {
       const res: any = await invoke("greyscale_pdf", { 
         inputPath: file.path, 
         outputPath: outPath 
       });
       
       if (res.success) {
         updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
         addActivity({ 
           name: file.name, 
           meta: "Greyscale Conversion", 
           time: "Just now" 
         });
       } else {
         updateTask(tid, { status: "failed", error: res.errorMessage });
       }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  return (
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">Greyscale <span className="bl">PDF</span></div>
          <div className="ps">Professional black & white conversion</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>
      
      {stage === 1 && (
        <div className={`panel animate-in ${isDragOver ? "drag-over" : ""}`} style={{ padding: '60px', textAlign: 'center' }}>
          <div className="plabel">Stage 1: Select PDF Source</div>
          <div className="dz" onClick={pickFile}>
            <div className="dz-icon">🎨</div>
            <div className="dz-main">{file ? file.name : "Drop PDF or Browse"}</div>
            <div className="dz-sub">Greyscale conversion is non-reversible</div>
          </div>
          {file && (
            <button className="abtn primary" style={{ marginTop: '30px' }} onClick={() => setStage(2)}>Continue to Output Config →</button>
          )}
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Output Configuration</div>
          
          <div className="srow">
            <div className="slabel">Export Filename</div>
            <div className="sfield">
              <input className="sinput" value={outputName} onChange={e => setOutputName(e.target.value)} />
              <div className="sbtn">.pdf</div>
            </div>
          </div>

          <div className="srow" style={{ marginTop: '24px' }}>
            <div className="slabel">Save To Folder</div>
            <div className="sfield">
              <input className="sinput" value={outputDir || "No folder selected"} readOnly />
              <button className="sbtn" onClick={pickDir}>Browse</button>
            </div>
          </div>

          <div className="info-card" style={{ marginTop: '24px' }}>
            <div className="ps">Formatica will process "{file?.name}" and save the greyscale version to your selected directory. This results in smaller, print-ready files.</div>
          </div>

          <button className="abtn primary" style={{ marginTop: '24px' }} onClick={() => setStage(3)} disabled={!outputDir || !outputName}>Review & Process →</button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Back</button>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
           {!activeTask ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Review Summary:</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', margin: '8px 0' }}>Greyscale Conversion: {file?.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target: {outputName}.pdf</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Destination: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={handleStartProcess}>⚡ Start Conversion</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Config</button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  {activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}
                </div>
                <div className="pt">{activeTask.status === "processing" ? "Converting..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
                <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
                
                <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ 
                    width: `${activeTask.progress || 100}%`,
                    animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none'
                  }} />
                </div>

                {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open File</button>
                    <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => updateState({ stage: 1, file: null, outputName: "", activeTaskId: null })}>🔄 Convert More</button>
                  </div>
                )}
                {activeTask.status === "failed" && (
                  <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>
                )}
                {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => { setActiveTaskId(null); setStage(2); }}>Retry Setup</button>}
                {activeTask.status === "processing" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="abtn primary" onClick={() => { setStage(1); setFile(null); setActiveTaskId(null); }}>Abort Process</button>
                    <button className="abtn secondary" onClick={() => onBack()}>Run in Background</button>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
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
    { id: "python",      label: "Python Runtime",     subtitle: "Core Engine Host", status: "waiting" as "waiting"|"active"|"done"|"error", percent: 0 },
    { id: "ytdlp",       label: "Media Downloader",   subtitle: "yt-dlp",       status: "waiting" as "waiting"|"active"|"done"|"error", percent: 0 },
    { id: "ffmpeg",      label: "Media Engine",       subtitle: "FFmpeg",       status: "waiting" as "waiting"|"active"|"done"|"error", percent: 0 },
    { id: "tesseract",   label: "OCR Engine",        subtitle: "Tesseract",    status: "waiting" as "waiting"|"active"|"done"|"error", percent: 0 },
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
      if (message) setCurrentMsg(message);
      
      const statusMap = {
        "done": "done",
        "downloading": "active",
        "installing": "active",
        "extracting": "active",
        "error": "error"
      } as const;

      updateStep(step, {
        status: statusMap[status as keyof typeof statusMap] || "active",
        percent
      });
    });

    async function runSetup() {
      // Get current status to see what's already installed
      const status: any = await invoke("get_setup_status");
      
      const checkAndInstall = async (id: string, isInstalled: boolean, installCmd: string) => {
        if (isInstalled) {
          updateStep(id, { status: "done", percent: 100 });
          return true;
        }
        
        updateStep(id, { status: "active", percent: 0 });
        try {
          const r: any = await invoke(installCmd);
          if (r.success) {
            updateStep(id, { status: "done", percent: 100 });
            return true;
          } else {
            updateStep(id, { status: "error", percent: 0 });
            setHasError(true);
            return false;
          }
        } catch (e) {
          updateStep(id, { status: "error", percent: 0 });
          setHasError(true);
          return false;
        }
      };

      // Step 0: Python Runtime (Check only)
      if (status.python) {
        updateStep("python", { status: "done", percent: 100 });
      } else {
        updateStep("python", { status: "error", percent: 0 });
        setHasError(true);
        setCurrentMsg("Python not found. Please install Python to continue.");
      }

      // Step 1: yt-dlp
      await checkAndInstall("ytdlp", status.ytdlp, "install_ytdlp");

      // Step 2: FFmpeg
      await checkAndInstall("ffmpeg", status.ffmpeg, "install_ffmpeg");

      // Step 3: Tesseract
      await checkAndInstall("tesseract", status.tesseract, "install_tesseract");

      // Step 4: LibreOffice
      await checkAndInstall("libreoffice", status.libreoffice, "install_libreoffice");

      // Final Step: Install Python deps if python found
      if (status.python) {
        setCurrentMsg("Updating Python dependencies...");
        await invoke("check_python_deps");
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

// ── Workflow Components ───────────────────────────────────────────

function StageIndicator({ current, stages }: { current: number; stages: string[] }) {
  return (
    <div className="stage-indicator">
      {stages.map((s: string, i: number) => (
        <div key={i} className={`stage-dot-wrap ${i + 1 <= current ? "active" : ""}`}>
          <div className="stage-dot">{i + 1 < current ? "✓" : i + 1}</div>
          <div className="stage-label">{s}</div>
          {i < stages.length - 1 && <div className="stage-line" />}
        </div>
      ))}
    </div>
  );
}

// ── Phase 2/3 New Screens ────────────────────────────────────────

function OCRScreen({ onBack, addTask, updateTask, tasks, state, updateState, deps, onFixDeps }: ToolScreenProps) {
  const { stage, file, language = "eng", ocrMode = "fast", outputFormat = "pdf", outputName, activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("ocr");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFile = (f: any) => updateState({ file: f });
  const setLang = (l: string) => updateState({ language: l });
  const setMode = (m: string) => updateState({ ocrMode: m });
  const setOutputName = (n: string) => updateState({ outputName: n });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);
  const isEngineReady = deps.find((d: DepStatus) => d.name === "tesseract")?.installed ?? true;

  useEffect(() => {
    if (file) {
      setOutputName(file.name.split('.').slice(0, -1).join('.') + "_ocr");
    }
  }, [file]);

  const pickFile = async () => {
    const selected = await open({ multiple: false, filters: [{ name: "PDF Documents", extensions: ["pdf"] }] });
    if (selected && !Array.isArray(selected)) {
      setFile({ name: selected.split(/[\\/]/).pop(), path: selected });
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory: true, multiple: false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const handleStartOCR = async () => {
    if (!file || !outputDir) return;
    setStage(3);
    
    const tid = addTask({
      name: `OCR: ${outputName}.${outputFormat}`,
      tool: "OCR Engine",
      inputPath: file.path,
    });
    setActiveTaskId(tid);

    try {
      const res: any = await invoke("perform_ocr", {
        inputPath: file.path,
        outputFormat: outputFormat,
        outputPath: `${outputDir}\\${outputName}.${outputFormat}`,
        language: language,
        ocrMode: ocrMode
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ name: "OCR PDF", meta: "Processed successfully", time: "Just now" });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  useEffect(() => {
    let unDrop: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0 && paths[0].toLowerCase().endsWith(".pdf")) {
        setFile({ name: paths[0].split(/[\\/]/).pop(), path: paths[0] });
        setStage(2);
      }
    }).then(u => unDrop = u);
    return () => { if (unDrop) unDrop(); };
  }, []);

  return (
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">OCR <span className="bl">Engine</span></div>
          <div className="ps">Extract searchable text from scanned PDF documents</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {!isEngineReady && (
            <div className="animate-in" style={{ 
              background: 'var(--rbg)', border: '1px solid var(--rb)', padding: '8px 12px', 
              borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' 
            }}>
              <span style={{ fontSize: '12px', color: 'var(--red)', fontWeight: '600' }}>⚠️ OCR Engine Offline</span>
              <button className="sbtn" onClick={onFixDeps} style={{ padding: '4px 8px', fontSize: '10px', background: 'var(--red)', color: 'white' }}>Fix Now</button>
            </div>
          )}
          <StageIndicator current={stage} stages={STAGES} />
        </div>
      </div>

      {stage === 1 && (
        <div className={`panel animate-in ${isDragOver ? "drag-over" : ""}`} style={{ padding: '60px' }}>
          <div className="plabel" style={{ textAlign: 'center' }}>Stage 1: Select Scanned PDF</div>
          <div className="dz" onClick={pickFile}>
            <div className="dz-icon">🔍</div>
            <div className="dz-main">Drop PDF or <span className="bl">Browse</span></div>
            <div className="dz-sub">Tesseract OCR Engine • Version 5.4</div>
          </div>
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Configuration</div>
          <div className="srow">
            <div className="slabel">Output Filename</div>
            <div className="sfield">
              <input className="sinput" value={outputName} onChange={e => setOutputName(e.target.value)} />
              <div className="sbtn">.{outputFormat}</div>
            </div>
          </div>
          <div className="two-col" style={{ marginTop: '20px' }}>
            <div>
              <div className="plabel" style={{ fontSize: '13px' }}>Language</div>
              <select className="sinput" value={language} onChange={e => setLang(e.target.value)} style={{ width: '100%', background: 'transparent' }}>
                <option value="eng">English (Latin)</option>
                <option value="spa">Spanish</option>
                <option value="fra">French</option>
                <option value="deu">German</option>
                <option value="chi_sim">Chinese (Simple)</option>
              </select>
            </div>
            <div>
              <div className="plabel" style={{ fontSize: '13px' }}>OCR Mode</div>
              <div className="fmtb">
                <div className={`fb ${ocrMode === "fast" ? "active" : ""}`} onClick={() => setMode("fast")}>Fast</div>
                <div className={`fb ${ocrMode === "best" ? "active" : ""}`} onClick={() => setMode("best")}>Best</div>
              </div>
            </div>
          </div>
          <div className="srow" style={{ marginTop: '24px' }}>
            <div className="slabel">Target Folder</div>
            <div className="sfield">
              <input className="sinput" value={outputDir || "No folder selected"} readOnly />
              <button className="sbtn" onClick={pickDir}>Browse</button>
            </div>
          </div>
          <button className="abtn primary" style={{ marginTop: '30px' }} onClick={() => setStage(3)} disabled={!outputDir || !outputName || !isEngineReady}>Confirm Plan →</button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Change File</button>
          {!isEngineReady && <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '8px', textAlign: 'center' }}>Engine installation required to process.</div>}
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
          <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
          {!activeTask ? (
            <div style={{ padding: '20px' }}>
              <div className="info-card" style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Summary:</div>
                <div style={{ fontSize: '15px', fontWeight: '700', margin: '8px 0' }}>{file.name} ⮕ {outputName}.{outputFormat}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Location: {outputDir}</div>
              </div>
              <button className="abtn primary" onClick={handleStartOCR}>⚡ Run OCR Engine</button>
              <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Config</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>{activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}</div>
              <div className="pt">{activeTask.status === "processing" ? "Running OCR..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
              <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
              <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                <div className="rm-bar-fill rm-cpu-fill" style={{ width: `${activeTask.progress || 100}%`, animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none' }} />
              </div>
              {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open File</button>
                    <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => updateState({ stage: 1, file: null, outputName: "", activeTaskId: null })}>🔄 Extract More</button>
                  </div>
              )}
              {activeTask.status === "failed" && <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>}
              {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WatermarkScreen({ onBack, addTask, updateTask, tasks, state, updateState, deps, onFixDeps }: ToolScreenProps) {
  const { stage, file, outputName, text = "CONFIDENTIAL", opacity = 30, pos = "C", activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("watermark");
  const [isDragOver, setIsDragOver] = useState(false);

  const setStage = (s: number) => updateState({ stage: s });
  const setFile = (f: any) => updateState({ file: f });
  const setOutputName = (n: string) => updateState({ outputName: n });
  const setText = (t: string) => updateState({ text: t });
  const setOpacity = (o: number) => updateState({ opacity: o });
  const setPos = (p: string) => updateState({ pos: p });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);

  useEffect(() => {
    if (file && !outputName) {
      const base = file.name.split('.').slice(0, -1).join('.');
      setOutputName(`${base}_watermark`);
    }
  }, [file]);

  const pickFile = async () => {
    const selected = await open({ filters: [{ name: 'Images', extensions: ['jpg','jpeg','png','webp','bmp'] }] });
    if (selected && !Array.isArray(selected)) {
      setFile({ name: selected.split(/[\\/]/).pop(), path: selected });
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory: true, multiple: false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const handleStartWatermark = async () => {
    if (!file || !outputDir) return;
    
    const tid = addTask({
      name: `${outputName}.png`,
      tool: "Watermark",
      inputPath: file.path,
    });
    setActiveTaskId(tid);

    try {
      const res: any = await invoke("apply_watermark", { 
        inputPath: file.path, 
        outputPath: outputDir + "\\" + outputName + ".png",
        watermarkText: text,
        fontSize: 32,
        opacity: opacity,
        color: "white",
        position: pos
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ name: file.name, meta: "Watermarked", time: "Just now" });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      const paths = e.payload.paths;
      if (paths && paths.length > 0) {
        setFile({ name: paths[0].split(/[\\/]/).pop(), path: paths[0] });
        setStage(2);
      }
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
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">Add <span className="bl">Watermark</span></div>
          <div className="ps">Protect your images with text overlays</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>
      
      {stage === 1 && (
        <div className={`panel animate-in ${isDragOver ? "drag-over" : ""}`} style={{ padding: '60px' }}>
          <div className="plabel" style={{ textAlign: 'center' }}>Stage 1: Input Selection</div>
          <div className="dz" onClick={pickFile}>
            <div className="dz-icon">🖼️</div>
            <div className="dz-main">{file ? file.name : "Drop Image or Browse"}</div>
            <div className="dz-sub">PNG · JPG · WEBP · BMP</div>
          </div>
          {file && (
            <button className="abtn primary" style={{ marginTop: '30px' }} onClick={() => setStage(2)}>Continue to Overlay Settings →</button>
          )}
        </div>
      )}

      {stage === 2 && (
        <div className="two-col animate-in">
          <div className="panel">
            <div className="plabel">Live Visual Preview</div>
            <div className="dz" style={{ 
              height: '320px', 
              background: 'var(--border)', 
              borderRadius: '12px', 
              position: 'relative', 
              overflow: 'hidden', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)'
            }}>
               {file ? (
                 <img 
                   src={convertFileSrc(file.path)} 
                   alt="Preview" 
                   style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                 />
               ) : (
                 <div className="dz-icon" style={{ opacity: 0.2 }}>🖼️</div>
               )}
               <div style={{ 
                 position: 'absolute', 
                 opacity: opacity / 100, 
                 fontSize: '32px', 
                 fontWeight: '900', 
                 color: 'white', 
                 textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                 userSelect: 'none', 
                 pointerEvents: 'none',
                 textAlign: 'center',
                 zIndex: 10,
                 ...(pos === 'TL' && { top: '20px', left: '20px' }),
                 ...(pos === 'TC' && { top: '20px' }),
                 ...(pos === 'TR' && { top: '20px', right: '20px' }),
                 ...(pos === 'ML' && { left: '20px' }),
                 ...(pos === 'C' && { }),
                 ...(pos === 'MR' && { right: '20px' }),
                 ...(pos === 'BL' && { bottom: '20px', left: '20px' }),
                 ...(pos === 'BC' && { bottom: '20px' }),
                 ...(pos === 'BR' && { bottom: '20px', right: '20px' }),
               }}>
                 {text || "PREVIEW"}
               </div>
            </div>
            
            <div className="plabel" style={{ marginTop: '24px' }}>Watermark Anchor</div>
            <div className="fmt-gl" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {['TL', 'TC', 'TR', 'ML', 'C', 'MR', 'BL', 'BC', 'BR'].map(p => (
                <div key={p} className={`fb ${pos === p ? "active" : ""}`} onClick={() => setPos(p)} style={{ textAlign: 'center', padding: '10px', fontSize: '12px' }}>{p}</div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <div className="plabel">Configuration</div>
            <div className="srow">
                <div className="slabel">Export Filename</div>
                <div className="sfield">
                  <input className="sinput" value={outputName} onChange={e => setOutputName(e.target.value)} />
                  <div className="sbtn">.png</div>
                </div>
            </div>
            <div className="srow" style={{ marginTop: '16px' }}>
              <div className="slabel">Watermark Text</div>
              <input type="text" className="sinput" value={text} onChange={e => setText(e.target.value)} placeholder="Type here..." style={{ width: '100%' }} />
            </div>
            <div className="srow" style={{ marginTop: '16px' }}>
              <div className="slabel">Intensity ({opacity}%)</div>
              <input type="range" min="5" max="100" value={opacity} onChange={e => setOpacity(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>
            <div className="srow" style={{ marginTop: '20px' }}>
              <div className="slabel">Target Directory</div>
              <div className="sfield">
                <input className="sinput" value={outputDir || "No folder selected"} readOnly />
                <button className="sbtn" onClick={pickDir}>Browse</button>
              </div>
            </div>

            <button className="abtn primary" style={{ marginTop: '30px' }} onClick={() => setStage(3)} disabled={!outputDir || !outputName}>Apply & Export →</button>
            <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Back</button>
          </div>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
           {!activeTask ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Workflow Summary:</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', margin: '8px 0' }}>"{file.name}" ➜ "{outputName}.png"</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Watermark: "{text}" • Opacity: {opacity}% • Position: {pos}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Location: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={handleStartWatermark}>⚡ Apply Watermark</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Overlay Settings</button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  {activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}
                </div>
                <div className="pt">{activeTask.status === "processing" ? "Protecting Image..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
                <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
                
                <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ 
                    width: `${activeTask.progress || 100}%`,
                    animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none'
                  }} />
                </div>

                {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open File</button>
                    <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => updateState({ stage: 1, file: null, outputName: "", activeTaskId: null })}>🔄 Protect More</button>
                  </div>
                )}
                {activeTask.status === "failed" && (
                  <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>
                )}
                {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry Setup</button>}
                {activeTask.status === "processing" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="abtn primary" onClick={() => { setStage(1); setFile(null); setActiveTaskId(null); }}>Abort Job</button>
                    <button className="abtn secondary" onClick={() => onBack()}>Run in Background</button>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

function BatchFolderScreen({ onBack, addTask, updateTask, tasks, state, updateState, deps, onFixDeps }: ToolScreenProps) {
  const { stage, path = "", action = "pdf_to_docx", activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("batch");

  const setStage = (s: number) => updateState({ stage: s });
  const setPath = (p: string) => updateState({ path: p });
  const setAction = (a: string) => updateState({ action: a });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);

  const pick = async () => {
    const selected = await open({ directory: true });
    if (selected && !Array.isArray(selected)) {
      setPath(selected);
      setStage(2);
    }
  };

  const pickDir = async () => {
    const s = await open({ directory: true, multiple: false });
    if (s && !Array.isArray(s)) saveOutputDir(s);
  };

  const handleStartBatch = async () => {
    if (!path || !outputDir) return;
    
    const tid = addTask({
      name: `Batch: ${path.split(/[\\/]/).pop()}`,
      tool: "Batch Process",
      inputPath: path,
    });
    setActiveTaskId(tid);

    try {
      const res: any = await invoke("batch_convert_folder", {
        folderPath: path,
        targetFormat: action.split("_to_")[1] || "docx",
        outputPath: outputDir,
        fileType: "document"
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ name: "Batch Folder", meta: "Processed successfully", time: "Just now" });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  return (
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">Batch <span className="bl">Processing</span></div>
          <div className="ps">Mass-convert files within a folder recursively</div>
        </div>
        <StageIndicator current={stage} stages={STAGES} />
      </div>
      
      {stage === 1 && (
        <div className="panel animate-in" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="plabel">Stage 1: Select Source Folder</div>
          <div className="dz" onClick={pick}>
            <div className="dz-icon">📁</div>
            <div className="dz-main">{path ? path.split(/[\\/]/).pop() : "Drop Folder or Browse"}</div>
            <div className="dz-sub">{path || "Recursively scans for compatible files"}</div>
          </div>
          {path && (
            <button className="abtn primary" style={{ marginTop: '30px' }} onClick={() => setStage(2)}>Continue to Batch Action →</button>
          )}
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Action & Destination</div>
          
          <div className="fmt-gl">Choose Bulk Action</div>
          <div className="fmtb">
             <div className={`fb ${action === "pdf_to_docx" ? "active" : ""}`} onClick={() => setAction("pdf_to_docx")}>PDF → DOCX</div>
             <div className={`fb ${action === "compress" ? "active" : ""}`} onClick={() => setAction("compress")}>Compress All</div>
             <div className={`fb ${action === "image_conv" ? "active" : ""}`} onClick={() => setAction("image_conv")}>Optimize Images</div>
          </div>

          <div className="srow" style={{ marginTop: '24px' }}>
            <div className="slabel">Save Results To</div>
            <div className="sfield">
              <input className="sinput" value={outputDir || "No folder selected"} readOnly />
              <button className="sbtn" onClick={pickDir}>Browse</button>
            </div>
          </div>

          <div className="info-card" style={{ marginTop: '24px' }}>
            <div className="ps">Formatica will process all compatible files in the selected source and export results to the destination folder.</div>
          </div>

          <button className="abtn primary" style={{ marginTop: '24px' }} onClick={() => setStage(3)} disabled={!outputDir || !path}>Review Batch Plan →</button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Back</button>
        </div>
      )}

      {stage === 3 && (
        <div className="panel scrollable animate-in">
           <div className="plabel">Stage 3: {activeTask ? "Processing" : "Ready"}</div>
           {!activeTask ? (
             <div style={{ padding: '20px' }}>
                <div className="info-card" style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Batch Plan:</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', margin: '8px 0' }}>Action: {action.replace(/_/g,' ').toUpperCase()}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Source: {path}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Destination: {outputDir}</div>
                </div>
                <button className="abtn primary" onClick={handleStartBatch}>⚡ Start Batch Processing</button>
                <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Configuration</button>
             </div>
           ) : (
             <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                  {activeTask.status === "processing" ? "⚙️" : activeTask.status === "completed" ? "✅" : "❌"}
                </div>
                <div className="pt">{activeTask.status === "processing" ? "Running Batch Process..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
                <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
                
                <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                  <div className="rm-bar-fill rm-cpu-fill" style={{ 
                    width: `${activeTask.progress || 100}%`,
                    animation: activeTask.status === "processing" ? 'pulse 1.5s infinite' : 'none'
                  }} />
                </div>

                {activeTask.status === "completed" && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="abtn primary" onClick={() => invoke("open_in_folder", { path: outputDir }).catch(alert)}>📂 Open Folder</button>
                    <button className="abtn primary bl" onClick={() => { updateState({ stage: 1, path: "", activeTaskId: null }); }}>🔄 New Batch</button>
                  </div>
                )}
                {activeTask.status === "failed" && (
                  <div style={{ color: 'var(--red)', background: 'var(--rbg)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{activeTask.error}</div>
                )}
                {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry Setup</button>}
                {activeTask.status === "processing" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="abtn primary" onClick={() => { setStage(1); setPath(""); setActiveTaskId(null); }}>Abort Batch</button>
                    <button className="abtn secondary" onClick={() => onBack()}>Run in Background</button>
                  </div>
                )}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

function DownloadScreen({ onBack, addTask, updateTask, tasks, state, updateState, deps, onFixDeps }: ToolScreenProps) {
  const { stage, url, format = "mp4", outputName, activeTaskId } = state;
  const [outputDir, saveOutputDir] = useSavedPath("download");
  const isEngineReady = deps.find((d: DepStatus) => d.name === "ytdlp")?.installed ?? true;

  const setStage = (s: number) => updateState({ stage: s });
  const setUrl = (u: string) => updateState({ url: u });
  const setFormat = (f: string) => updateState({ format: f });
  const setOutputName = (n: string) => updateState({ outputName: n });
  const setActiveTaskId = (id: string | null) => updateState({ activeTaskId: id });

  const activeTask = tasks.find((t: ProcessTask) => t.id === activeTaskId);

  const handleStartDownload = async () => {
    if (!url || !outputDir) return;
    setStage(3);
    
    const tid = addTask({
      name: `${outputName || "video"}.${format}`,
      tool: "Media Downloader",
      inputPath: url,
    });
    setActiveTaskId(tid);

    try {
      const res: any = await invoke("download_media", {
        url: url,
        outputDir: outputDir,
        outputName: outputName || "downloaded_media",
        format: format
      });
      
      if (res.success) {
        updateTask(tid, { status: "completed", progress: 100, outputPath: res.outputPath });
        addActivity({ name: "Media Download", meta: "Completed successfully", time: "Just now" });
      } else {
        updateTask(tid, { status: "failed", error: res.errorMessage });
      }
    } catch(e) {
      updateTask(tid, { status: "failed", error: String(e) });
    }
  };

  return (
    <div className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="pt">Media <span className="bl">Downloader</span></div>
          <div className="ps">Save online videos or audio for offline use</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {!isEngineReady && (
            <div className="animate-in" style={{ 
              background: 'var(--rbg)', border: '1px solid var(--rb)', padding: '8px 12px', 
              borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' 
            }}>
              <span style={{ fontSize: '12px', color: 'var(--red)', fontWeight: '600' }}>⚠️ Engine Missing</span>
              <button className="sbtn" onClick={onFixDeps} style={{ padding: '4px 8px', fontSize: '10px', background: 'var(--red)', color: 'white' }}>Fix Now</button>
            </div>
          )}
          <StageIndicator current={stage} stages={STAGES} />
        </div>
      </div>

      {stage === 1 && (
        <div className="panel animate-in" style={{ padding: '60px', textAlign: 'center' }}>
          <div className="plabel">Stage 1: Paste Media Link</div>
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
             <input 
              className="sinput" 
              style={{ width: '100%', padding: '16px', fontSize: '15px', borderRadius: '12px', marginBottom: '16px' }} 
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
            <div className="ps">Supports YouTube, Vimeo, TikTok and 1000+ more sites</div>
            {url && (
              <button className="abtn primary" style={{ marginTop: '24px', width: '100%' }} onClick={() => setStage(2)}>Analyze Link →</button>
            )}
          </div>
        </div>
      )}

      {stage === 2 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 2: Configure Download</div>
          <div className="two-col">
            <div>
              <div className="srow">
                <div className="slabel">Output Name</div>
                <div className="sfield">
                  <input className="sinput" value={outputName} onChange={e => setOutputName(e.target.value)} placeholder="video_title" />
                </div>
              </div>
              <div className="fmt-gl" style={{ marginTop: '16px' }}>Target Format</div>
              <div className="fmtb">
                <div className={`fb ${format === "mp4" ? "active" : ""}`} onClick={() => setFormat("mp4")}>Video (MP4)</div>
                <div className={`fb ${format === "mp3" ? "active" : ""}`} onClick={() => setFormat("mp3")}>Audio (MP3)</div>
              </div>
            </div>
            <div>
              <div className="srow">
                <div className="slabel">Save Location</div>
                <div className="sfield">
                  <input className="sinput" value={outputDir || "No folder selected"} readOnly />
                  <button className="sbtn" onClick={async () => {
                    const s = await open({ directory: true });
                    if (s && !Array.isArray(s)) saveOutputDir(s);
                  }}>Browse</button>
                </div>
              </div>
              <div className="info-card" style={{ marginTop: '16px' }}>
                <div className="ps">Formatica will download the highest possible quality available for the selected format.</div>
              </div>
            </div>
          </div>
          <button className="abtn primary" style={{ marginTop: '32px' }} onClick={() => setStage(3)} disabled={!url || !outputDir || !isEngineReady}>Confirm & Download →</button>
          <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(1)}>Back</button>
          {!isEngineReady && <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '8px', textAlign: 'center' }}>Media downloader engine required.</div>}
        </div>
      )}

      {stage === 3 && (
        <div className="panel animate-in">
          <div className="plabel">Stage 3: {activeTask ? "Downloading" : "Ready"}</div>
          {!activeTask ? (
            <div style={{ padding: '20px' }}>
              <div className="info-card" style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Download Summary:</div>
                <div style={{ fontSize: '15px', fontWeight: '700', margin: '8px 0' }}>{url}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Format: {format.toUpperCase()} • Folder: {outputDir}</div>
              </div>
              <button className="abtn primary" onClick={handleStartDownload}>⚡ Start Download</button>
              <button className="abtn secondary" style={{ marginTop: '10px' }} onClick={() => setStage(2)}>Back to Config</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>
                {activeTask.status === "processing" ? "🚀" : activeTask.status === "completed" ? "✅" : "❌"}
              </div>
              <div className="pt">{activeTask.status === "processing" ? "Downloading..." : activeTask.status === "completed" ? "Success" : "Failed"}</div>
              <div className="ps" style={{ marginBottom: '24px' }}>{activeTask.name}</div>
              <div className="rm-bar-bg" style={{ height: '8px', marginBottom: '32px' }}>
                <div className="rm-bar-fill rm-cpu-fill" style={{ width: `${activeTask.progress || 100}%` }} />
              </div>

              {activeTask.status === "completed" && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button className="abtn primary" onClick={() => invoke("open_url", { url: activeTask.outputPath }).catch(alert)}>📂 Open File</button>
                  <button className="abtn secondary" onClick={() => invoke("open_in_folder", { path: activeTask.outputPath }).catch(alert)}>📁 Open Folder</button>
                  <button className="abtn primary bl" onClick={() => updateState({ stage: 1, url: "", outputName: "", activeTaskId: null })}>🔄 Download More</button>
                </div>
              )}
              {activeTask.status === "failed" && <div className="info-card" style={{ color: 'var(--red)', background: 'var(--rbg)', marginBottom: '16px' }}>{activeTask.error}</div>}
              {activeTask.status === "failed" && <button className="abtn secondary" onClick={() => setActiveTaskId(null)}>Retry</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QueueScreen({ onBack, tasks, removeTask }: { onBack: () => void, tasks: ProcessTask[], removeTask: (id: string) => void }) {
  const activeTasks = tasks.filter((t: ProcessTask) => t.status === "processing");
  const completedTasks = tasks.filter((t: ProcessTask) => t.status === "completed" || t.status === "failed");

  return (
    <div className="screen active">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="pt">Processing Queue</div>
      <div className="ps">Monitor background tasks and job history</div>
      
      <div className="two-col" style={{ marginTop: '24px' }}>
        <div>
          <div className="panel" style={{ minHeight: '400px' }}>
            <div className="plabel">Active Tasks ({activeTasks.length})</div>
            {activeTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '100px 20px', opacity: 0.5 }}>
                 <div style={{ fontSize: '32px', marginBottom: '12px' }}>☕</div>
                 <div className="ps">No active processes</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeTasks.map((t: ProcessTask) => (
                  <div key={t.id} className="info-card animate-in" style={{ borderLeft: '3px solid var(--accent)' }}>
                    <div style={{ display: 'flex', transition: 'all 0.3s' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{t.tool}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{t.name}</div>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent)' }}>{t.progress}%</div>
                    </div>
                    <div className="rm-bar-bg" style={{ height: '4px' }}>
                      <div className="rm-bar-fill rm-cpu-fill" style={{ width: `${t.progress}%`, animation: 'pulse 1.5s infinite' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="panel" style={{ minHeight: '400px' }}>
            <div className="plabel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Recent History</span>
              {completedTasks.length > 0 && <button className="sbtn" onClick={() => tasks.forEach(t => (t.status !== 'processing' && removeTask(t.id)))} style={{ fontSize: '10px' }}>Clear All</button>}
            </div>
            {completedTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '100px 20px', opacity: 0.5 }}>
                 <div className="ps">History is empty</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {completedTasks.map(t => (
                  <div key={t.id} className="info-card" style={{ opacity: 0.8, padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '600' }}>{t.name}</div>
                        <div style={{ fontSize: '11px', color: t.status === 'completed' ? 'var(--green)' : 'var(--red)' }}>
                          {t.status === 'completed' ? '✓ Completed' : `❌ Failed: ${t.error}`}
                        </div>
                      </div>
                      <button className="back-btn" style={{ position: 'static', padding: '4px', fontSize: '12px' }} onClick={() => removeTask(t.id)}>×</button>
                    </div>
                    {t.status === 'completed' && t.outputPath && (
                      <button className="sbtn" style={{ width: '100%', marginTop: '8px', fontSize: '10px' }} onClick={() => invoke("open_url", { url: t.outputPath })}>Open File</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutsScreen({ onBack }: { onBack: () => void }) {
  const shortcuts = [
    { cat: "Navigation", items: [
      { action: "Convert document", key: "Ctrl + 1" },
      { action: "Images to PDF", key: "Ctrl + 2" },
      { action: "Merge PDF", key: "Ctrl + 3" },
      { action: "Split PDF", key: "Ctrl + 4" },
      { action: "OCR PDF", key: "Ctrl + 5" },
      { action: "Compress video", key: "Ctrl + 6" },
      { action: "Convert image", key: "Ctrl + 7" },
      { action: "Watermark", key: "Ctrl + 8" },
    ]},
    { cat: "System", items: [
      { action: "Toggle Theme", key: "Ctrl + D" },
      { action: "Open Queue", key: "Ctrl + Q" },
      { action: "Resource Monitor", key: "Ctrl + M" },
      { action: "Settings", key: "Ctrl + ," },
      { action: "Keyboard Shortcuts", key: "Ctrl + /" },
    ]}
  ];

  return (
    <div className="screen active">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="pt">Keyboard Shortcuts</div>
      <div className="ps" style={{ marginBottom: '24px' }}>Boost your productivity with master commands</div>
      
      <div className="two-col">
         {shortcuts.map(s => (
           <div key={s.cat} className="panel">
             <div className="plabel">{s.cat}</div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
               {s.items.map(i => (
                 <div key={i.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                   <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{i.action}</span>
                   <div style={{ display: 'flex', gap: '4px' }}>
                     {i.key.split(' + ').map(k => (
                       <kbd key={k} style={{ 
                         padding: '2px 6px', 
                         background: 'var(--bg4)', 
                         border: '1px solid var(--border2)', 
                         borderRadius: '4px',
                         fontSize: '10px',
                         fontWeight: 600,
                         fontFamily: 'SFMono-Regular, Consolas, monospace',
                         color: 'var(--text)',
                         boxShadow: '0 1px 0 rgba(0,0,0,0.1)'
                       }}>{k}</kbd>
                     ))}
                   </div>
                 </div>
               ))}
             </div>
           </div>
         ))}
      </div>
    </div>
  );
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen active">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="pt">Settings</div>
      <div className="ps">Configure performance, appearance, and defaults</div>
      <div className="two-col">
        <div className="panel">
          <div className="plabel">🎬 Video Defaults</div>
          <div className="srow">
            <div className="slabel">GPU Acceleration (NVENC)</div>
            <div className="fmtb"><div className="fb active">Enabled</div><div className="fb">Disabled</div></div>
          </div>
          <div className="srow">
            <div className="slabel">FFmpeg Threading</div>
            <div className="fmtb"><div className="fb">Single</div><div className="fb active">Multi</div></div>
          </div>
          <div className="srow">
            <div className="slabel">Default Container</div>
            <div className="fmtb"><div className="fb active">MP4</div><div className="fb">MKV</div><div className="fb">MOV</div></div>
          </div>
        </div>
        <div className="panel">
          <div className="plabel">⚙️ Application</div>
          <div className="srow">
            <div className="slabel">Max Concurrent Runs</div>
            <div className="fmtb"><div className="fb">1</div><div className="fb active">3</div><div className="fb">5</div></div>
          </div>
          <div className="srow">
            <div className="slabel">Check for Updates</div>
            <div className="fmtb"><div className="fb active">Auto</div><div className="fb">Manual</div></div>
          </div>
          <div className="srow">
             <div className="slabel">Log Level</div>
             <select className="sinput" style={{ width: '100%', appearance: 'none', background: 'transparent' }}>
                <option>Info</option>
                <option>Debug</option>
                <option>None</option>
             </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonitorScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen active">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="pt">Resource Monitor</div>
      <div className="ps">Real-time system impact of Formatica engines</div>
      <div className="panel" style={{ marginTop: '24px', padding: '32px' }}>
        <div className="rm-header" style={{ marginBottom: '24px' }}>
          <span className="rm-title" style={{ fontSize: '18px' }}>Hardware Status</span>
          <span className="rm-live">● Recording</span>
        </div>
        <div className="two-col">
          <div className="rm-item" style={{ marginBottom: '24px' }}>
            <div className="rm-item-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="rm-item-label" style={{ fontWeight: 600 }}>CPU Utilization</span>
              <span className="rm-item-val" style={{ color: 'var(--accent)' }}>12.4%</span>
            </div>
            <div className="rm-bar-bg"><div className="rm-bar-fill rm-cpu-fill" style={{ width: '12.4%' }}></div></div>
          </div>
          <div className="rm-item" style={{ marginBottom: '24px' }}>
            <div className="rm-item-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="rm-item-label" style={{ fontWeight: 600 }}>GPU Workload (NVENC)</span>
              <span className="rm-item-val" style={{ color: '#00d084' }}>8.1%</span>
            </div>
            <div className="rm-bar-bg"><div className="rm-bar-fill rm-gpu-fill" style={{ width: '8.1%' }}></div></div>
          </div>
        </div>
        <div className="two-col">
          <div className="rm-item">
            <div className="rm-item-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="rm-item-label" style={{ fontWeight: 600 }}>Memory Usage</span>
              <span className="rm-item-val" style={{ color: 'var(--amber)' }}>1.24 GB</span>
            </div>
            <div className="rm-bar-bg" style={{ background: 'rgba(255,255,255,0.05)' }}><div className="rm-bar-fill rm-cpu-fill" style={{ width: '45%', background: 'var(--amber)' }}></div></div>
          </div>
          <div className="rm-item">
             <div className="rm-item-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
               <span className="rm-item-label" style={{ fontWeight: 600 }}>Thread Pool</span>
               <span className="rm-item-val">12 Active</span>
             </div>
             <div className="rm-bar-bg"><div className="rm-bar-fill rm-cpu-fill" style={{ width: '100%', opacity: 0.2 }}></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
