import { invoke } from "@tauri-apps/api/core";

interface TopBarProps {
  theme: "dark" | "light";
  onThemeToggle: () => void;
  deps: any[];
  onFixDeps: () => void;
}

export function TopBar({ theme, onThemeToggle, deps, onFixDeps }: TopBarProps) {
  const allOk = deps.length > 0 && deps.every((d) => d.installed);

  const handleFixDeps = async () => {
    await invoke("ensure_ytdlp");
    onFixDeps();
  };

  return (
    <header className="topbar">
      <div className="tl">
        <div className="logo">F</div>
        <div>
          <div className="appname">Formatica</div>
          <div className="appsub">Convert, compress, extract — privately.</div>
        </div>
      </div>
      <div className="tr">
        {deps.map((d) => (
          <span
            key={d.name}
            className={`dpill ${d.installed ? "d-ok" : "d-err"}`}
          >
            ● {d.name}
          </span>
        ))}
        <div className="theme-toggle">
          <button
            className={`tt-btn ${theme === "light" ? "active" : ""}`}
            onClick={onThemeToggle}
          >
            Light
          </button>
          <button
            className={`tt-btn ${theme === "dark" ? "active" : ""}`}
            onClick={onThemeToggle}
          >
            Dark
          </button>
        </div>
        {!allOk && (
          <button className="fix-btn" onClick={handleFixDeps}>
            ⚡ Fix Now
          </button>
        )}
      </div>
    </header>
  );
}
