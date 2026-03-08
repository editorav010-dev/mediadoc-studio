import { useState } from "react";
import "./App.css";

type Screen = "home" | "document" | "audio" | "download" | "image";

function App() {
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <div className="app">
      <header className="app-header">
        <h1>Media & Doc Studio</h1>
        <p className="tagline">Convert, download, and extract — privately, locally.</p>
      </header>

      {screen === "home" && (
        <div className="home-grid">
          <button className="feature-tile" onClick={() => setScreen("document")}>
            <span className="tile-icon">📄</span>
            <span className="tile-title">Convert Document</span>
            <span className="tile-desc">DOCX, PDF, XLSX, ODT and more</span>
          </button>

          <button className="feature-tile" onClick={() => setScreen("image")}>
            <span className="tile-icon">🖼️</span>
            <span className="tile-title">Images to PDF</span>
            <span className="tile-desc">Combine images into one PDF</span>
          </button>

          <button className="feature-tile" onClick={() => setScreen("download")}>
            <span className="tile-icon">⬇️</span>
            <span className="tile-title">Download Media</span>
            <span className="tile-desc">Save online videos locally</span>
          </button>

          <button className="feature-tile" onClick={() => setScreen("audio")}>
            <span className="tile-icon">🎵</span>
            <span className="tile-title">Extract Audio</span>
            <span className="tile-desc">MP3, AAC, WAV from any video</span>
          </button>
        </div>
      )}

      {screen !== "home" && (
        <div className="screen-placeholder">
          <button className="back-btn" onClick={() => setScreen("home")}>
            ← Back
          </button>
          <h2>
            {screen === "document" && "Convert Document"}
            {screen === "image" && "Images to PDF"}
            {screen === "download" && "Download Media"}
            {screen === "audio" && "Extract Audio"}
          </h2>
          <p>This screen is coming in Week 2.</p>
        </div>
      )}
    </div>
  );
}

export default App;
