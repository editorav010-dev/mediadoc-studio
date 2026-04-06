interface SidebarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

interface ToolItem {
  id: string;
  label: string;
  icon: string;
  kbd?: string;
  pulse?: boolean;
}

interface Section {
  name: string;
  count: number;
  badge: "nb-r" | "nb-b" | "nb-g" | "nb-p";
  tools: ToolItem[];
}

const toolSections: Section[] = [
  {
    name: "PDF",
    count: 5,
    badge: "nb-r",
    tools: [
      { id: "document", label: "Convert doc", icon: "📄", kbd: "Ctrl+1" },
      { id: "image", label: "Images to PDF", icon: "🖼", kbd: "Ctrl+2" },
      { id: "mergepdf", label: "Merge PDF", icon: "🔗", kbd: "Ctrl+3" },
      { id: "splitpdf", label: "Split PDF", icon: "✂️", kbd: "Ctrl+4" },
      { id: "ocr", label: "OCR PDF", icon: "🔍", kbd: "Ctrl+5" },
    ],
  },
  {
    name: "Media",
    count: 3,
    badge: "nb-b",
    tools: [
      { id: "media_download", label: "Media downloader", icon: "📥" },
      { id: "compress", label: "Compress video", icon: "🗜", kbd: "Ctrl+6" },
      { id: "video", label: "Convert video", icon: "🎬" },
    ],
  },
  {
    name: "Image",
    count: 2,
    badge: "nb-g",
    tools: [
      { id: "imageconvert", label: "Convert image", icon: "🖼", kbd: "Ctrl+7" },
      { id: "watermark", label: "Watermark", icon: "💧", kbd: "Ctrl+8" },
    ],
  },
  {
    name: "Batch",
    count: 2,
    badge: "nb-p",
    tools: [
      { id: "queue", label: "Queue", icon: "⚡", kbd: "Ctrl+Q", pulse: true },
      { id: "batchfolder", label: "Batch folder", icon: "📁" },
    ],
  },
  {
    name: "System",
    count: 3,
    badge: "nb-p",
    tools: [
      { id: "shortcuts", label: "Shortcuts", icon: "⌨", kbd: "Ctrl+/" },
      { id: "settings", label: "Settings", icon: "⚙", kbd: "Ctrl+," },
      { id: "monitor", label: "Resources", icon: "📊", kbd: "Ctrl+M" },
    ],
  },
];

export function Sidebar({ currentScreen, onNavigate }: SidebarProps) {
  return (
    <div className="sidebar">
      {toolSections.map((section) => (
        <div key={section.name}>
          <div className="ns">
            {section.name} <span className={`nb ${section.badge}`}>{section.count}</span>
          </div>
          {section.tools.map((tool) => (
            <div
              key={tool.id}
              className={`ni ${currentScreen === tool.id ? "active" : ""}`}
              onClick={() => onNavigate(tool.id)}
            >
              <span className="ni-icon">{tool.icon}</span>
              {tool.label}
              {tool.kbd && <span className="kbd-hint">{tool.kbd}</span>}
              {tool.pulse && <div className="qdot" />}
            </div>
          ))}
          <div className="ndiv" />
        </div>
      ))}
      <div className="nsp" />
    </div>
  );
}
