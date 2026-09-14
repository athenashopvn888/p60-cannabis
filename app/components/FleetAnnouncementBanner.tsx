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
      aria-label="Store announcements"
      style={{ width: "100%", position: "relative", zIndex: 50 }}
    >
      <p style={{ ...lineStyle, background: "#b91c1c" }}>
        CIGARETTE DEAL ! 2 PACK $5 MIX AND MATCH
      </p>
      <p style={{ ...lineStyle, background: "#c2410c" }}>
        EXCLUSIVE SPECIAL PREMIUM GRADE BB FULL &amp; BB LIGHT!
      </p>
    </aside>
  );
}
