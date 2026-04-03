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

interface WatermarkProps {
  onBack: () => void;
}

export function WatermarkScreen({ onBack }: WatermarkProps) {
  const [inputFile, setInputFile] = useState("");
  const [wmType, setWmType] = useState<"text" | "logo">("text");
  const [wmText, setWmText] = useState("© Formatica");
  const [fontSize, setFontSize] = useState(16);
  const [opacity, setOpacity] = useState(60);
  const [color, setColor] = useState("#ffffff");
  const [position, setPosition] = useState("bot-right");
  const [outputFormat, setOutputFormat] = useState("WEBP");
  const [applyTo, setApplyTo] = useState("single");
  const [outputDir, saveOutputDir] = useSavedPath("watermark");
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<any>(null);
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

  const positionLabels: Record<string, string> = {
    "top-left": "↖", "top-center": "↑", "top-right": "↗",
    "mid-left": "←", "center": "⊙", "mid-right": "→",
    "bot-left": "↙", "bot-center": "↓", "bot-right": "↘"
  };

  async function pickFile() {
    const s = await open({
      multiple: false,
      filters: [{ name: "Media", extensions: ["jpg", "jpeg", "png", "webp", "mp4", "mkv", "mov"] }]
    });
    if (s) setInputFile(s as string);
  }

  async function pickDir() {
    const s = await open({ directory: true, multiple: false });
    if (s) saveOutputDir(s as string);
  }

  async function run() {
    if (!inputFile || !outputDir) return;
    setStatus("processing");
    setResult(null);
    try {
      const res = await invoke("apply_watermark", {
        inputPath: inputFile,
        watermarkText: wmType === "text" ? wmText : "",
        fontSize: wmType === "text" ? fontSize : 16,
        opacity,
        color,
        position,
        outputDir,
        isBatch: applyTo === "batch",
        outputFormat
      });
      setResult(res);
      setStatus((res as any).success ? "done" : "error");
    } catch (e) {
      setResult({ success: false, error_message: String(e) });
      setStatus("error");
    }
  }

  const fileName = inputFile.split("\\").pop() || "";

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="pt">Watermark & branding</div>
      <div className="ps">Add text or logo watermarks to images and videos</div>

      <div className="two-col">
        <div>
          <div className="panel">
            <div className="plabel">Input file</div>
            <div className={`dz ${inputFile ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`} onClick={pickFile}>
              {inputFile ? (
                <>
                  <div className="dz-icon">✅</div>
                  <div className="dz-main" style={{color:"var(--green)"}}>{fileName}</div>
                  <div className="dz-sub">{inputFile.split(".").pop()?.toUpperCase()}</div>
                </>
              ) : (
                <>
                  <div className="dz-icon">💧</div>
                  <div className="dz-main">Drop image or video or <span className="bl">Browse</span></div>
                  <div className="dz-sub">JPG · PNG · WEBP · MP4 · MKV · MOV</div>
                </>
              )}
            </div>

            {inputFile && (
              <div style={{ marginTop: "10px", padding: "10px", background: "var(--bg3)", borderRadius: "7px" }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text3)", marginBottom: "8px" }}>
                  Live preview — drag watermark to reposition
                </div>
                <div style={{
                  background: "linear-gradient(135deg,#1a1a2e,#0f3460)",
                  borderRadius: "8px",
                  padding: "40px",
                  textAlign: "center",
                  position: "relative",
                  minHeight: "140px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <div style={{ fontSize: "28px", opacity: 0.3 }}>🖼</div>
                  <div style={{
                    position: "absolute",
                    ...getPositionStyle(position),
                    fontSize: fontSize + "px",
                    color: color,
                    opacity: opacity / 100,
                    fontWeight: 700,
                    textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
                    border: "1px dashed rgba(255,255,255,0.3)",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    whiteSpace: "nowrap",
                  }}>
                    {wmText}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="plabel">Watermark settings</div>

            <div className="fmt-gl">Watermark type</div>
            <div className="fmtb">
              <button className={`fb ${wmType === "text" ? "active" : ""}`} onClick={() => setWmType("text")}>
                Text
              </button>
              <button className={`fb ${wmType === "logo" ? "active" : ""}`} onClick={() => setWmType("logo")}>
                Logo / image
              </button>
            </div>

            {wmType === "text" && (
              <>
                <div className="fmt-gl">Watermark text</div>
                <input
                  className="n-input"
                  value={wmText}
                  onChange={(e) => setWmText(e.target.value)}
                  style={{marginBottom: "8px"}}
                />

                <div className="fmt-gl">Font size</div>
                <div className="slrow">
                  <div className="slhdr">
                    <span className="sllbl">Size (px)</span>
                    <span className="slval">{fontSize}px</span>
                  </div>
                  <input type="range" min="8" max="48" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
                </div>

                <div className="fmt-gl">Opacity</div>
                <div className="slrow">
                  <div className="slhdr">
                    <span className="sllbl">Opacity</span>
                    <span className="slval">{opacity}%</span>
                  </div>
                  <input type="range" min="10" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
                </div>

                <div className="fmt-gl">Color</div>
                <div className="fmtb">
                  {[
                    { name: "White", hex: "#ffffff" },
                    { name: "Black", hex: "#000000" },
                    { name: "Brand", hex: "#6c5ce7" }
                  ].map(c => (
                    <button
                      key={c.hex}
                      className={`fb ${color === c.hex ? "active" : ""}`}
                      onClick={() => setColor(c.hex)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                <div className="fmt-gl">Position</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "3px" }}>
                  {Object.entries(positionLabels).map(([pos, label]) => (
                    <button
                      key={pos}
                      className={`fb ${position === pos ? "active" : ""}`}
                      onClick={() => setPosition(pos)}
                      style={{ padding: "6px" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={{ marginTop: "12px" }}>
              <div className="fmt-gl">Output format</div>
              <div className="fmtb">
                {["JPG", "PNG", "WEBP"].map(fmt => (
                  <button
                    key={fmt}
                    className={`fb ${outputFormat === fmt ? "active" : ""}`}
                    onClick={() => setOutputFormat(fmt)}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: "12px" }}>
              <div className="fmt-gl">Apply to</div>
              <div className="fmtb">
                <button className={`fb ${applyTo === "single" ? "active" : ""}`} onClick={() => setApplyTo("single")}>
                  Single file
                </button>
                <button className={`fb ${applyTo === "batch" ? "active" : ""}`} onClick={() => setApplyTo("batch")}>
                  Batch folder
                </button>
              </div>
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
              onClick={run}
              disabled={!inputFile || !outputDir || status === "processing"}
            >
              {status === "processing" ? "Applying..." : "Apply watermark"}
            </button>

            {status === "done" && result && (
              <div style={{ background: "var(--gbg)", border: ".5px solid var(--gb)", borderRadius: "9px", padding: "13px 15px", marginTop: "9px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "7px" }}>
                  <span style={{ fontSize: "16px" }}>✅</span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--green)" }}>Watermark applied</span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text2)" }}>File saved successfully</div>
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

function getPositionStyle(position: string): React.CSSProperties {
  const positions: Record<string, React.CSSProperties> = {
    "top-left": { top: "10px", left: "10px" },
    "top-center": { top: "10px", left: "50%", transform: "translateX(-50%)" },
    "top-right": { top: "10px", right: "10px" },
    "mid-left": { top: "50%", left: "10px", transform: "translateY(-50%)" },
    "center": { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
    "mid-right": { top: "50%", right: "10px", transform: "translateY(-50%)" },
    "bot-left": { bottom: "10px", left: "10px" },
    "bot-center": { bottom: "10px", left: "50%", transform: "translateX(-50%)" },
    "bot-right": { bottom: "10px", right: "10px" }
  };
  return positions[position] || positions["bot-right"];
}
