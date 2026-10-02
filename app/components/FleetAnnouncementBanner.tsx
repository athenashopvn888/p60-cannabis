import Link from "next/link";

const lineStyle = {
  margin: 0,
  padding: "14px 16px",
  color: "#fff",
  fontSize: "clamp(18px, 3vw, 32px)",
  fontWeight: 900,
  lineHeight: 1.15,
  letterSpacing: "0.02em",
  textAlign: "center" as const,
  textTransform: "uppercase" as const,
};

export default function FleetAnnouncementBanner() {
  return (
    <aside
      data-fleet-homepage-announcement=""
      aria-label="Store announcements"
      style={{ width: "100%", position: "relative", zIndex: 50 }}
    >
      <p style={{ ...lineStyle, background: "#b91c1c" }}>
        CIGARETTE DEAL ! 2 PACK $5 MIX AND MATCH
      </p>
      <p style={{ ...lineStyle, background: "#c2410c" }}>
        EXCLUSIVE SPECIAL PREMIUM GRADE BB FULL, BB LIGHT &amp; BELMONT KING SIZE!
      </p>
      <Link href="/items/cigarettes" data-bb-premium-banner="" aria-label="Shop BB and Belmont Premium Grade cigarettes">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/banners/BB_Belmont_Premium_Grade.webp"
          alt="Exclusive Premium Grade BB Full Flavor, BB Lights, and Belmont King Size cigarettes at P60 Cannabis."
        />
      </Link>
    </aside>
  );
}
