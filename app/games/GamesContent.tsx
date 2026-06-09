"use client";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const GAMES = [
  {
    id: "flappy-bud",
    name: "Flappy Bud",
    emoji: "🌿",
    description: "Fly a cannabis leaf through bong pipes. Tap to flap!",
    color: "#34d399",
  },
  {
    id: "snake-munchies",
    name: "Snake Munchies",
    emoji: "🐍",
    description: "Eat edibles, grow longer. Don't bite yourself!",
    color: "#22d3ee",
  },
  {
    id: "brick-breaker",
    name: "Brick Breaker 420",
    emoji: "🧱",
    description: "Smash through trichome crystals with your paddle.",
    color: "#a78bfa",
  },
  {
    id: "memory-match",
    name: "Memory Match",
    emoji: "🃏",
    description: "Match strain names to their images. Test your memory!",
    color: "#f59e0b",
  },
  {
    id: "2048-strains",
    name: "2048 Strains",
    emoji: "🔢",
    description: "Merge tiers: Budget → AA → AAA+ → Premium → Exotic!",
    color: "#f97316",
  },
];

export default function GamesContent() {
  return (
    <main>
      <Navbar />

      <section style={{ width: "100%", overflow: "hidden", marginTop: "92px" }}>
        <img
          src="/banners/10_Games.webp"
          alt="Games Arcade — Flappy Bud, Snake Munchies, Brick Breaker 420"
          style={{ width: "100%", height: "auto", display: "block", objectFit: "contain" }}
        />
      </section>

      <div
        style={{
          paddingBottom: 80,
          maxWidth: 900,
          margin: "0 auto",
          padding: "40px 24px 80px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p
            style={{
              fontSize: 16,
              color: "var(--text-secondary)",
              maxWidth: 500,
              margin: "0 auto",
            }}
          >
            Kill time while your order&apos;s ready. Beat the high score. No
            dispensary in York has this.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {GAMES.map((game) => (
            <a
              key={game.id}
              href={`/games/${game.id}`}
              style={{
                display: "block",
                padding: 28,
                background: "var(--bg-card)",
                backdropFilter: "blur(12px)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                textDecoration: "none",
                transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.transform = "translateY(-6px)";
                el.style.borderColor = game.color;
                el.style.boxShadow = `0 20px 50px rgba(0,0,0,0.4), 0 0 25px ${game.color}33`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.transform = "";
                el.style.borderColor = "";
                el.style.boxShadow = "";
              }}
            >
              <div style={{ fontSize: 42, marginBottom: 14 }}>{game.emoji}</div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  fontWeight: 800,
                  color: game.color,
                  marginBottom: 6,
                }}
              >
                {game.name}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                {game.description}
              </p>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  fontWeight: 700,
                  color: game.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Play Now →
              </div>
            </a>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
}
