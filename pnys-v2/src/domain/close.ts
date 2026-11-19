import { sha256 } from "./stable";

export type MoneyKind = "OVER" | "SHORT" | "EVEN";

export type CloseLineInput = {
  sku: string;
  name: string;
  expectedQty: number;
  countedQty: number;
  unitPriceCents: number;
};

export type CloseInput = {
  storeCode: string;
  shiftCode: string;
  staffName: string;
  openingCashCents: number;
  cashSalesCents: number;
  safeboxCents: number;
  closingFloatCents: number;
  lines: CloseLineInput[];
};

export type CloseDifference = CloseLineInput & {
  qtyDiff: number;
  valueDiffCents: number;
  result: MoneyKind;
};

export type CloseResult = {
  schemaVersion: 1;
  input: Omit<CloseInput, "lines">;
  differences: CloseDifference[];
  totalShortQty: number;
  totalExtraQty: number;
  totalShortCents: number;
  totalExtraCents: number;
  netStockCents: number;
  netStockKind: MoneyKind;
  expectedCashCents: number;
  cashAccountedCents: number;
  finalVarianceCents: number;
  finalKind: MoneyKind;
  parityHash: string;
};

function integer(value: number, name: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be an integer.`);
}

export function moneyKind(value: number): MoneyKind {
  if (value > 0) return "OVER";
  if (value < 0) return "SHORT";
  return "EVEN";
}

export function calculateClose(input: CloseInput): CloseResult {
  integer(input.openingCashCents, "openingCashCents");
  integer(input.cashSalesCents, "cashSalesCents");
  integer(input.safeboxCents, "safeboxCents");
  integer(input.closingFloatCents, "closingFloatCents");
  if (!input.storeCode || !input.shiftCode || !input.staffName) throw new Error("Close identity is required.");

  const seen = new Set<string>();
  const differences = input.lines.map((line) => {
    if (seen.has(line.sku)) throw new Error(`Duplicate close SKU ${line.sku}.`);
    seen.add(line.sku);
    integer(line.expectedQty, `${line.sku}.expectedQty`);
    integer(line.countedQty, `${line.sku}.countedQty`);
    integer(line.unitPriceCents, `${line.sku}.unitPriceCents`);
    if (line.expectedQty < 0 || line.countedQty < 0 || line.unitPriceCents < 0) throw new Error(`Negative close value for ${line.sku}.`);
    const qtyDiff = line.countedQty - line.expectedQty;
    const valueDiffCents = qtyDiff * line.unitPriceCents;
    return { ...line, qtyDiff, valueDiffCents, result: moneyKind(valueDiffCents) };
  }).filter((line) => line.qtyDiff !== 0);

  let totalShortQty = 0;
  let totalExtraQty = 0;
  let totalShortCents = 0;
  let totalExtraCents = 0;
  for (const line of differences) {
    if (line.qtyDiff < 0) {
      totalShortQty += Math.abs(line.qtyDiff);
      totalShortCents += Math.abs(line.valueDiffCents);
    } else {
      totalExtraQty += line.qtyDiff;
      totalExtraCents += line.valueDiffCents;
    }
  }

  // Canonical accounting flow approved by Tri.
  const expectedCashCents = input.openingCashCents + input.cashSalesCents + totalShortCents - totalExtraCents;
  const cashAccountedCents = input.safeboxCents + input.closingFloatCents;
  const finalVarianceCents = cashAccountedCents - expectedCashCents;
  const netStockCents = totalExtraCents - totalShortCents;
  const withoutHash = {
    schemaVersion: 1 as const,
    input: {
      storeCode: input.storeCode,
      shiftCode: input.shiftCode,
      staffName: input.staffName,
      openingCashCents: input.openingCashCents,
      cashSalesCents: input.cashSalesCents,
      safeboxCents: input.safeboxCents,
      closingFloatCents: input.closingFloatCents,
    },
    differences,
    totalShortQty,
    totalExtraQty,
    totalShortCents,
    totalExtraCents,
    netStockCents,
    netStockKind: moneyKind(netStockCents),
    expectedCashCents,
    cashAccountedCents,
    finalVarianceCents,
    finalKind: moneyKind(finalVarianceCents),
  };
  return { ...withoutHash, parityHash: sha256(withoutHash) };
}

export function assertCloseParity(stored: CloseResult, recalculated: CloseResult) {
  const { parityHash: storedHash, ...storedPayload } = stored;
  const storedPayloadHash = sha256(storedPayload);
  if (storedHash !== storedPayloadHash || storedHash !== recalculated.parityHash) {
    throw new Error("CLOSE_PARITY_MISMATCH: report delivery blocked.");
  }
}
