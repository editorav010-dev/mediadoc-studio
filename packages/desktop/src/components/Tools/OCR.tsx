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

interface OCRProps {
  onBack: () => void;
}

export function OCRScreen({ onBack }: OCRProps) {
  const [inputFile, setInputFile] = useState("");
  const [language, setLanguage] = useState("auto");
  const [ocrMode, setOcrMode] = useState("fast");
  const [outputFormat, setOutputFormat] = useState("pdf");
  const [outputDir, saveOutputDir] = useSavedPath("ocr");
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [_pages, setPages] = useState<any[]>([]);
  const [_extractedText, setExtractedText] = useState("");
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
    const s = await open({
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });
    if (s) setInputFile(s as string);
  }

  async function pickDir() {
    const s = await open({ directory: true, multiple: false });
    if (s) saveOutputDir(s as string);
  }

  async function runOCR() {
    if (!inputFile || !outputDir) return;
    setStatus("processing");
    setResult(null);
    setProgress(0);
    setPages([]);
    setExtractedText("");

    try {
      const res = await invoke("perform_ocr", {
        inputPath: inputFile,
        language,
        mode: ocrMode,
        outputFormat,
        outputDir
      });
      setResult(res);
      setStatus((res as any).success ? "done" : "error");
      if ((res as any).success) {
        setProgress(100);
        setExtractedText("Extracted text preview (sample)...");
      }
    } catch (e) {
      setResult({ success: false, error_message: String(e) });
      setStatus("error");
    }
  }

  const fileName = inputFile.split("\\").pop() || "";

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="pt">OCR — PDF to searchable text</div>
      <div className="ps">Convert scanned PDFs into searchable, selectable, copyable text</div>

      <div className="two-col">
        <div>
          <div className="panel">
            <div className="plabel">Input PDF</div>
            <div className={`dz ${inputFile ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`} onClick={pickFile}>
              {inputFile ? (
                <>
                  <div className="dz-icon">✅</div>
                  <div className="dz-main" style={{color:"var(--green)"}}>{fileName}</div>
                  <div className="dz-sub">Ready to process</div>
                </>
              ) : (
                <>
                  <div className="dz-icon">🔍</div>
                  <div className="dz-main">Drop scanned PDF or <span className="bl">Browse</span></div>
                  <div className="dz-sub">Click to load demo · image-based or scanned PDFs</div>
                </>
              )}
            </div>

            {inputFile && status === "idle" && (
              <div style={{ background: "var(--bg3)", border: ".5px solid var(--border2)", borderRadius: "7px", padding: "10px 11px", marginTop: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "7px", borderBottom: ".5px solid var(--border)" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--text3)", textTransform: "uppercase" }}>File metadata</span>
                  <span style={{ fontSize: "9px", padding: "1px 7px", borderRadius: "10px", fontWeight: "700", background: "var(--rbg)", color: "var(--red)", border: ".5px solid var(--rb)" }}>PDF</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginTop: "8px" }}>
                  <div style={{ paddingBottom: "5px" }}>
                    <div style={{ fontSize: "9px", color: "var(--text3)", textTransform: "uppercase", marginBottom: "1px" }}>Pages</div>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text)" }}>8 pages</div>
                  </div>
                  <div style={{ paddingBottom: "5px" }}>
                    <div style={{ fontSize: "9px", color: "var(--text3)", textTransform: "uppercase", marginBottom: "1px" }}>File size</div>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text)" }}>4.8 MB</div>
                  </div>
                </div>
              </div>
            )}

            {status === "processing" && (
              <div style={{ background: "var(--bg3)", borderRadius: "7px", padding: "10px 12px", marginTop: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text)", marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Processing OCR...</span>
                  <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: "700" }}>{progress}%</span>
                </div>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "7px" }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: "28px",
                        height: "36px",
                        borderRadius: "3px",
                        background: i * 12.5 <= progress ? "var(--gbg)" : "var(--bg2)",
                        border: i * 12.5 <= progress ? ".5px solid var(--gb)" : ".5px solid var(--border2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "9px",
                        color: "var(--text3)",
                      }}
                    >
                      {i * 12.5 <= progress ? "✓" : i + 1}
                    </div>
                  ))}
                </div>
                <div style={{ height: "4px", background: "var(--border2)", borderRadius: "2px", overflow: "hidden", marginBottom: "4px" }}>
                  <div style={{ height: "100%", background: "var(--accent)", borderRadius: "2px", width: progress + "%" }} />
                </div>
                <div style={{ fontSize: "10px", color: "var(--text2)" }}>Initialising Tesseract engine…</div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="plabel">OCR settings</div>

            <div className="fmt-gl">Language</div>
            <div className="fmtb">
              {["Auto-detect", "English", "Arabic", "French", "German"].map(lang => (
                <button
                  key={lang}
                  className={`fb ${language === lang.toLowerCase().replace("-", "") ? "active" : ""}`}
                  onClick={() => setLanguage(lang.toLowerCase().replace("-", ""))}
                >
                  {lang}
                </button>
              ))}
            </div>

            <div className="fmt-gl">OCR mode</div>
            <div className="fmtb">
              <button
                className={`fb ${ocrMode === "fast" ? "active" : ""}`}
                onClick={() => setOcrMode("fast")}
              >
                Standard (fast)
              </button>
              <button
                className={`fb ${ocrMode === "accurate" ? "active" : ""}`}
                onClick={() => setOcrMode("accurate")}
              >
                Accurate (slow)
              </button>
            </div>

            <div className="fmt-gl">Output format</div>
            <div className="fmtb">
              {["pdf", "txt", "docx"].map(fmt => (
                <button
                  key={fmt}
                  className={`fb ${outputFormat === fmt ? "active" : ""}`}
                  onClick={() => setOutputFormat(fmt)}
                >
                  {fmt === "pdf" ? "Searchable PDF" : fmt === "txt" ? "Plain text" : "DOCX"}
                </button>
              ))}
            </div>

            <div style={{ padding: "8px 10px", background: "var(--bbg)", border: ".5px solid var(--bb)", borderRadius: "6px", fontSize: "10px", color: "var(--blue)", marginBottom: "9px", lineHeight: "1.5" }}>
              ℹ Formatica uses Tesseract OCR — all processing is local. Your documents never leave your device.
            </div>

            <div className="srow">
              <div className="slabel">Save to</div>
              <div className="sfield">
                <input className="sinput" value={outputDir} readOnly />
                <button className="sbtn" onClick={pickDir}>Browse</button>
              </div>
            </div>

            <button
              className="abtn primary"
              onClick={runOCR}
              disabled={!inputFile || !outputDir || status === "processing"}
            >
              {status === "processing" ? "Processing..." : "Extract text from PDF"}
            </button>

            {status === "done" && result && (
              <div style={{ background: "var(--bg2)", border: ".5px solid var(--border)", borderRadius: "6px", padding: "9px", marginTop: "9px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "var(--text3)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Extracted text preview</span>
                  <button style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "4px", background: "var(--al)", color: "var(--accent)", border: ".5px solid var(--ab)", cursor: "pointer", fontFamily: "inherit" }}>
                    Copy all
                  </button>
                </div>
                <div style={{ fontSize: "10px", color: "var(--text2)", lineHeight: "1.6", fontFamily: "'Courier New', monospace", maxHeight: "100px", overflowY: "auto", padding: "4px" }}>
                  SERVICE AGREEMENT<br/><br/>
                  This agreement is entered into as of 2026...<br/><br/>
                  [OCR extracted from 8 pages · 2,847 words detected]
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
