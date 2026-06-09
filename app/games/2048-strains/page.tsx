"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ScreenLock from "../../components/ScreenLock";

const SIZE = 4;

const TIER_LEVELS: Record<number, { name: string; color: string; bg: string }> = {
  2: { name: "SHRED", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  4: { name: "BUDGET", color: "#94a3b8", bg: "rgba(148,163,184,0.18)" },
  8: { name: "AA", color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  16: { name: "AA+", color: "#34d399", bg: "rgba(52,211,153,0.22)" },
  32: { name: "AAA", color: "#22d3ee", bg: "rgba(34,211,238,0.12)" },
  64: { name: "AAA+", color: "#22d3ee", bg: "rgba(34,211,238,0.2)" },
  128: { name: "PREM", color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  256: { name: "CRAFT", color: "#a78bfa", bg: "rgba(167,139,250,0.25)" },
  512: { name: "EXOT", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  1024: { name: "FIRE", color: "#f97316", bg: "rgba(249,115,22,0.2)" },
  2048: { name: "GOAT", color: "#ef4444", bg: "rgba(239,68,68,0.25)" },
};

type Grid = number[][];

function createEmpty(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandom(grid: Grid): Grid {
  const empties: [number, number][] = [];
  grid.forEach((row, r) => row.forEach((v, c) => { if (v === 0) empties.push([r, c]); }));
  if (empties.length === 0) return grid;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const g = grid.map((row) => [...row]);
  g[r][c] = Math.random() < 0.9 ? 2 : 4;
  return g;
}

function slideRow(row: number[]): { row: number[]; score: number } {
  let score = 0;
  const filtered = row.filter((v) => v !== 0);
  const merged: number[] = [];
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2;
      merged.push(val);
      score += val;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i++;
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { row: merged, score };
}

function moveLeft(grid: Grid): { grid: Grid; score: number; moved: boolean } {
  let totalScore = 0;
  let moved = false;
  const newGrid = grid.map((row) => {
    const { row: newRow, score } = slideRow(row);
    totalScore += score;
    if (newRow.some((v, i) => v !== row[i])) moved = true;
    return newRow;
  });
  return { grid: newGrid, score: totalScore, moved };
}

function rotateRight(grid: Grid): Grid {
  const n = grid.length;
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => grid[n - 1 - c][r])
  );
}

function move(grid: Grid, dir: "left" | "right" | "up" | "down"): { grid: Grid; score: number; moved: boolean } {
  let g = grid.map((r) => [...r]);
  let rotations = 0;
  if (dir === "right") rotations = 2;
  if (dir === "up") rotations = 1;
  if (dir === "down") rotations = 3;

  for (let i = 0; i < rotations; i++) g = rotateRight(g);
  const result = moveLeft(g);
  let rg = result.grid;
  for (let i = 0; i < (4 - rotations) % 4; i++) rg = rotateRight(rg);
  return { grid: rg, score: result.score, moved: result.moved };
}

function canMove(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

export default function Game2048Page() {
  const [grid, setGrid] = useState<Grid>(createEmpty);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    const s = localStorage.getItem("2048StrainsBest");
    if (s) setBestScore(parseInt(s));
    if (!initialized.current) {
      initialized.current = true;
      let g = createEmpty();
      g = addRandom(g);
      g = addRandom(g);
      setGrid(g);
    }
  }, []);

  const resetGame = useCallback(() => {
    let g = createEmpty();
    g = addRandom(g);
    g = addRandom(g);
    setGrid(g);
    setScore(0);
    setGameOver(false);
    setWon(false);
  }, []);

  const handleMove = useCallback((dir: "left" | "right" | "up" | "down") => {
    if (gameOver) return;
    setGrid((prev) => {
      const result = move(prev, dir);
      if (!result.moved) return prev;
      const newGrid = addRandom(result.grid);

      setScore((s) => {
        const ns = s + result.score;
        setBestScore((bs) => {
          if (ns > bs) { localStorage.setItem("2048StrainsBest", ns.toString()); return ns; }
          return bs;
        });
        return ns;
      });

      // Check for 2048
      if (newGrid.some((row) => row.some((v) => v >= 2048))) setWon(true);
      if (!canMove(newGrid)) setGameOver(true);

      return newGrid;
    });
  }, [gameOver]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, "left" | "right" | "up" | "down"> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
        a: "left", d: "right", w: "up", s: "down",
      };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); handleMove(dir); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleMove]);

  // Touch support
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove(dx > 0 ? "right" : "left");
    } else {
      handleMove(dy > 0 ? "down" : "up");
    }
    touchStart.current = null;
  };

  const getTile = (v: number) => TIER_LEVELS[v] || { name: String(v), color: "#ef4444", bg: "rgba(239,68,68,0.3)" };

  return (
    <main>
      <Navbar />
      <ScreenLock />

      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", paddingTop: 85, paddingBottom: 40, padding: "85px 16px 40px" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 900, marginBottom: 4, color: "white" }}>🔢 2048 Strains</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Merge tiers: Budget → AA → AAA+ → Premium → Exotic!</p>

        {/* How to Play */}
        <div style={{ maxWidth: 360, width: "100%", marginBottom: 16, padding: "12px 16px", background: "rgba(45,106,79,0.08)", border: "1px solid rgba(45,106,79,0.15)", borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#2D6A4F", marginBottom: 6 }}>📖 How to Play</div>
          <ul style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li><strong>Swipe</strong> or use <strong>Arrow Keys / WASD</strong> to slide all tiles</li>
            <li>When two tiles with the <strong>same number</strong> collide, they <strong>merge into one</strong></li>
            <li>Keep merging to climb tiers: 2→4→8→16→32→64→128→256→512→1024→<strong>2048!</strong></li>
            <li>The game ends when no more moves are possible</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
          <div style={{ textAlign: "center", padding: "8px 20px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Score</div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #fbbf24, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{score}</div>
          </div>
          <div style={{ textAlign: "center", padding: "8px 20px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Best</div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "var(--font-display)", color: "#fbbf24" }}>{bestScore}</div>
          </div>
        </div>

        {/* Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
          gap: 8,
          padding: 12,
          background: "rgba(15,23,42,0.6)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          maxWidth: 360,
          width: "100%",
        }}>
          {grid.flat().map((val, i) => {
            const tile = getTile(val);
            return (
              <div key={i} style={{
                aspectRatio: "1/1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                background: val === 0 ? "rgba(30,41,59,0.4)" : tile.bg,
                border: val === 0 ? "1px solid rgba(51,65,85,0.2)" : `1px solid ${tile.color}33`,
                transition: "all 0.15s ease",
              }}>
                {val > 0 && (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 900, color: tile.color, letterSpacing: "0.04em" }}>{tile.name}</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: "white", fontFamily: "var(--font-display)" }}>{val}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {(gameOver || won) && (
          <div style={{ marginTop: 20, textAlign: "center", padding: "16px 32px", background: won ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${won ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 16 }}>
            <p style={{ fontSize: 20, fontWeight: 900, color: won ? "#34d399" : "#ef4444", marginBottom: 4 }}>
              {won ? "🎉 GOAT TIER!" : "💀 No More Moves!"}
            </p>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Score: {score}</p>
            <button onClick={resetGame} style={{ marginTop: 10, padding: "10px 24px", background: "linear-gradient(135deg, #f97316, #ef4444)", color: "white", fontWeight: 800, fontSize: 13, border: "none", borderRadius: 12, cursor: "pointer", textTransform: "uppercase" }}>Play Again</button>
          </div>
        )}

        <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-muted)" }}>Arrow keys / WASD / Swipe to move tiles</p>
        <button onClick={resetGame} style={{ marginTop: 10, padding: "8px 16px", background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 10, cursor: "pointer", fontSize: 12 }}>New Game</button>
      </div>
          <Footer />
    </main>
  );
}
