"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ScreenLock from "../../components/ScreenLock";

const CELL = 20;
const COLS = 20;
const ROWS = 25;
const W = COLS * CELL;
const H = ROWS * CELL;

type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";
interface Pos { x: number; y: number; }

const FOOD_EMOJIS = ["🍪", "🧁", "🍬", "🍫", "🍩", "🌿", "🔥", "💎"];

export default function SnakeMunchiesPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"idle" | "playing" | "dead">("idle");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const snake = useRef<Pos[]>([{ x: 10, y: 12 }]);
  const dir = useRef<Dir>("RIGHT");
  const nextDir = useRef<Dir>("RIGHT");
  const food = useRef<Pos>({ x: 15, y: 12 });
  const foodEmoji = useRef("🌿");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gsRef = useRef("idle");
  const scoreRef = useRef(0);

  useEffect(() => {
    const s = localStorage.getItem("snakeMunchiesHS");
    if (s) setHighScore(parseInt(s));
  }, []);

  const spawnFood = useCallback(() => {
    let pos: Pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.current.some((s) => s.x === pos.x && s.y === pos.y));
    food.current = pos;
    foodEmoji.current = FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];
  }, []);

  const resetGame = useCallback(() => {
    snake.current = [{ x: 10, y: 12 }];
    dir.current = "RIGHT";
    nextDir.current = "RIGHT";
    scoreRef.current = 0;
    setScore(0);
    spawnFood();
  }, [spawnFood]);

  const startGame = useCallback(() => {
    resetGame();
    gsRef.current = "playing";
    setGameState("playing");
  }, [resetGame]);

  const die = useCallback(() => {
    gsRef.current = "dead";
    setGameState("dead");
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
      localStorage.setItem("snakeMunchiesHS", scoreRef.current.toString());
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [highScore]);

  /* ── Game tick ── */
  const tick = useCallback(() => {
    if (gsRef.current !== "playing") return;

    dir.current = nextDir.current;
    const head = { ...snake.current[0] };

    switch (dir.current) {
      case "UP": head.y--; break;
      case "DOWN": head.y++; break;
      case "LEFT": head.x--; break;
      case "RIGHT": head.x++; break;
    }

    /* Wall collision */
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) { die(); return; }

    /* Self collision */
    if (snake.current.some((s) => s.x === head.x && s.y === head.y)) { die(); return; }

    snake.current.unshift(head);

    /* Eat food */
    if (head.x === food.current.x && head.y === food.current.y) {
      scoreRef.current += 10;
      setScore(scoreRef.current);
      spawnFood();
    } else {
      snake.current.pop();
    }
  }, [die, spawnFood]);

  /* ── Start interval ── */
  useEffect(() => {
    if (gameState === "playing") {
      intervalRef.current = setInterval(tick, 100);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [gameState, tick]);

  /* ── Render loop ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const draw = () => {
      /* BG */
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, W, H);

      /* Grid lines */
      ctx.strokeStyle = "rgba(51,65,85,0.15)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, H);
        ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL);
        ctx.lineTo(W, y * CELL);
        ctx.stroke();
      }

      /* Food */
      ctx.font = `${CELL - 4}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(foodEmoji.current, food.current.x * CELL + CELL / 2, food.current.y * CELL + CELL / 2);

      /* Snake */
      snake.current.forEach((seg, i) => {
        const isHead = i === 0;
        const gradient = ctx.createLinearGradient(seg.x * CELL, seg.y * CELL, seg.x * CELL + CELL, seg.y * CELL + CELL);
        if (isHead) {
          gradient.addColorStop(0, "#22c55e");
          gradient.addColorStop(1, "#34d399");
        } else {
          const alpha = 1 - (i / snake.current.length) * 0.5;
          gradient.addColorStop(0, `rgba(34,197,94,${alpha})`);
          gradient.addColorStop(1, `rgba(52,211,153,${alpha})`);
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, isHead ? 6 : 4);
        ctx.fill();

        if (isHead) {
          ctx.shadowColor = "#34d399";
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      /* Score */
      ctx.fillStyle = "white";
      ctx.font = "bold 18px 'Outfit', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Score: ${scoreRef.current}`, 10, 10);

      /* Overlays */
      if (gsRef.current === "idle") {
        ctx.fillStyle = "rgba(3,7,18,0.6)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#22d3ee";
        ctx.font = "bold 28px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🐍 SNAKE MUNCHIES", W / 2, H / 2 - 25);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "15px 'Space Grotesk', sans-serif";
        ctx.fillText("Arrow keys or WASD · Press Space", W / 2, H / 2 + 15);
      }

      if (gsRef.current === "dead") {
        ctx.fillStyle = "rgba(3,7,18,0.7)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 26px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("WASTED!", W / 2, H / 2 - 35);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 42px 'Outfit', sans-serif";
        ctx.fillText(scoreRef.current.toString(), W / 2, H / 2 + 10);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "14px 'Space Grotesk', sans-serif";
        ctx.fillText("Press Space to retry", W / 2, H / 2 + 48);
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  /* ── Controls ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (gsRef.current !== "playing") startGame();
        return;
      }

      const key = e.key.toLowerCase();
      const d = dir.current;
      if ((key === "arrowup" || key === "w") && d !== "DOWN") nextDir.current = "UP";
      if ((key === "arrowdown" || key === "s") && d !== "UP") nextDir.current = "DOWN";
      if ((key === "arrowleft" || key === "a") && d !== "RIGHT") nextDir.current = "LEFT";
      if ((key === "arrowright" || key === "d") && d !== "LEFT") nextDir.current = "RIGHT";
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [startGame]);

  return (
    <main>
      <Navbar />
      <ScreenLock />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", paddingTop: 80, paddingBottom: 40 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 900, marginBottom: 8, color: "white" }}>🐍 Snake Munchies</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
          High Score: <span style={{ color: "#fbbf24", fontWeight: 700 }}>{highScore}</span>
        </p>

        {/* How to Play */}
        <div style={{ maxWidth: 400, width: "100%", marginBottom: 16, padding: "12px 16px", background: "rgba(45,106,79,0.08)", border: "1px solid rgba(45,106,79,0.15)", borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#2D6A4F", marginBottom: 6 }}>📖 How to Play</div>
          <ul style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li>Use <strong>Arrow Keys</strong> or <strong>Swipe</strong> to change direction</li>
            <li>Eat the food (coloured dots) to grow longer and score points</li>
            <li>Don&apos;t crash into the walls or your own body!</li>
            <li>The snake speeds up as you score higher</li>
          </ul>
        </div>

        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ border: "1px solid rgba(51,65,85,0.3)", borderRadius: 16, maxWidth: "100%", touchAction: "none" }}
        />
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
          Arrow keys / WASD to move · Space to start
        </p>
      </div>
          <Footer />
    </main>
  );
}
