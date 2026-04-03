import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";

function useSavedPath(key: string) {
  const storageKey = `mds_output_${key}`;
  const [path, setPath] = useState<string>(() => localStorage.getItem(storageKey) || "");
  const savePath = (p: string) => { setPath(p); localStorage.setItem(storageKey, p); };
  return [path, savePath] as const;
}

interface BatchFolderProps {
  onBack: () => void;
}

export function BatchFolderScreen({ onBack }: BatchFolderProps) {
  const [folderPath, setFolderPath] = useState("");
  const [fileStats, setFileStats] = useState<any>(null);
  const [targetTool, setTargetTool] = useState("compress");
  const [outputDir, saveOutputDir] = useSavedPath("batch");
  const [status, setStatus] = useState<"idle" | "scanning" | "processing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [_isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    let unDrop: any, unEnter: any, unLeave: any;
    listen("tauri://drag-drop", (e: any) => {
      setIsDragOver(false);
      handleFolderDrop(e.payload.paths[0]);
    }).then(u => unDrop = u);
    listen("tauri://drag-enter", () => setIsDragOver(true)).then(u => unEnter = u);
    listen("tauri://drag-leave", () => setIsDragOver(false)).then(u => unLeave = u);
    return () => {
      if (unDrop) unDrop();
      if (unEnter) unEnter();
      if (unLeave) unLeave();
    };
  }, []);

  async function pickFolder() {
    const s = await open({ directory: true, multiple: false });
    if (s) handleFolderDrop(s as string);
  }

  async function handleFolderDrop(path: string) {
    setFolderPath(path);
    setStatus("scanning");
    try {
      const stats = await invoke("scan_folder", { folderPath: path });
      setFileStats(stats);
      setStatus("idle");
    } catch (e) {
      setResult({ error_message: String(e) });
      setStatus("error");
    }
  }

  async function pickDir() {
    const s = await open({ directory: true, multiple: false });
    if (s) saveOutputDir(s as string);
  }

  async function runBatch() {
    if (!folderPath || !outputDir) return;
    setStatus("processing");
    setProgress(0);
    try {
      const res = await invoke("batch_convert_folder", {
        folderPath,
        targetFormat: targetTool,
        outputDir
      });
      setResult(res);
      setStatus((res as any).success ? "done" : "error");
      if ((res as any).success) {
        setProgress(100);
      }
    } catch (e) {
      setResult({ success: false, error_message: String(e) });
      setStatus("error");
    }
  }

  const folderName = folderPath.split("\\").pop() || "";

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="pt">Batch folder</div>
      <div className="ps">Select a folder — Formatica scans and converts everything</div>

      <div className="two-col">
        <div>
          <div className="panel">
            <div className="plabel">Input folder</div>
            <div
              style={{
                border: "2px dashed var(--border2)",
                borderRadius: "10px",
                padding: "32px",
                textAlign: "center",
                cursor: "pointer",
                marginBottom: "12px",
                transition: "all 0.15s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "var(--bb)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "var(--border2)";
              }}
              onClick={pickFolder}
            >
              {status === "scanning" ? (
                <>
                  <div style={{ fontSize: "26px", marginBottom: "6px" }}>🔄</div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>Scanning folder…</div>
                </>
              ) : fileStats ? (
                <>
                  <div style={{ fontSize: "26px", marginBottom: "6px" }}>✅</div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--green)" }}>
                    Folder scanned · {fileStats.total || 0} files found
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text2)", marginTop: "3px" }}>
                    {fileStats.images || 0} images · {fileStats.videos || 0} videos · {fileStats.pdfs || 0} PDFs
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "28px", marginBottom: "7px" }}>📁</div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>Drop folder or Browse</div>
                </>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="plabel">Processing options</div>

            {fileStats && (
              <>
                <div className="fmt-gl">Select tool to apply</div>
                <div className="fmtb">
                  {[
                    { id: "compress", label: "Compress videos" },
                    { id: "convert-video", label: "Convert videos" },
                    { id: "convert-image", label: "Convert images" },
                    { id: "watermark", label: "Watermark all" },
                  ].map(tool => (
                    <button
                      key={tool.id}
                      className={`fb ${targetTool === tool.id ? "active" : ""}`}
                      onClick={() => setTargetTool(tool.id)}
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: "12px", padding: "10px", background: "var(--al)", borderRadius: "6px", border: ".5px solid var(--ab)" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--accent)", marginBottom: "4px" }}>Estimated processing</div>
                  <div style={{ fontSize: "11px", color: "var(--text2)" }}>
                    {fileStats.total} files will be processed. Estimated time: {Math.ceil((fileStats.total || 1) * 2)} minutes
                  </div>
                </div>
              </>
            )}

            <div className="srow" style={{ marginTop: "12px" }}>
              <div className="slabel">Save to</div>
              <div className="sfield">
                <input className="sinput" value={outputDir} readOnly />
                <button className="sbtn" onClick={pickDir}>Browse</button>
              </div>
            </div>

            <button
              className="abtn primary"
              onClick={runBatch}
              disabled={!folderPath || !outputDir || !fileStats || status === "processing"}
            >
              {status === "processing" ? `Processing… ${progress}%` : "Start batch conversion"}
            </button>

            {status === "processing" && (
              <div style={{ marginTop: "12px", padding: "12px", background: "var(--bg3)", borderRadius: "7px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text)", marginBottom: "8px" }}>
                  Processing {folderName}
                </div>
                <div style={{ height: "4px", background: "var(--border2)", borderRadius: "2px", overflow: "hidden", marginBottom: "8px" }}>
                  <div style={{ height: "100%", background: "var(--accent)", borderRadius: "2px", width: progress + "%" }} />
                </div>
                <div style={{ fontSize: "10px", color: "var(--text2)" }}>
                  Do not close the app. Processing {progress}% complete.
                </div>
              </div>
            )}

            {status === "done" && result && (
              <div style={{ background: "var(--gbg)", border: ".5px solid var(--gb)", borderRadius: "9px", padding: "13px 15px", marginTop: "9px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "7px" }}>
                  <span style={{ fontSize: "16px" }}>✅</span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--green)" }}>Batch processing complete</span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text2)" }}>
                  {fileStats?.total || 0} files processed successfully in {folderName}
                </div>
              </div>
            )}

            {status === "error" && result && (
              <div style={{ background: "var(--rbg)", border: ".5px solid var(--rb)", borderRadius: "9px", padding: "13px 15px", marginTop: "9px", color: "var(--red)", fontSize: "11px" }}>
                ❌ {result.error_message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
