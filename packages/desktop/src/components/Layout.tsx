import { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { HistoryPanel } from "./HistoryPanel";

interface LayoutProps {
  theme: "dark" | "light";
  onThemeToggle: () => void;
  currentScreen: string;
  onNavigate: (screen: string) => void;
  deps: any[];
  onFixDeps: () => void;
  children: ReactNode;
}

export function Layout({
  theme,
  onThemeToggle,
  currentScreen,
  onNavigate,
  deps,
  onFixDeps,
  children,
}: LayoutProps) {
  return (
    <div className={`app theme-${theme}`}>
      <TopBar
        theme={theme}
        onThemeToggle={onThemeToggle}
        deps={deps}
        onFixDeps={onFixDeps}
      />
      <div className="body-row">
        <Sidebar currentScreen={currentScreen} onNavigate={onNavigate} />
        <main className="main">
          {children}
        </main>
        <HistoryPanel />
      </div>
    </div>
  );
}
