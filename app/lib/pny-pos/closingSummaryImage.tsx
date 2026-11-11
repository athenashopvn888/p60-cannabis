import { ImageResponse } from "next/og";
import { formatMoney } from "./money.ts";
import { adjustMoney, balancePhrase, floatGapCents, floatPhrase, shortSideCents, tillBalanceRaw } from "./tillLedger.ts";
import type { ClosingSummaryView, SummarySku } from "./closingSummary.ts";

function tone(cents: number) {
  if (cents < 0) return "#dc2626";
  if (cents > 0) return "#16a34a";
  return "#1c1917";
}

function unitsText(units: number) {
  return units > 0 ? `+${units}` : String(units);
}

function Section({ title, background, lines, floatNote }: { title: string; background: string; lines: SummarySku[]; floatNote?: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", background, borderRadius: 12, padding: 12, marginTop: 12 }}>
      <div style={{ display: "flex", fontSize: 18, fontWeight: 700 }}>{title}</div>
      {floatNote ? <div style={{ display: "flex", marginTop: 4 }}>{floatNote}</div> : null}
      <div style={{ display: "flex", marginTop: 8, fontSize: 12, color: "#57534e" }}>
        <div style={{ display: "flex", width: 180 }}>SKU</div>
        <div style={{ display: "flex", width: 70, justifyContent: "flex-end" }}>Units</div>
        <div style={{ display: "flex", width: 90, justifyContent: "flex-end" }}>$</div>
      </div>
      {lines.length === 0 ? <div style={{ display: "flex", marginTop: 6 }}>All matched</div> : null}
      {lines.map((line) => (
        <div key={line.text} style={{ display: "flex", marginTop: 4, fontWeight: 700 }}>
          <div style={{ display: "flex", width: 180 }}>{line.text}</div>
          <div style={{ display: "flex", width: 70, justifyContent: "flex-end", color: tone(line.units) }}>{unitsText(line.units)}</div>
          <div style={{ display: "flex", width: 90, justifyContent: "flex-end", color: tone(line.cents) }}>{adjustMoney(line.cents)}</div>
        </div>
      ))}
    </div>
  );
}

export function summaryImageHeight(view: ClosingSummaryView) {
  const rows = view.openLines.length + view.refillLines.length + view.closeLines.length;
  return 560 + rows * 28 + (view.floatFoundCents == null ? 0 : 22);
}

export function closingSummaryImage(view: ClosingSummaryView) {
  const openCents = shortSideCents(view.openLines);
  const refillCents = shortSideCents(view.refillLines);
  const closeCents = shortSideCents(view.closeLines);
  const floatKnown = view.floatExpectedCents != null && view.floatFoundCents != null;
  const gap = floatKnown ? floatGapCents(view.floatExpectedCents ?? 0, view.floatFoundCents ?? 0) : 0;
  const openWithFloat = openCents + (floatKnown ? -gap : 0);
  const raw = tillBalanceRaw({
    cash_sales_cents: view.cashSalesCents,
    deposited_cents: view.depositedCents,
    float_cents: view.floatCents,
    open_cents: openWithFloat,
    refill_cents: refillCents,
    close_cents: closeCents,
  });
  const final = balancePhrase(raw);
  const floatNote = floatKnown ? `Float ${floatPhrase(gap).word} ${formatMoney(floatPhrase(gap).cents)}` : null;
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: 390, padding: 16, background: "#fafaf9", color: "#1c1917", fontSize: 16 }}>
        <div style={{ display: "flex", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Closing summary</div>
        {view.weedInStore != null ? <Row label="WEED in store this shift" value={view.weedInStore ? "WEED" : "NO WEED"} /> : null}
        <Row label="Cash sales" value={formatMoney(view.cashSalesCents)} />
        <Row label="− Deposits" value={formatMoney(view.depositedCents)} />
        <Row label="− Cash on hand (float)" value={formatMoney(view.floatCents)} />
        <Row label="Open count" value={adjustMoney(openWithFloat)} color={tone(openWithFloat)} />
        <Row label="Refill count" value={adjustMoney(refillCents)} color={tone(refillCents)} />
        <Row label="Closing count" value={adjustMoney(closeCents)} color={tone(closeCents)} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 800 }}>
          <div style={{ display: "flex" }}>FINAL TILL BALANCE</div>
          <div style={{ display: "flex", color: final.tone === "short" ? "#dc2626" : "#16a34a", fontSize: 20 }}>{final.word} {formatMoney(final.cents)}</div>
        </div>
        <Section title="Opening Verify" background="#dbeafe" lines={view.openLines} floatNote={floatNote} />
        <Section title="Refill Issues" background="#fce7f3" lines={view.refillLines} />
        <Section title="Closing Count" background="#fef3c7" lines={view.closeLines} />
      </div>
    ),
    { width: 390, height: summaryImageHeight(view) },
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e7e5e4", paddingTop: 6, marginTop: 6 }}>
      <div style={{ display: "flex" }}>{label}</div>
      <div style={{ display: "flex", fontWeight: 700, color: color ?? "#1c1917" }}>{value}</div>
    </div>
  );
}
