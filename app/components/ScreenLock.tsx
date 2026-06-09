"use client";

import { useState, useEffect } from "react";

export default function ScreenLock() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (locked) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [locked]);

  return (
    <button
      onClick={() => setLocked(!locked)}
      aria-label={locked ? "Unlock screen scrolling" : "Lock screen for gameplay"}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 18px",
        background: locked
          ? "linear-gradient(135deg, #ef4444, #dc2626)"
          : "linear-gradient(135deg, #22c55e, #16a34a)",
        color: "white",
        border: "none",
        borderRadius: 50,
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: locked
          ? "0 4px 20px rgba(239,68,68,0.4)"
          : "0 4px 20px rgba(34,197,94,0.4)",
        transition: "all 0.3s ease",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {locked ? "🔓 Unlock" : "🔒 Lock Screen"}
    </button>
  );
}
