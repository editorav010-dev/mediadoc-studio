import { useState, useEffect } from "react";

interface HistoryItem {
  name: string;
  tool: string;
  output: string;
  time: string;
  status: "success" | "error";
  timestamp: number;
}

export function HistoryPanel() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<"all" | "video" | "pdf" | "image">("all");

  useEffect(() => {
    // Load history from localStorage
    try {
      const stored = localStorage.getItem("mds_activity");
      if (stored) {
        // Convert from old format to new extended format
        const parsed = JSON.parse(stored);
        setHistory(
          parsed.map((item: any) => ({
            name: item.name || "",
            tool: item.meta?.split("→")[0]?.trim() || "Unknown",
            output: item.meta?.split("→")[1]?.trim() || "",
            time: item.time || "Just now",
            status: "success" as const,
            timestamp: Date.now(),
          }))
        );
      }
    } catch {
      setHistory([]);
    }
  }, []);

  const filteredHistory = history.filter((item) => {
    if (filter === "all") return true;
    if (filter === "video") return ["Compress video", "Convert video"].includes(item.tool);
    if (filter === "pdf") return item.tool.includes("PDF");
    if (filter === "image") return ["Convert image", "Images to PDF"].includes(item.tool);
    return true;
  });

  const groupedByDate = filteredHistory.reduce(
    (acc, item) => {
      const dateLabel = item.time.includes("ago") ? "Today" : item.time;
      if (!acc[dateLabel]) acc[dateLabel] = [];
      acc[dateLabel].push(item);
      return acc;
    },
    {} as Record<string, HistoryItem[]>
  );

  return (
    <div className="hp">
      <div className="hp-hdr">
        <div className="hp-title">Recent tasks</div>
        <div className="hp-sub">Ctrl+H to toggle · hover for actions</div>
        <div className="hp-filt">
          {["all", "video", "pdf", "image"].map((f) => (
            <button
              key={f}
              className={`hfb ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f as any)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="hp-list">
        {Object.entries(groupedByDate).length === 0 ? (
          <div className="hp-empty">No history yet</div>
        ) : (
          Object.entries(groupedByDate).map(([date, items]) => (
            <div key={date}>
              <div className="hp-gl">{date}</div>
              {items.map((item, idx) => (
                <div key={idx} className="hp-item">
                  <div className="hp-st">
                    <span className={item.status === "success" ? "hp-ok" : "hp-err"}>
                      {item.status === "success" ? "✓" : "✗"}
                    </span>
                    <span style={{ fontSize: "9px", color: "var(--text3)" }}>{item.time}</span>
                  </div>
                  <div className="hp-name">{item.name}</div>
                  <div className="hp-cv">
                    {item.tool} <span>→</span> <span>{item.output}</span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      <div className="hp-foot">
        <span className="hp-stats">{history.length} tasks</span>
        <button className="hp-clr" onClick={() => setHistory([])}>
          Clear all
        </button>
      </div>
    </div>
  );
}
