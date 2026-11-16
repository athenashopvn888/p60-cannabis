import ClosingFlowPreview from "./ClosingFlowPreview";

export const dynamic = "force-dynamic";

export default async function ClosingSummaryPreviewPage({ searchParams }: { searchParams: Promise<{ step?: string; expanded?: string }> }) {
  const query = await searchParams;
  const step = query.step === "cash" || query.step === "review" || query.step === "confirm" ? query.step : "count";
  return <ClosingFlowPreview step={step} expanded={step === "count" && query.expanded === "1"} />;
}
