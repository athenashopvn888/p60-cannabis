import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildStockClosingReport, stockClosingReportFileName } from "../app/lib/pny-pos/stockClosingReport.ts";
import { closingBalance, lineVariance } from "../app/lib/pny-pos/closing.ts";
import type { ClosingLine } from "../app/lib/pny-pos/types.ts";

type HistoryRow = {
  store_code: string;
  shift_id: string;
  internal_shift_id: string;
  staff_name: string;
  started_at: string;
  ended_at: string;
  closing: {
    sales_total_cents: number;
    cash_sales_cents: number;
    debit_sales_cents: number;
    deposited_cents: number;
    float_cents: number;
    shortage_cents: number;
    overage_cents: number;
    balance_cents: number;
    closing_lines: ClosingLine[];
  };
};

type Correction = {
  shiftId: string;
  sku: string;
  field: "left" | "opening_qty";
  from: number;
  to: number;
  reason: string;
};

const ROOT = process.cwd();
const sourcePath = path.join(ROOT, "reports", "pny01-closing-backfill", "closing-history.json");
const outputDir = path.join(ROOT, "reports", "pny01-closing-backfill", "xlsx");

// These are paired, evidence-backed transposition repairs. The first shift typed
// the SKU into the quantity field; the following shift inherited that quantity.
const corrections: Correction[] = [
  {
    shiftId: "sccx-PNY01-138-1794144017985",
    sku: "511-5g",
    field: "left",
    from: 517,
    to: 1,
    reason: "SKU 511 was entered as quantity 517; expected and prior quantity were 1.",
  },
  {
    shiftId: "sccx-PNY01-73-1794188650356",
    sku: "511-5g",
    field: "opening_qty",
    from: 517,
    to: 1,
    reason: "Removed the inherited 517 opening quantity from the preceding typo.",
  },
  {
    shiftId: "sccx-PNY01-138-1794318593380",
    sku: "588",
    field: "left",
    from: 588,
    to: 4,
    reason: "SKU 588 was entered as quantity 588; expected and prior quantity were 4.",
  },
  {
    shiftId: "sccx-PNY01-73-1794363762972",
    sku: "588",
    field: "opening_qty",
    from: 588,
    to: 4,
    reason: "Removed the inherited 588 opening quantity from the preceding typo.",
  },
];

const reviewShiftIds = new Set([
  // This close contains many zero counts rather than one provable transcription
  // error. Preserve the recorded values and flag it for accountant review.
  "sccx-PNY01-138-1794579705249",
]);

function localDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function recalculateLine(line: ClosingLine) {
  const expected = (line.opening_qty ?? 0) + (line.received_qty ?? 0) - (line.sold_qty ?? 0);
  line.expected_qty = expected;
  line.system_qty = expected;
  const variance = lineVariance({ expected_qty: expected, counted_qty: line.left ?? 0, price_cents: line.price_cents ?? 0 });
  line.variance_qty = variance.variance_qty;
  line.shortage_cents = variance.shortage_cents;
  line.overage_cents = variance.overage_cents;
}

function recalculateClosing(row: HistoryRow) {
  for (const line of row.closing.closing_lines) recalculateLine(line);
  row.closing.shortage_cents = row.closing.closing_lines.reduce((sum, line) => sum + (line.shortage_cents ?? 0), 0);
  row.closing.overage_cents = row.closing.closing_lines.reduce((sum, line) => sum + (line.overage_cents ?? 0), 0);
  row.closing.balance_cents = closingBalance({
    cash_sales_cents: row.closing.cash_sales_cents,
    shortage_cents: row.closing.shortage_cents,
    overage_cents: row.closing.overage_cents,
    deposited_cents: row.closing.deposited_cents,
  });
}

