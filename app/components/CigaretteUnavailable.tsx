import Link from "next/link";

const LINKS = [
  { href: "/exotic-weed", label: "Flower" },
  { href: "/items/vapes", label: "Nicotine vapes" },
  { href: "/items/edibles", label: "Edibles" },
  { href: "/items/prerolls", label: "Pre-rolls" },
  { href: "/items/concentrates", label: "Concentrates" },
];

/** Stable cigarette URLs render this instead of redirecting or 404ing. */
export default function CigaretteUnavailable() {
  return (
    <section
      data-cig-unavailable=""
      style={{
        margin: "24px auto",
        maxWidth: "720px",
        padding: "28px 22px",
        background: "#111827",
        color: "#ffffff",
        borderRadius: "12px",
        textAlign: "center",
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: "28px" }}>Cigarettes are not available right now</h2>
      <p style={{ margin: "0 0 16px" }}>This page stays here. The rest of the menu is open.</p>
      <nav aria-label="Other menu categories" style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} style={{ color: "#ffffff", fontWeight: 800 }}>
            {link.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
