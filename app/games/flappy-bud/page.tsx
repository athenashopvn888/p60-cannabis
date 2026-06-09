"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ScreenLock from "../../components/ScreenLock";

/* ── Constants ── */
const CANVAS_W = 400;
const CANVAS_H = 600;
const GRAVITY = 0.45;
const FLAP_POWER = -7.5;
const PIPE_WIDTH = 60;
const PIPE_GAP = 155;
const PIPE_SPEED = 2.8;
const BUD_SIZE = 30;
const PIPE_SPAWN_INTERVAL = 100;

interface Pipe {
  x: number;
  topH: number;
  scored: boolean;
}

export default function FlappyBudPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"idle" | "playing" | "dead">("idle");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const stateRef = useRef({ gameState: "idle" as string, score: 0 });

  // Game refs
  const budY = useRef(CANVAS_H / 2);
  const budVel = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const frameCount = useRef(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem("flappyBudHighScore");
    if (stored) setHighScore(parseInt(stored));
  }, []);

  const resetGame = useCallback(() => {
    budY.current = CANVAS_H / 2;
    budVel.current = 0;
    pipes.current = [];
    frameCount.current = 0;
    setScore(0);
    stateRef.current.score = 0;
  }, []);

  const flap = useCallback(() => {
    if (stateRef.current.gameState === "idle") {
      resetGame();
      setGameState("playing");
      stateRef.current.gameState = "playing";
      budVel.current = FLAP_POWER;
    } else if (stateRef.current.gameState === "playing") {
      budVel.current = FLAP_POWER;
    } else {
      resetGame();
      setGameState("idle");
      stateRef.current.gameState = "idle";
    }
  }, [resetGame]);

  /* ── Game loop ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      /* Background gradient */
      const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      bg.addColorStop(0, "#030712");
      bg.addColorStop(0.5, "#0a1628");
      bg.addColorStop(1, "#0f172a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      /* Stars */
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 137.5) % CANVAS_W;
        const sy = (i * 97.3) % CANVAS_H;
        ctx.beginPath();
        ctx.arc(sx, sy, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      const gs = stateRef.current.gameState;

      if (gs === "playing") {
        frameCount.current++;

        /* Gravity */
        budVel.current += GRAVITY;
        budY.current += budVel.current;

        /* Spawn pipes */
        if (frameCount.current % PIPE_SPAWN_INTERVAL === 0) {
          const minTop = 60;
          const maxTop = CANVAS_H - PIPE_GAP - 60;
          const topH = minTop + Math.random() * (maxTop - minTop);
          pipes.current.push({ x: CANVAS_W, topH, scored: false });
        }

        /* Move & score pipes */
        pipes.current = pipes.current.filter((p) => p.x + PIPE_WIDTH > -10);
        for (const p of pipes.current) {
          p.x -= PIPE_SPEED;
          if (!p.scored && p.x + PIPE_WIDTH < CANVAS_W / 2 - BUD_SIZE / 2) {
            p.scored = true;
            stateRef.current.score++;
            setScore(stateRef.current.score);
          }
        }

        /* Collision */
        const budX = CANVAS_W / 2 - BUD_SIZE / 2;
        const budRight = budX + BUD_SIZE;
        const budTop = budY.current;
        const budBottom = budY.current + BUD_SIZE;

        if (budTop < 0 || budBottom > CANVAS_H) {
          stateRef.current.gameState = "dead";
          setGameState("dead");
          if (stateRef.current.score > highScore) {
            setHighScore(stateRef.current.score);
            localStorage.setItem("flappyBudHighScore", stateRef.current.score.toString());
          }
        }

        for (const p of pipes.current) {
          if (budRight > p.x && budX < p.x + PIPE_WIDTH) {
            if (budTop < p.topH || budBottom > p.topH + PIPE_GAP) {
              stateRef.current.gameState = "dead";
              setGameState("dead");
              if (stateRef.current.score > highScore) {
                setHighScore(stateRef.current.score);
                localStorage.setItem("flappyBudHighScore", stateRef.current.score.toString());
              }
            }
          }
        }
      }

      /* ── Draw pipes ── */
      for (const p of pipes.current) {
        const pipeGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
        pipeGrad.addColorStop(0, "#166534");
        pipeGrad.addColorStop(0.5, "#22c55e");
        pipeGrad.addColorStop(1, "#166534");
        ctx.fillStyle = pipeGrad;

        /* Top pipe */
        ctx.beginPath();
        ctx.roundRect(p.x, 0, PIPE_WIDTH, p.topH, [0, 0, 8, 8]);
        ctx.fill();

        /* Bottom pipe */
        ctx.beginPath();
        ctx.roundRect(p.x, p.topH + PIPE_GAP, PIPE_WIDTH, CANVAS_H - p.topH - PIPE_GAP, [8, 8, 0, 0]);
        ctx.fill();

        /* Pipe caps */
        ctx.fillStyle = "#15803d";
        ctx.fillRect(p.x - 4, p.topH - 18, PIPE_WIDTH + 8, 18);
        ctx.fillRect(p.x - 4, p.topH + PIPE_GAP, PIPE_WIDTH + 8, 18);
      }

      /* ── Draw bud (cannabis leaf) ── */
      const budX = CANVAS_W / 2 - BUD_SIZE / 2;
      ctx.save();
      ctx.translate(budX + BUD_SIZE / 2, budY.current + BUD_SIZE / 2);
      const rotation = Math.min(Math.max(budVel.current * 3, -30), 60);
      ctx.rotate((rotation * Math.PI) / 180);

      /* Leaf body */
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      /* Leaf points */
      const leafColor = "#34d399";
      ctx.fillStyle = leafColor;
      for (let angle = 0; angle < 5; angle++) {
        const a = ((angle * 72 - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 10, Math.sin(a) * 10, 6, 3, a, 0, Math.PI * 2);
        ctx.fill();
      }

      /* Eye (emoji-style) */
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(4, -2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#030712";
      ctx.beginPath();
      ctx.arc(5, -2, 2, 0, Math.PI * 2);
      ctx.fill();

      /* Glow */
      ctx.shadowColor = "#34d399";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "transparent";
      ctx.fillRect(0, 0, 0, 0);
      ctx.shadowBlur = 0;

      ctx.restore();

      /* ── Score ── */
      ctx.fillStyle = "white";
      ctx.font = "bold 36px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(stateRef.current.score.toString(), CANVAS_W / 2, 60);

      /* ── Overlays ── */
      if (gs === "idle") {
        ctx.fillStyle = "rgba(3, 7, 18, 0.5)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 32px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🌿 FLAPPY BUD", CANVAS_W / 2, CANVAS_H / 2 - 30);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "16px 'Space Grotesk', sans-serif";
        ctx.fillText("Tap or press Space to fly!", CANVAS_W / 2, CANVAS_H / 2 + 15);
      }

      if (gs === "dead") {
        ctx.fillStyle = "rgba(3, 7, 18, 0.7)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 28px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 40);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 48px 'Outfit', sans-serif";
        ctx.fillText(stateRef.current.score.toString(), CANVAS_W / 2, CANVAS_H / 2 + 15);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "14px 'Space Grotesk', sans-serif";
        ctx.fillText("Tap to try again", CANVAS_W / 2, CANVAS_H / 2 + 50);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [highScore]);

  /* ── Input handlers ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap]);

  return (
    <main>
      <Navbar />
      <ScreenLock />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          paddingTop: 80,
          paddingBottom: 40,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 900,
            marginBottom: 8,
            color: "white",
          }}
        >
          🌿 Flappy Bud
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            marginBottom: 20,
          }}
        >
          High Score:{" "}
          <span style={{ color: "#fbbf24", fontWeight: 700 }}>{highScore}</span>
        </p>

        {/* How to Play */}
        <div style={{ maxWidth: 400, width: "100%", marginBottom: 16, padding: "12px 16px", background: "rgba(45,106,79,0.08)", border: "1px solid rgba(45,106,79,0.15)", borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#2D6A4F", marginBottom: 6 }}>📖 How to Play</div>
          <ul style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li>Press <strong>Space</strong>, <strong>↑ Arrow</strong>, or <strong>Tap</strong> the screen to flap upward</li>
            <li>Navigate through the gaps between green pipes</li>
            <li>Don&apos;t hit the pipes or the edges — one hit and it&apos;s game over!</li>
            <li>Each gap passed = 1 point. How high can you score?</li>
          </ul>
        </div>

        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={flap}
          onTouchStart={(e) => {
            e.preventDefault();
            flap();
          }}
          style={{
            border: "1px solid rgba(51,65,85,0.3)",
            borderRadius: 16,
            cursor: "pointer",
            maxWidth: "100%",
            touchAction: "none",
          }}
        />

        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          Space / Tap to flap · Don&apos;t hit the pipes
        </p>
      </div>
      <Footer />
    </main>
  );
}
