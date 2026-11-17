import ExcelJS from "exceljs";
import { STORE_TZ } from "./constants.ts";
import type { ClosingRow } from "./types.ts";

export type StockClosingReportInput = {
  storeCode: string;
  staffName: string;
  closeDate: string;
  shiftRef?: string;
  systemShiftId?: string;
  startingFloatCents?: number | null;
  startingFloatConfirmed?: boolean;
  closing: Pick<ClosingRow,
    | "sales_total_cents"
    | "debit_sales_cents"
    | "deposited_cents"
    | "float_cents"
    | "overage_cents"
    | "balance_cents"
    | "closing_lines"
  >;
};

type SizeGroup = "3g" | "5g" | "14g" | "28g" | "EDIBLE";
type ReportLine = { assigned: number; refill: number; sold: number; onHand: number };

const SIZE_GROUPS: SizeGroup[] = ["3g", "5g", "14g", "28g", "EDIBLE"];
const GROUP_COLORS = [
  { header: "FF376A9B", light: "FFEAF3FB", alt: "FFDDECF8" },
  { header: "FF3F7D58", light: "FFECF7F0", alt: "FFDDF0E4" },
  { header: "FF9A6A18", light: "FFFFF6E4", alt: "FFF9EBC9" },
  { header: "FF9B4F57", light: "FFFBECEF", alt: "FFF5DDE1" },
  { header: "FF694A8A", light: "FFF3ECFA", alt: "FFE8DCF5" },
] as const;

function itemAndSize(sku: string): { item: string; size: SizeGroup } {
  const match = sku.trim().match(/^(\d+)(?:-(3g|5g|6g|14g|28g))?$/i);
  if (!match) return { item: sku.trim(), size: "EDIBLE" };
  const raw = match[2]?.toLowerCase();
  if (raw === "3g") return { item: match[1], size: "3g" };
  // Preserve the accountant's existing 5g column: 200-series items are true
  // 5g, while legacy 300-599 rows in that same column represent 6g.
  if (raw === "5g" || raw === "6g") return { item: match[1], size: "5g" };
  if (raw === "14g") return { item: match[1], size: "14g" };
  if (raw === "28g") return { item: match[1], size: "28g" };
  return { item: match[1], size: "EDIBLE" };
}

function sortItems(a: string, b: string) {
  const an = Number(a);
  const bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
  return a.localeCompare(b, undefined, { numeric: true });
}

function dollars(cents = 0) {
  return Math.round(cents) / 100;
}

function moneyText(cents = 0) {
  return dollars(cents).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function storeDateParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return { year: part("year"), month: part("month"), day: part("day") };
}

function workbookDate(value: string) {
  const { year, month, day } = storeDateParts(value);
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
}

function reportRows(input: StockClosingReportInput) {
  const rows = new Map<string, Record<SizeGroup, ReportLine>>();
  for (const line of input.closing.closing_lines) {
    const { item, size } = itemAndSize(line.sku);
    const grouped = rows.get(item) ?? Object.fromEntries(SIZE_GROUPS.map((group) => [group, { assigned: 0, refill: 0, sold: 0, onHand: 0 }])) as Record<SizeGroup, ReportLine>;
    const target = grouped[size];
    target.assigned += line.opening_qty ?? 0;
    target.refill += line.received_qty ?? 0;
    target.sold += line.sold_qty ?? 0;
    target.onHand += line.left ?? 0;
    rows.set(item, grouped);
  }
  return [...rows].sort(([a], [b]) => sortItems(a, b));
}

function refillValueCents(input: StockClosingReportInput) {
  return input.closing.closing_lines.reduce(
    (sum, line) => sum + (line.received_qty ?? 0) * (line.price_cents ?? 0),
    0,
  );
}

function border(style: ExcelJS.BorderStyle = "thin"): Partial<ExcelJS.Borders> {
  return {
    top: { style, color: { argb: "FF000000" } },
    left: { style, color: { argb: "FF000000" } },
    bottom: { style, color: { argb: "FF000000" } },
    right: { style, color: { argb: "FF000000" } },
  };
}

