import type { CloseInput, CloseResult } from "@/src/domain/close";
import { dollars, finalLabel, resultClass, signedQty } from "@/src/domain/format";

function SummaryLine({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className={`summaryLine ${className}`}><span>{label}</span><strong>{value}</strong></div>;
}

export default function CloseSummary({ input, result }: { input: CloseInput; result: CloseResult }) {
  return (
    <div className="stack">
      <section className="card">
        <div className="eyebrow">Canonical close · parity {result.parityHash.slice(0, 12)}</div>
        <h1>Confirm &amp; post</h1>
        <p className="muted">{input.storeCode} · {input.staffName} · {input.shiftCode}</p>
        <SummaryLine label="Opening cash" value={dollars(input.openingCashCents)} />
        <SummaryLine label="Cash sales" value={dollars(input.cashSalesCents)} />
        <SummaryLine label="Stock short" value={`−${dollars(result.totalShortCents)}`} className="short" />
        <SummaryLine label="Less stock extra" value={`+${dollars(result.totalExtraCents)}`} className="over" />
        <SummaryLine label="EXPECTED CASH" value={dollars(result.expectedCashCents)} className="heavy" />
        <SummaryLine label="Safebox" value={dollars(input.safeboxCents)} />
        <SummaryLine label="Closing float" value={dollars(input.closingFloatCents)} />
        <SummaryLine label="CASH ACCOUNTED" value={dollars(result.cashAccountedCents)} className="heavy" />
        <SummaryLine label="FINAL" value={finalLabel(result.finalKind, result.finalVarianceCents)} className={`heavy ${resultClass(result.finalKind)}`} />
      </section>

      <section className="card">
        <h2>Stock differences</h2>
        <p className="muted">Staff must review every difference before posting.</p>
        <div className="tableWrap">
          <table>
            <thead><tr><th>SKU</th><th>Item</th><th>Expected</th><th>Counted</th><th>Qty</th><th>$</th><th>Result</th></tr></thead>
            <tbody>
              {result.differences.map((line) => (
                <tr key={line.sku}>
                  <td>{line.sku}</td><td>{line.name}</td><td>{line.expectedQty}</td><td>{line.countedQty}</td>
                  <td className={resultClass(line.result)}>{signedQty(line.qtyDiff)}</td>
                  <td className={resultClass(line.result)}>{dollars(line.valueDiffCents, true)}</td>
                  <td className={resultClass(line.result)}>{line.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid3" style={{ marginTop: 14 }}>
          <div className="metric short"><span>TOTAL SHORT</span><strong>−{result.totalShortQty} / −{dollars(result.totalShortCents)}</strong></div>
          <div className="metric over"><span>TOTAL EXTRA</span><strong>+{result.totalExtraQty} / +{dollars(result.totalExtraCents)}</strong></div>
          <div className={`metric ${resultClass(result.netStockKind)}`}><span>NET STOCK</span><strong>{finalLabel(result.netStockKind, result.netStockCents)}</strong></div>
        </div>
      </section>
    </div>
  );
}