function applyCorrection(rows: HistoryRow[], correction: Correction) {
  const row = rows.find((candidate) => candidate.shift_id === correction.shiftId);
  if (!row) throw new Error(`Missing shift ${correction.shiftId}`);
  const line = row.closing.closing_lines.find((candidate) => candidate.sku === correction.sku);
  if (!line) throw new Error(`Missing ${correction.sku} in ${correction.shiftId}`);
  if ((line[correction.field] ?? 0) !== correction.from) {
    throw new Error(`${correction.shiftId} ${correction.sku} ${correction.field} expected ${correction.from}, found ${line[correction.field]}`);
  }
  line[correction.field] = correction.to;
  recalculateClosing(row);
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function main() {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { closings: HistoryRow[] };
  const rows = structuredClone(source.closings).sort(
    (left, right) => new Date(left.ended_at).getTime() - new Date(right.ended_at).getTime(),
  );
  for (const correction of corrections) applyCorrection(rows, correction);
  await mkdir(outputDir, { recursive: true });
  for (const name of await readdir(outputDir)) {
    if (/^PNY01-Stock-Closing-.*\.xlsx$/i.test(name)) await unlink(path.join(outputDir, name));
  }

  const auditRows: string[] = [
    "# PNY01 accountant closing workbook backfill",
    "",
    `Source: read-only closing history (${rows.length} shifts).`,
    "No live database rows were changed.",
    "",
    "| Toronto close date | Staff | Shift | Status | Short | Over | Final till | File |",
    "|---|---|---|---|---:|---:|---:|---|",
  ];
  const emailManifest: Array<{ to: string; cc: string; subject: string; body: string; attachment: string }> = [];
  const fileNameCounts = new Map<string, number>();

  for (const [rowIndex, row] of rows.entries()) {
    const corrected = corrections.some((correction) => correction.shiftId === row.shift_id);
    const review = reviewShiftIds.has(row.shift_id);
    const version = corrected ? 2 : 1;
    const shiftRef = `S${String(rowIndex + 1).padStart(5, "0")}`;
    const startingFloatCents = rowIndex === 0 ? null : rows[rowIndex - 1].closing.float_cents;
    const reportInput = {
      storeCode: row.store_code,
      staffName: row.staff_name,
      closeDate: row.ended_at,
      shiftRef,
      systemShiftId: row.shift_id,
      startingFloatCents,
      // Historical closes predate explicit opening-float confirmation tracking.
      startingFloatConfirmed: false,
      closing: row.closing,
    };
    const baseName = stockClosingReportFileName(reportInput, version);
    const candidateName = review ? baseName.replace(/\.xlsx$/i, "-REVIEW.xlsx") : baseName;
    const duplicateNumber = (fileNameCounts.get(candidateName) ?? 0) + 1;
    fileNameCounts.set(candidateName, duplicateNumber);
    const fileName = duplicateNumber === 1 ? candidateName : candidateName.replace(/\.xlsx$/i, `-${duplicateNumber}.xlsx`);
    const workbook = await buildStockClosingReport(reportInput);
    const attachment = path.join(outputDir, fileName);
    await writeFile(attachment, workbook);
    const status = review ? "REVIEW - recorded values preserved" : corrected ? "CORRECTED v2" : "RECORDED v1";
    auditRows.push(`| ${localDate(row.ended_at)} | ${row.staff_name} | ${row.shift_id} | ${status} | ${money(row.closing.shortage_cents)} | ${money(row.closing.overage_cents)} | ${money(row.closing.balance_cents)} | ${fileName} |`);

    const sold = row.closing.closing_lines.filter((line) => (line.sold_qty ?? 0) > 0);
    const onHand = row.closing.closing_lines.filter((line) => (line.left ?? 0) > 0);
    const refillUnits = row.closing.closing_lines.reduce((sum, line) => sum + (line.received_qty ?? 0), 0);
    const refillValueCents = row.closing.closing_lines.reduce(
      (sum, line) => sum + (line.received_qty ?? 0) * (line.price_cents ?? 0),
      0,
    );
    const body = [
      `PNY01 STOCK CLOSING REPORT - CORRECTED BACKFILL${corrected ? " v2" : review ? " - REVIEW" : ""}`,
      `Date: ${localDate(row.ended_at)} Toronto`,
      `Staff: ${row.staff_name}`,
      `Shift ref: ${shiftRef}`,
      `System shift ID: ${row.shift_id}`,
      `Starting float: ${startingFloatCents == null ? "UNAVAILABLE" : money(startingFloatCents)}`,
      "Starting float status: NOT CONFIRMED (historical record)",
      `Sales: ${money(row.closing.sales_total_cents)}`,
      `Debit: ${money(row.closing.debit_sales_cents)}`,
      `Safebox: ${money(row.closing.deposited_cents)}`,
      `End float: ${money(row.closing.float_cents)}`,
      `Stock short: ${money(row.closing.shortage_cents)}`,
      `Stock extra: ${money(row.closing.overage_cents)}`,
      `Final till balance: ${money(row.closing.balance_cents)}`,
      `Refill units: ${refillUnits}`,
      `Refill value: ${money(refillValueCents)}`,
      "Backfill note: starting float is the prior completed shift's closing float; historical confirmation was not recorded.",
      ...(review ? ["Review note: recorded count is preserved because multiple quantities need accountant review."] : []),
      "",
      `SOLD (${sold.length} SKUs)`,
      ...sold.map((line) => `${line.sku} | ${line.name ?? line.sku} | ${line.sold_qty}`),
      "",
      `ON HAND (${onHand.length} SKUs)` ,
      ...onHand.map((line) => `${line.sku} | ${line.name ?? line.sku} | ${line.left}`),
    ].join("\n");
    emailManifest.push({
      to: "doli.doli.080496@gmail.com",
      cc: "athenashopvn888@gmail.com",
      subject: `CORRECTED BACKFILL - PNY01 STOCK CLOSING ${localDate(row.ended_at)} - ${row.staff_name} - ${shiftRef}`,
      body,
      attachment,
    });
  }

  auditRows.push("", "## Evidence-backed corrections", "");
  for (const correction of corrections) {
    auditRows.push(`- ${correction.shiftId} / ${correction.sku}: ${correction.field} ${correction.from} -> ${correction.to}. ${correction.reason}`);
  }
  auditRows.push(
    "",
    "## Held for review",
    "",
    "- sccx-PNY01-138-1794579705249 (Randy, Toronto close Nov 13): many quantities were recorded as zero. The workbook preserves the recorded values and is marked REVIEW; no replacement quantities were invented.",
    "",
  );
  await writeFile(path.join(outputDir, "AUDIT.md"), auditRows.join("\n"), "utf8");
  await writeFile(path.join(outputDir, "corrections.json"), JSON.stringify({ corrections, review_shift_ids: [...reviewShiftIds] }, null, 2) + "\n", "utf8");
  await writeFile(path.join(outputDir, "email-manifest.json"), JSON.stringify(emailManifest, null, 2) + "\n", "utf8");
  console.log(`Built ${rows.length} workbooks in ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
