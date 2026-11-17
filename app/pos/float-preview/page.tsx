import TillSummary from "../TillSummary";
import FloatPreviewClient from "./FloatPreviewClient";

export const dynamic = "force-dynamic";

export default async function FloatPreviewPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const state = (await searchParams).state ?? "match";
  if (state === "report") return <main style={{ boxSizing: "border-box", width: 390, maxWidth: "100%", margin: "0 auto", padding: 12, overflow: "hidden", background: "#f4f7fb" }}>
    <TillSummary storeLabel="PNYS" staffName="Preview Staff" startedAt="2026-11-14T01:00:00.000Z" endedAt="2026-11-14T09:00:00.000Z" deposits={[{ code: "DRY-100", amountCents: 30000 }]} totalOrders={14} cigarettePacks={43} cashSalesCents={30000} depositedCents={30000} floatCents={4000} openLines={[]} refillLines={[]} closeLines={[{ sku: "240", text: "#240", units: -1, cents: -500 }]} floatExpectedCents={4000} floatFoundCents={4500} floatAdjustment={{ expectedCents: 4000, countedCents: 4500, differenceCents: 500, staff: "Preview Staff", time: "2026-11-14T01:02:00.000Z" }} />
  </main>;
  return <FloatPreviewClient state={state} />;
}
