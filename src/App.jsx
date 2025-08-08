
// src/App.jsx
import React, { useState } from "react";
import WebGLVibeButton from "./WebGLVibeButton";

export default function App() {
  const [speed, setSpeed] = useState(1.0);
  const [streaks, setStreaks] = useState(4);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000000",
        display: "grid",
        gridTemplateRows: "1fr auto",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ display: "grid", placeItems: "center" }}>
        <WebGLVibeButton
          label="Let's go"
          hoverLabel="1 day to go!"
          width={300}
          height={80}
          speed={speed}
          streaks={streaks}
        />
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <label style={{ color: "#999", fontSize: 12, letterSpacing: 0.5 }}>Speed</label>
          <input type="range" min={0.1} max={3.0} step={0.1} value={speed} onChange={(e)=> setSpeed(parseFloat(e.target.value))} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <label style={{ color: "#999", fontSize: 12, letterSpacing: 0.5 }}>Streaks</label>
          <input type="range" min={1} max={10} step={1} value={streaks} onChange={(e)=> setStreaks(parseInt(e.target.value, 10))} />
        </div>
      </div>
    </div>
  );
}