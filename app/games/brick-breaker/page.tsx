"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ScreenLock from "../../components/ScreenLock";

const W = 420;
const H = 560;
const PADDLE_W = 80;
const PADDLE_H = 14;
const BALL_R = 7;
const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_W = (W - 20) / BRICK_COLS;
const BRICK_H = 22;
const BRICK_TOP = 60;

const TIER_COLORS = [
  ["#fbbf24", "#f59e0b"], // Exotic gold
  ["#a78bfa", "#8b5cf6"], // Premium purple
  ["#22d3ee", "#06b6d4"], // AAA+ cyan
  ["#34d399", "#10b981"], // AA green
  ["#f97316", "#ea580c"], // Fire orange
  ["#f43f5e", "#e11d48"], // Sale red
];

interface Brick { x: number; y: number; alive: boolean; color: string[]; hits: number; }

export default function BrickBreakerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<"idle" | "playing" | "dead" | "win">("idle");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const paddleX = useRef(W / 2 - PADDLE_W / 2);
  const ballX = useRef(W / 2);
  const ballY = useRef(H - 50);
  const ballDX = useRef(3);
  const ballDY = useRef(-3.5);
  const bricks = useRef<Brick[]>([]);
  const gsRef = useRef("idle");
  const scoreRef = useRef(0);
  const mouseX = useRef(W / 2);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const s = localStorage.getItem("brickBreaker420HS");
    if (s) setHighScore(parseInt(s));
  }, []);

  const initBricks = useCallback(() => {
    const arr: Brick[] = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        arr.push({
          x: 10 + c * BRICK_W,
          y: BRICK_TOP + r * (BRICK_H + 4),
          alive: true,
          color: TIER_COLORS[r % TIER_COLORS.length],
          hits: r < 2 ? 2 : 1,
        });
      }
    }
    bricks.current = arr;
  }, []);

  const resetGame = useCallback(() => {
    paddleX.current = W / 2 - PADDLE_W / 2;
    ballX.current = W / 2;
    ballY.current = H - 50;
    ballDX.current = (Math.random() > 0.5 ? 1 : -1) * 3;
    ballDY.current = -3.5;
    scoreRef.current = 0;
    setScore(0);
    initBricks();
  }, [initBricks]);

  const start = useCallback(() => {
    resetGame();
    gsRef.current = "playing";
    setGameState("playing");
  }, [resetGame]);

  /* ── Game loop ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      /* BG */
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, W, H);

      const gs = gsRef.current;

      if (gs === "playing") {
        /* Paddle follows mouse */
        paddleX.current = Math.max(0, Math.min(W - PADDLE_W, mouseX.current - PADDLE_W / 2));

        /* Ball physics */
        ballX.current += ballDX.current;
        ballY.current += ballDY.current;

        /* Wall bounces */
        if (ballX.current - BALL_R <= 0 || ballX.current + BALL_R >= W) ballDX.current *= -1;
        if (ballY.current - BALL_R <= 0) ballDY.current *= -1;

        /* Death */
        if (ballY.current + BALL_R >= H) {
          gsRef.current = "dead";
          setGameState("dead");
          if (scoreRef.current > highScore) {
            setHighScore(scoreRef.current);
            localStorage.setItem("brickBreaker420HS", scoreRef.current.toString());
          }
        }

        /* Paddle collision */
        if (
          ballY.current + BALL_R >= H - 30 - PADDLE_H &&
          ballY.current + BALL_R <= H - 30 &&
          ballX.current >= paddleX.current &&
          ballX.current <= paddleX.current + PADDLE_W
        ) {
          ballDY.current = -Math.abs(ballDY.current) - 0.1;
          const hitPos = (ballX.current - paddleX.current) / PADDLE_W - 0.5;
          ballDX.current = hitPos * 7;
        }

        /* Brick collisions */
        let allDead = true;
        for (const b of bricks.current) {
          if (!b.alive) continue;
          allDead = false;
          if (
            ballX.current + BALL_R > b.x &&
            ballX.current - BALL_R < b.x + BRICK_W &&
            ballY.current + BALL_R > b.y &&
            ballY.current - BALL_R < b.y + BRICK_H
          ) {
            b.hits--;
            if (b.hits <= 0) {
              b.alive = false;
              scoreRef.current += 20;
            } else {
              scoreRef.current += 5;
            }
            setScore(scoreRef.current);
            ballDY.current *= -1;
            break;
          }
        }

        if (allDead) {
          gsRef.current = "win";
          setGameState("win");
          if (scoreRef.current > highScore) {
            setHighScore(scoreRef.current);
            localStorage.setItem("brickBreaker420HS", scoreRef.current.toString());
          }
        }
      }

      /* ── Draw bricks ── */
      for (const b of bricks.current) {
        if (!b.alive) continue;
        const grad = ctx.createLinearGradient(b.x, b.y, b.x + BRICK_W, b.y + BRICK_H);
        grad.addColorStop(0, b.color[0]);
        grad.addColorStop(1, b.color[1]);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(b.x + 2, b.y + 1, BRICK_W - 4, BRICK_H - 2, 4);
        ctx.fill();

        if (b.hits > 1) {
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("✦", b.x + BRICK_W / 2, b.y + BRICK_H / 2);
        }
      }

      /* ── Draw paddle ── */
      const paddleGrad = ctx.createLinearGradient(paddleX.current, 0, paddleX.current + PADDLE_W, 0);
      paddleGrad.addColorStop(0, "#22d3ee");
      paddleGrad.addColorStop(1, "#a78bfa");
      ctx.fillStyle = paddleGrad;
      ctx.beginPath();
      ctx.roundRect(paddleX.current, H - 30 - PADDLE_H, PADDLE_W, PADDLE_H, 7);
      ctx.fill();
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      /* ── Draw ball ── */
      ctx.fillStyle = "#fbbf24";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(ballX.current, ballY.current, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      /* Score */
      ctx.fillStyle = "white";
      ctx.font = "bold 16px 'Outfit', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`Score: ${scoreRef.current}`, 10, 10);

      /* Overlays */
      if (gs === "idle") {
        ctx.fillStyle = "rgba(3,7,18,0.6)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#a78bfa";
        ctx.font = "bold 26px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🧱 BRICK BREAKER 420", W / 2, H / 2 - 25);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "15px 'Space Grotesk', sans-serif";
        ctx.fillText("Move mouse · Click to start", W / 2, H / 2 + 15);
      }

      if (gs === "dead") {
        ctx.fillStyle = "rgba(3,7,18,0.7)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 26px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("GAME OVER", W / 2, H / 2 - 30);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 42px 'Outfit', sans-serif";
        ctx.fillText(scoreRef.current.toString(), W / 2, H / 2 + 15);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "14px 'Space Grotesk', sans-serif";
        ctx.fillText("Click to retry", W / 2, H / 2 + 48);
      }

      if (gs === "win") {
        ctx.fillStyle = "rgba(3,7,18,0.7)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#34d399";
        ctx.font = "bold 26px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🎉 ALL CLEAR!", W / 2, H / 2 - 30);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 42px 'Outfit', sans-serif";
        ctx.fillText(scoreRef.current.toString(), W / 2, H / 2 + 15);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "14px 'Space Grotesk', sans-serif";
        ctx.fillText("Click to play again", W / 2, H / 2 + 48);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [highScore]);

  /* ── Mouse tracking ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX.current = ((e.clientX - rect.left) / rect.width) * W;
    };

    const handleClick = () => {
      if (gsRef.current !== "playing") start();
    };

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      mouseX.current = ((e.touches[0].clientX - rect.left) / rect.width) * W;
      if (gsRef.current !== "playing") start();
    };

    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchstart", handleTouch, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      mouseX.current = ((e.touches[0].clientX - rect.left) / rect.width) * W;
    }, { passive: false });

    return () => {
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("click", handleClick);
    };
  }, [start]);

  return (
    <main>
      <Navbar />
      <ScreenLock />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", paddingTop: 80, paddingBottom: 40 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 900, marginBottom: 8, color: "white" }}>🧱 Brick Breaker 420</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
          High Score: <span style={{ color: "#fbbf24", fontWeight: 700 }}>{highScore}</span>
        </p>

        {/* How to Play */}
        <div style={{ maxWidth: 420, width: "100%", marginBottom: 16, padding: "12px 16px", background: "rgba(45,106,79,0.08)", border: "1px solid rgba(45,106,79,0.15)", borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#2D6A4F", marginBottom: 6 }}>📖 How to Play</div>
          <ul style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li>Move your <strong>mouse</strong> or <strong>finger</strong> to control the paddle at the bottom</li>
            <li>Bounce the ball to break all the coloured bricks above</li>
            <li>Gold-tier bricks (top rows) need <strong>2 hits</strong> to break</li>
            <li>Don&apos;t let the ball fall below the paddle!</li>
          </ul>
        </div>

        <canvas ref={canvasRef} width={W} height={H} style={{ border: "1px solid rgba(51,65,85,0.3)", borderRadius: 16, cursor: "none", maxWidth: "100%", touchAction: "none" }} />
        <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>Move mouse to control paddle · Don&apos;t let the ball drop</p>
      </div>
          <Footer />
    </main>
  );
}
