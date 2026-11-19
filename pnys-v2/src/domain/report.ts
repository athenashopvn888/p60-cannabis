import type { CloseResult } from "./close";
import { assertCloseParity, calculateClose, type CloseInput } from "./close";
import { dollars, finalLabel, signedQty } from "./format";

export type CloseReportBundle = {
  subject: string;
  body: string;
  screen: CloseResult;
  parityHash: string;
  xlsFileName: string;
};

export function buildCloseReportBundle(input: CloseInput, stored: CloseResult, corrected = false): CloseReportBundle {
  const recalculated = calculateClose(input);
  assertCloseParity(stored, recalculated);
  const short = `−${dollars(stored.totalShortCents)} (${stored.totalShortQty} units)`;
  const extra = `+${dollars(stored.totalExtraCents)} (${stored.totalExtraQty} units)`;
  const netStock = finalLabel(stored.netStockKind, stored.netStockCents);
  const final = finalLabel(stored.finalKind, stored.finalVarianceCents);
  const differenceLines = stored.differences.length === 0
    ? ["All stock matched."]
    : stored.differences.map((line) => `${line.sku} | ${line.name} | expected ${line.expectedQty} | counted ${line.countedQty} | ${signedQty(line.qtyDiff)} | ${dollars(line.valueDiffCents, true)} | ${line.result}`);
  const correctedLine = corrected ? "Corrected resend. Till data changed only through an audited Master Admin correction.\n\n" : "";
  const body = `${correctedLine}${input.storeCode} CLOSING TILL — ${input.staffName}
Shift ref: ${input.shiftCode}
Opening cash: ${dollars(input.openingCashCents)}
Cash sales: ${dollars(input.cashSalesCents)}
Stock shortage: ${short}
Stock extra: ${extra}
Net stock: ${netStock}
EXPECTED CASH: ${dollars(stored.expectedCashCents)}
Safebox: ${dollars(input.safeboxCents)}
Closing float: ${dollars(input.closingFloatCents)}
CASH ACCOUNTED: ${dollars(stored.cashAccountedCents)}
FINAL: ${final}

STOCK COUNT DIFFERENCES
${differenceLines.join("\n")}`;
  return {
    subject: corrected ? `CORRECTED – ${input.storeCode} ${input.staffName} closing ${input.shiftCode}` : `${input.storeCode} CLOSING TILL – ${input.staffName}`,
    body,
    screen: stored,
    parityHash: stored.parityHash,
    xlsFileName: `${input.storeCode}-Stock-Closing-${input.shiftCode}.xlsx`,
  };
}
