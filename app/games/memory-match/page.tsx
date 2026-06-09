"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ScreenLock from "../../components/ScreenLock";

const STRAINS = [
  { name: "PINK GODFATHER", emoji: "🌸", tier: "EXOTIC" },
  { name: "BRUCE BANNER", emoji: "💚", tier: "EXOTIC" },
  { name: "HAN SOLO", emoji: "⭐", tier: "EXOTIC" },
  { name: "PINK VELVET", emoji: "💜", tier: "EXOTIC" },
  { name: "PINEAPPLE EXPRESS", emoji: "🍍", tier: "AAA+" },
  { name: "TOASTED STRUDEL", emoji: "🥐", tier: "PREMIUM" },
  { name: "PINK GODZILLA", emoji: "🦎", tier: "PREMIUM" },
  { name: "PINK TOM GAS", emoji: "⛽", tier: "AAA+" },
];

interface Card {
  id: number;
  strain: typeof STRAINS[number];
  isFlipped: boolean;
  isMatched: boolean;
}

export default function MemoryMatchPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matched, setMatched] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameWon, setGameWon] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("memoryMatchBest");
    if (s) setBestScore(parseInt(s));
    initGame();
  }, []);

  const initGame = useCallback(() => {
    const pairs = [...STRAINS, ...STRAINS];
    const shuffled = pairs
      .map((strain, i) => ({ id: i, strain, isFlipped: false, isMatched: false }))
      .sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setFlipped([]);
    setMoves(0);
    setMatched(0);
    setGameWon(false);
  }, []);

  const handleFlip = (id: number) => {
    if (flipped.length === 2) return;
    if (cards[id].isFlipped || cards[id].isMatched) return;

    const newCards = [...cards];
    newCards[id].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = newFlipped;
      if (cards[a].strain.name === cards[b].strain.name) {
        setTimeout(() => {
          const mc = [...cards];
          mc[a].isMatched = true;
          mc[b].isMatched = true;
          setCards(mc);
          setFlipped([]);
          const newMatched = matched + 1;
          setMatched(newMatched);
          if (newMatched === STRAINS.length) {
            setGameWon(true);
            const totalMoves = moves + 1;
            if (bestScore === 0 || totalMoves < bestScore) {
              setBestScore(totalMoves);
              localStorage.setItem("memoryMatchBest", totalMoves.toString());
            }
          }
        }, 500);
      } else {
        setTimeout(() => {
          const mc = [...cards];
          mc[a].isFlipped = false;
          mc[b].isFlipped = false;
          setCards(mc);
          setFlipped([]);
        }, 800);
      }
    }
  };

  const tierColor = (tier: string) => {
    if (tier === "EXOTIC") return "#f59e0b";
    if (tier === "PREMIUM") return "#a78bfa";
    if (tier === "AAA+") return "#22d3ee";
    return "#94a3b8";
  };

  return (
    <main>
      <Navbar />
      <ScreenLock />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", paddingTop: 90, paddingBottom: 40, padding: "90px 16px 40px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 900, marginBottom: 8, color: "white" }}>🃏 Memory Match</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
          Match the strains! Learn while you play.
        </p>

        {/* How to Play */}
        <div style={{ maxWidth: 440, width: "100%", marginBottom: 12, padding: "12px 16px", background: "rgba(45,106,79,0.08)", border: "1px solid rgba(45,106,79,0.15)", borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#2D6A4F", marginBottom: 6 }}>📖 How to Play</div>
          <ul style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li><strong>Tap</strong> a card to flip it and reveal the strain underneath</li>
            <li>Flip <strong>two cards</strong> per turn — if they match, they stay revealed</li>
            <li>Remember where each strain is and match all 8 pairs to win</li>
            <li>Try to finish in the <strong>fewest moves</strong> possible!</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 20, fontSize: 14 }}>
          <span style={{ color: "var(--text-secondary)" }}>Moves: <strong style={{ color: "white" }}>{moves}</strong></span>
          <span style={{ color: "var(--text-secondary)" }}>Matched: <strong style={{ color: "#34d399" }}>{matched}/{STRAINS.length}</strong></span>
          {bestScore > 0 && <span style={{ color: "var(--text-secondary)" }}>Best: <strong style={{ color: "#fbbf24" }}>{bestScore}</strong></span>}
        </div>

        {gameWon && (
          <div style={{ marginBottom: 20, padding: "16px 32px", background: "linear-gradient(135deg, rgba(52,211,153,0.1), rgba(34,211,238,0.1))", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 16, textAlign: "center" }}>
            <p style={{ fontSize: 20, fontWeight: 900, color: "#34d399", marginBottom: 4 }}>🎉 Perfect Match!</p>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Done in {moves} moves</p>
            <button onClick={initGame} style={{ marginTop: 12, padding: "10px 24px", background: "linear-gradient(135deg, #22d3ee, #38bdf8)", color: "#0a0f1e", fontWeight: 800, fontSize: 13, border: "none", borderRadius: 12, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em" }}>Play Again</button>
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          maxWidth: 440,
          width: "100%",
        }}>
          {cards.map((card, i) => (
            <div
              key={i}
              onClick={() => handleFlip(i)}
              style={{
                aspectRatio: "3/4",
                borderRadius: 12,
                cursor: card.isFlipped || card.isMatched ? "default" : "pointer",
                perspective: 600,
                transition: "transform 0.15s ease",
              }}
            >
              <div style={{
                width: "100%",
                height: "100%",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: 8,
                transition: "all 0.3s ease",
                background: card.isFlipped || card.isMatched
                  ? "var(--bg-card)"
                  : "linear-gradient(135deg, #1e293b, #0f172a)",
                border: card.isMatched
                  ? `2px solid ${tierColor(card.strain.tier)}`
                  : card.isFlipped
                  ? "1px solid rgba(255,255,255,0.1)"
                  : "1px solid var(--border-subtle)",
                opacity: card.isMatched ? 0.5 : 1,
                boxShadow: card.isFlipped ? "0 0 20px rgba(34,211,238,0.1)" : "none",
              }}>
                {card.isFlipped || card.isMatched ? (
                  <>
                    <span style={{ fontSize: 28 }}>{card.strain.emoji}</span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      textAlign: "center",
                      color: tierColor(card.strain.tier),
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      lineHeight: 1.2,
                    }}>
                      {card.strain.name}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 28 }}>🌿</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <button onClick={initGame} style={{ marginTop: 24, padding: "10px 20px", background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Reset Game
        </button>
      </div>
          <Footer />
    </main>
  );
}