export async function buildStockClosingReport(input: StockClosingReportInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PNY POS";
  workbook.created = new Date(input.closeDate);
  const sheet = workbook.addWorksheet("STOCK CLOSING REPORT", {
    pageSetup: {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 },
      paperSize: 9,
    },
    views: [{ showGridLines: false, state: "frozen", ySplit: 9, xSplit: 1 }],
  });
  sheet.properties.defaultRowHeight = 15;
  sheet.getColumn(1).width = 10;
  for (let col = 2; col <= 21; col += 1) sheet.getColumn(col).width = 4.1;

  sheet.mergeCells("A1:U1");
  const title = sheet.getCell("A1");
  title.value = "STOCK CLOSING REPORT";
  title.font = { name: "Arial", size: 16, bold: true };
  title.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 24;

  const identity = [
    ["A3:E3", "LOC", "A4:E4", input.storeCode],
    ["F3:J3", "STAFF NAME", "F4:J4", input.staffName],
    ["K3:P3", "CLOSE DATE", "K4:P4", workbookDate(input.closeDate)],
    ["Q3:U3", "SHIFT REF", "Q4:U4", input.shiftRef ?? "UNAVAILABLE"],
  ] as const;
  for (const [headerRange, header, valueRange, value] of identity) {
    sheet.mergeCells(headerRange);
    sheet.mergeCells(valueRange);
    const headerCell = sheet.getCell(headerRange.split(":")[0]);
    headerCell.value = header;
    headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    headerCell.font = { name: "Arial", size: 10, bold: true };
    headerCell.alignment = { horizontal: "center", vertical: "middle" };
    const valueCell = sheet.getCell(valueRange.split(":")[0]);
    valueCell.value = value;
    valueCell.font = { name: "Arial", size: 11, bold: true };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    if (value instanceof Date) valueCell.numFmt = "ddd mm/dd/yyyy";
    sheet.getCell(headerRange.split(":")[0]).border = border();
    sheet.getCell(valueRange.split(":")[0]).border = border();
  }

  const summary = [
    ["TOTAL SALE", dollars(input.closing.sales_total_cents)],
    ["SAFEBOX", dollars(input.closing.deposited_cents)],
    ["DEBIT", dollars(input.closing.debit_sales_cents ?? 0)],
    ["PAYROLL", 0],
    ["CREDIT", dollars(input.closing.overage_cents ?? 0)],
    ["END FLOAT", dollars(input.closing.float_cents ?? 0)],
    ["NET TOTAL", dollars(input.closing.balance_cents ?? 0)],
  ] as const;
  summary.forEach(([label, value], index) => {
    const start = index * 3 + 1;
    const end = start + 2;
    sheet.mergeCells(6, start, 6, end);
    sheet.mergeCells(7, start, 7, end);
    const head = sheet.getCell(6, start);
    head.value = label;
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    head.font = { name: "Arial", size: 8, bold: true };
    head.alignment = { horizontal: "center", vertical: "middle" };
    head.border = border();
    const cell = sheet.getCell(7, start);
    cell.value = value;
    cell.numFmt = "$#,##0.00;[Red]($#,##0.00);-";
    cell.font = { name: "Arial", size: 12, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border();
  });

  const startingFloat = input.startingFloatCents == null ? "UNAVAILABLE" : moneyText(input.startingFloatCents);
  const status = input.startingFloatConfirmed ? "YES" : "NO";
  const topFacts = [
    ["A8:G8", "STARTING FLOAT", startingFloat, "FFEAF3FB"],
    ["H8:N8", "FLOAT CONFIRMED", status, input.startingFloatConfirmed ? "FFDDF0E4" : "FFFFE5CC"],
    ["O8:U8", "REFILL VALUE", moneyText(refillValueCents(input)), "FFF3ECFA"],
  ] as const;
  for (const [range, label, value, fill] of topFacts) {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(":")[0]);
    cell.value = `${label}: ${value}`;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.font = { name: "Arial", size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border();
  }
  sheet.getRow(8).height = 22;

  sheet.mergeCells("A9:U9");
  const legend = sheet.getCell("A9");
  legend.value = "A = Assigned     R = Confirmed refill     S = Sold     OH = Onhand";
  legend.font = { name: "Arial", size: 9, bold: true };
  legend.alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("A10:A11");
  const itemHeader = sheet.getCell("A10");
  itemHeader.value = "ITEM No.";
  itemHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
  itemHeader.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  itemHeader.alignment = { horizontal: "center", vertical: "middle" };
  itemHeader.border = border();

  SIZE_GROUPS.forEach((group, groupIndex) => {
    const colors = GROUP_COLORS[groupIndex];
    const start = 2 + groupIndex * 4;
    const end = start + 3;
    sheet.mergeCells(10, start, 10, end);
    const groupCell = sheet.getCell(10, start);
    groupCell.value = group;
    groupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.header } };
    groupCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    groupCell.alignment = { horizontal: "center", vertical: "middle" };
    groupCell.border = border();
    ["A", "R", "S", "OH"].forEach((label, offset) => {
      const cell = sheet.getCell(11, start + offset);
      cell.value = label;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: offset % 2 === 0 ? colors.light : colors.alt } };
      cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF111827" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = border();
    });
  });

  const rows = reportRows(input);
  rows.forEach(([item, grouped], rowIndex) => {
    const rowNo = 12 + rowIndex;
    const row = sheet.getRow(rowNo);
    row.getCell(1).value = item;
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(1).font = { name: "Arial", size: 10, bold: true };
    row.getCell(1).border = border("thin");
    SIZE_GROUPS.forEach((group, groupIndex) => {
      const start = 2 + groupIndex * 4;
      const colors = GROUP_COLORS[groupIndex];
      const line = grouped[group];
      [line.assigned, line.refill, line.sold, line.onHand].forEach((value, offset) => {
        const cell = row.getCell(start + offset);
        cell.value = value === 0 ? null : value;
        cell.numFmt = "0;-0;-";
        cell.font = { name: "Arial", size: 10, bold: value !== 0 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: offset % 2 === 0 ? colors.light : colors.alt } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = border("thin");
      });
    });
  });

  const stockLastRow = Math.max(12, 11 + rows.length);
  const differences = input.closing.closing_lines
    .map((line) => {
      const qtyDifference = line.variance_qty ?? line.left - (line.expected_qty ?? line.system_qty);
      const valueDifference = (line.overage_cents ?? 0) - (line.shortage_cents ?? 0)
        || qtyDifference * (line.price_cents ?? 0);
      return { line, qtyDifference, valueDifference };
    })
    .filter((row) => row.qtyDifference !== 0)
    .sort((a, b) => sortItems(a.line.sku, b.line.sku));
  const varianceTitleRow = stockLastRow + 2;
  sheet.mergeCells(varianceTitleRow, 1, varianceTitleRow, 21);
  const varianceTitle = sheet.getCell(varianceTitleRow, 1);
  varianceTitle.value = "STOCK COUNT DIFFERENCES";
  varianceTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  varianceTitle.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  varianceTitle.alignment = { horizontal: "center", vertical: "middle" };
  varianceTitle.border = border();

  const varianceHeadRow = varianceTitleRow + 1;
  const varianceColumns = [
    [1, 3, "SKU"],
    [4, 10, "ITEM"],
    [11, 13, "COUNTED"],
    [14, 16, "QTY DIFF"],
    [17, 19, "VALUE DIFF"],
    [20, 21, "RESULT"],
  ] as const;
  for (const [start, end, label] of varianceColumns) {
    sheet.mergeCells(varianceHeadRow, start, varianceHeadRow, end);
    const cell = sheet.getCell(varianceHeadRow, start);
    cell.value = label;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    cell.font = { name: "Arial", size: 9, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border();
  }

  if (differences.length === 0) {
    sheet.mergeCells(varianceHeadRow + 1, 1, varianceHeadRow + 1, 21);
    const matched = sheet.getCell(varianceHeadRow + 1, 1);
    matched.value = "All stock matched.";
    matched.alignment = { horizontal: "center", vertical: "middle" };
    matched.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF166534" } };
    matched.border = border();
  } else {
    differences.forEach(({ line, qtyDifference, valueDifference }, index) => {
      const rowNo = varianceHeadRow + 1 + index;
      const values = [
        [1, 3, line.sku],
        [4, 10, line.name || "Unknown item"],
        [11, 13, line.left],
        [14, 16, qtyDifference],
        [17, 19, dollars(valueDifference)],
        [20, 21, qtyDifference < 0 ? "SHORT" : "OVER"],
      ] as const;
      for (const [start, end, value] of values) {
        sheet.mergeCells(rowNo, start, rowNo, end);
        const cell = sheet.getCell(rowNo, start);
        cell.value = value;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { name: "Arial", size: 10, bold: start >= 14 };
        cell.border = border();
        if (start === 17) cell.numFmt = "+$#,##0.00;[Red]-$#,##0.00;-";
        if (start >= 14) cell.font = { ...cell.font, color: { argb: qtyDifference < 0 ? "FFB91C1C" : "FF15803D" } };
      }
    });
  }

  const lastRow = varianceHeadRow + 1 + Math.max(0, differences.length - 1);
  sheet.pageSetup.printArea = `A1:U${lastRow}`;
  sheet.headerFooter.oddFooter = `&LSystem shift ID: ${input.systemShiftId ?? "UNAVAILABLE"}&CPage &P of &N&R${input.storeCode}`;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function stockClosingReportFileName(input: StockClosingReportInput, version = 1) {
  const parts = storeDateParts(input.closeDate);
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const safeStaff = input.staffName.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "Staff";
  const suffix = version > 1 ? `-v${version}` : "";
  return `${input.storeCode}-Stock-Closing-${day}-${safeStaff}${suffix}.xlsx`;
}
