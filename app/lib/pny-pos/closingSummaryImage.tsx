import { ImageResponse } from "next/og";
import { formatMoney, formatStoreDate, formatStoreTime } from "./money.ts";
import { adjustMoney, balancePhrase, floatGapCents, floatPhrase } from "./tillLedger.ts";
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
  return 820 + view.deposits.length * 30 + rows * 28 + (view.floatFoundCents == null ? 0 : 22);
}

export function closingSummaryImage(view: ClosingSummaryView) {
  const differences = [...view.openLines, ...view.refillLines, ...view.closeLines];
  const stockShortsCents = differences.reduce((sum, line) => sum + Math.max(0, -line.cents), 0);
  const stockExtraCents = differences.reduce((sum, line) => sum + Math.max(0, line.cents), 0);
  const totalCashCollectedCents = view.depositedCents + view.expenseCents + view.floatCents;
  const overShortCents = totalCashCollectedCents - view.cashSalesCents - stockShortsCents + stockExtraCents;
  const floatKnown = view.floatExpectedCents != null && view.floatFoundCents != null;
  const gap = floatKnown ? floatGapCents(view.floatExpectedCents ?? 0, view.floatFoundCents ?? 0) : 0;
  const final = balancePhrase(-overShortCents);
  const floatNote = floatKnown ? `Float ${floatPhrase(gap).word} ${formatMoney(floatPhrase(gap).cents)}` : null;
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: 390, padding: 16, background: "#fafaf9", color: "#1c1917", fontSize: 16 }}>
        <div style={{ display: "flex", border: "4px solid #7f1d1d", borderRadius: 12, background: "#fef2f2", color: "#991b1b", padding: 12, textAlign: "center", fontSize: 23, lineHeight: 1.08, fontWeight: 900 }}>
          TAKE A PICTURE OF THIS SCREEN AND POST IT IN THE TILL GROUP FOR THE ACCOUNTANT
        </div>
        <div style={{ display: "flex", flexDirection: "column", borderRadius: 12, background: "#1c1917", color: "#fff", padding: 12, marginTop: 12 }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 800 }}>{view.storeLabel}</div>
          <div style={{ display: "flex", marginTop: 3 }}>{view.staffName}</div>
          <div style={{ display: "flex", marginTop: 3 }}>{formatStoreDate(view.endedAt)} · {formatStoreTime(view.startedAt)}–{formatStoreTime(view.endedAt)} Toronto</div>
        </div>
        <div style={{ display: "flex", fontSize: 22, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>Closing summary</div>
        {view.weedInStore != null ? <Row label="WEED in store this shift" value={view.weedInStore ? "WEED" : "NO WEED"} /> : null}
        <div style={{ display: "flex", fontSize: 18, fontWeight: 700, marginTop: 6 }}>Deposits</div>
        {view.deposits.length === 0 ? <Row label="No deposit bags" value={formatMoney(0)} /> : view.deposits.map((deposit, index) => (
          <Row key={`${deposit.code ?? "na"}-${index}`} label={`Bag ${deposit.code || "n/a"}`} value={formatMoney(deposit.amountCents)} />
        ))}
        <Row label="Total deposits" value={formatMoney(view.depositedCents)} />
        <Row label="Expense paid from store cash" value={formatMoney(view.expenseCents)} />
        <Row label="Float left" value={formatMoney(view.floatCents)} />
        <Row label="TOTAL CASH COLLECTED" value={formatMoney(totalCashCollectedCents)} strong />
        <Row label="− Stock sold value" value={formatMoney(view.cashSalesCents)} />
        <Row label="− Stock shorts" value={formatMoney(stockShortsCents)} color="#dc2626" />
        <Row label="+ Stock extra" value={formatMoney(stockExtraCents)} color="#16a34a" />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 800 }}>
          <div style={{ display: "flex" }}>Total</div>
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

function Row({ label, value, color, strong = false }: { label: string; value: string; color?: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderTop: strong ? "3px solid #1c1917" : "1px solid #e7e5e4", borderBottom: strong ? "3px solid #1c1917" : undefined, paddingTop: 6, paddingBottom: strong ? 6 : 0, marginTop: 6, fontWeight: strong ? 800 : 400 }}>
      <div style={{ display: "flex" }}>{label}</div>
      <div style={{ display: "flex", fontWeight: 700, color: color ?? "#1c1917" }}>{value}</div>
    </div>
  );
}
