import OpeningFloatCheck from "../OpeningFloatCheck";
import TillSummary from "../TillSummary";

export const dynamic = "force-dynamic";

export default async function FloatPreviewPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const state = (await searchParams).state ?? "match";
  if (state === "report") return <main style={{ width: 390, maxWidth: "100%", margin: "0 auto", padding: 12, background: "#f4f7fb" }}>
    <TillSummary storeLabel="PNYS" staffName="Preview Staff" startedAt="2026-11-14T01:00:00.000Z" endedAt="2026-11-14T09:00:00.000Z" deposits={[{ code: "DRY-100", amountCents: 30000 }]} cashSalesCents={30000} depositedCents={30000} floatCents={4000} openLines={[]} refillLines={[]} closeLines={[]} floatExpectedCents={4000} floatFoundCents={4500} floatAdjustment={{ expectedCents: 4000, countedCents: 4500, differenceCents: 500, staff: "Preview Staff", time: "2026-11-14T01:02:00.000Z" }} />
  </main>;
  const mismatch = state === "mismatch" || state === "warning";
  return <main style={{ minHeight: "100dvh", background: "#eef2f7" }}>
    <OpeningFloatCheck expectedCents={4000} value={mismatch ? "45.00" : "40.00"} busy={false} initialWarning={state === "warning"} onChange={() => undefined} onSave={() => undefined} />
  </main>;
}
