import ExcelJS from "exceljs";
import type { CloseInput, CloseResult } from "@/src/domain/close";
import { assertCloseParity, calculateClose } from "@/src/domain/close";

const GREEN = "FF087B3D";
const RED = "FFC62828";
const NAVY = "FF0D172A";
const WHITE = "FFFFFFFF";

export async function buildCloseWorkbook(input: CloseInput, stored: CloseResult): Promise<Buffer> {
  assertCloseParity(stored, calculateClose(input));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PNYS v2";
  const sheet = workbook.addWorksheet("STOCK CLOSING REPORT", { views: [{ state: "frozen", ySplit: 9 }] });
  sheet.columns = [
    { key: "sku", width: 16 }, { key: "name", width: 34 }, { key: "expected", width: 13 },
    { key: "counted", width: 13 }, { key: "qty", width: 13 }, { key: "value", width: 16 }, { key: "result", width: 14 },
  ];
  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = "STOCK CLOSING REPORT";
  sheet.getCell("A1").font = { bold: true, size: 18 };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.addRow([]);
  sheet.addRow(["STORE", input.storeCode, "STAFF", input.staffName, "SHIFT REF", input.shiftCode]);
  sheet.addRow([]);
  sheet.addRow(["OPENING CASH", input.openingCashCents / 100, "CASH SALES", input.cashSalesCents / 100]);
  sheet.addRow(["STOCK SHORT", -stored.totalShortCents / 100, "STOCK EXTRA", stored.totalExtraCents / 100]);
  sheet.addRow(["NET STOCK", stored.netStockCents / 100, "EXPECTED CASH", stored.expectedCashCents / 100]);
  sheet.addRow(["SAFEBOX", input.safeboxCents / 100, "CLOSING FLOAT", input.closingFloatCents / 100]);
  sheet.addRow(["CASH ACCOUNTED", stored.cashAccountedCents / 100, "FINAL", stored.finalVarianceCents / 100, stored.finalKind]);
  sheet.addRow([]);
  const header = sheet.addRow(["SKU", "ITEM", "EXPECTED", "COUNTED", "QTY DIFF", "$ DIFF", "RESULT"]);
  header.eachCell((cell) => { cell.font = { bold: true, color: { argb: WHITE } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; });
  for (const line of stored.differences) {
    const row = sheet.addRow([line.sku, line.name, line.expectedQty, line.countedQty, line.qtyDiff, line.valueDiffCents / 100, line.result]);
    const color = line.valueDiffCents > 0 ? GREEN : RED;
    for (const index of [5, 6, 7]) row.getCell(index).font = { bold: true, color: { argb: color } };
  }
  sheet.addRow([]);
  const totals = [
    ["TOTAL SHORT", null, null, null, -stored.totalShortQty, -stored.totalShortCents / 100, "SHORT", RED],
    ["TOTAL EXTRA", null, null, null, stored.totalExtraQty, stored.totalExtraCents / 100, "OVER", GREEN],
    ["NET STOCK", null, null, null, stored.totalExtraQty - stored.totalShortQty, stored.netStockCents / 100, stored.netStockKind, stored.netStockCents >= 0 ? GREEN : RED],
  ] as const;
  for (const values of totals) {
    const row = sheet.addRow(values.slice(0, 7));
    row.eachCell((cell) => { cell.font = { bold: true, color: { argb: values[7] } }; });
  }
  for (const row of sheet.getRows(5, 5) ?? []) {
    for (const index of [2, 4, 6]) row.getCell(index).numFmt = "$#,##0.00;[Red]-$#,##0.00";
  }
  sheet.getColumn(6).numFmt = "+$#,##0.00;[Red]-$#,##0.00;$0.00";
  sheet.getCell("B6").font = { bold: true, color: { argb: RED } };
  sheet.getCell("D6").font = { bold: true, color: { argb: GREEN } };
  sheet.getCell("B7").font = { bold: true, color: { argb: stored.netStockCents >= 0 ? GREEN : RED } };
  sheet.getCell("D9").font = { bold: true, color: { argb: stored.finalVarianceCents >= 0 ? GREEN : RED }, size: 14 };
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
