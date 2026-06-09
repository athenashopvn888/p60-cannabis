import Link from "next/link";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <Navbar />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
          padding: "120px 24px 60px",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 64, marginBottom: 16 }}>🔥</span>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 6vw, 48px)",
            fontWeight: 900,
            color: "var(--text-primary)",
            margin: "0 0 12px",
          }}
        >
          Page Not Found
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            maxWidth: 400,
            margin: "0 0 32px",
            lineHeight: 1.6,
          }}
        >
          This page doesn&apos;t exist — but our shelves are fully stocked.
          Browse 200+ strains at York&apos;s most fire dispensary.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/"
            style={{
              padding: "14px 28px",
              background: "var(--green-dark)",
              color: "white",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            Browse Menu
          </Link>
          <Link
            href="/contact"
            style={{
              padding: "14px 28px",
              background: "transparent",
              color: "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Visit Us
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
