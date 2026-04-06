

interface TopBarProps {
  theme: "dark" | "light";
  onThemeToggle: () => void;
  deps: any[];
  onFixDeps: () => void;
}

export function TopBar({ theme, onThemeToggle, deps, onFixDeps }: TopBarProps) {
  const allOk = deps.length > 0 && deps.every((d) => d.installed);

  const handleFixDeps = () => {
    onFixDeps();
  };

  return (
    <header className="topbar">
      <div className="tl">
        <div className="logo">F</div>
        <div>
          <div className="appname">Formatica</div>
          <div className="appsub">Ultimate Edition · Private processing</div>
        </div>
      </div>
      <div className="tr">
        {deps.map((d) => (
          <span
            key={d.name}
            className={`dpill ${d.installed ? "d-ok" : "d-err"}`}
          >
            {d.installed ? "● " : "○ "} {d.name}
          </span>
        ))}
        {!allOk && (
          <button className="fix-btn" onClick={handleFixDeps}>
            ⚡ Fix Now
          </button>
        )}
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
      </div>
    </header>
  );
}
