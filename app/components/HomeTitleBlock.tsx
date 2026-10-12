import { HOME_TITLE } from "../lib/homeDelivery";

// Homepage title block: keeps the store H1 directly under the nav and above the 4 core banners.
export default function HomeTitleBlock() {
  return (
    <header
      data-home-title-block=""
      style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", padding: "12px 16px 10px", background: "#0b0f17", color: "#ffffff", textAlign: "center", position: "relative", zIndex: 40 }}
    >
      <h1 style={{ margin: 0, color: "inherit", fontSize: "clamp(20px, 3vw, 34px)", fontWeight: 800, lineHeight: 1.2, letterSpacing: 0, overflowWrap: "anywhere" }}>{HOME_TITLE}</h1>
    </header>
  );
}