
interface SidebarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

const toolSections = [
  {
    name: "PDF",
    count: 5,
    badge: "nb-r",
    tools: [
      { id: "document", label: "Convert doc", icon: "📄", kbd: "Ctrl+1" },
      { id: "image", label: "Images to PDF", icon: "🖼", kbd: "Ctrl+2" },
      { id: "mergepdf", label: "Merge PDF", icon: "🔗", kbd: "Ctrl+3" },
      { id: "splitpdf", label: "Split PDF", icon: "✂️", kbd: "Ctrl+4" },
      // { id: "ocr", label: "OCR PDF", icon: "🔍", kbd: "Ctrl+5" }, // Phase 2
    ],
  },
  {
    name: "Media",
    count: 2,
    badge: "nb-b",
    tools: [
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
      // { id: "watermark", label: "Watermark", icon: "💧", kbd: "Ctrl+8" }, // Phase 2
    ],
  },
  {
    name: "Batch",
    count: 2,
    badge: "nb-p",
    tools: [
      // { id: "queue", label: "Queue", icon: "⚡", kbd: "Ctrl+Q" }, // Phase 3
      // { id: "batchfolder", label: "Batch folder", icon: "📁" }, // Phase 2
    ],
  },
  {
    name: "System",
    count: 3,
    badge: "nb-p",
    tools: [
      // { id: "shortcuts", label: "Shortcuts", icon: "⌨", kbd: "Ctrl+/" }, // Phase 3
      // { id: "settings", label: "Settings", icon: "⚙", kbd: "Ctrl+," }, // Phase 4
      // { id: "monitor", label: "Resources", icon: "📊" }, // Phase 4
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
            </div>
          ))}
          <div className="ndiv" />
        </div>
      ))}
      <div className="nsp" />
    </div>
  );
}
