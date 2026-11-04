import { STORE_CODE, STORE_TZ } from "./constants.ts";
import { bagLabel, strainName } from "./flowerSku.ts";
import { formatMoney, formatStoreTime } from "./money.ts";

export type SummaryLine = { sku: string; name: string; qty: number; line_total_cents: number };
export type SummarySale = { at: string; payment: string; total_cents: number; lines: SummaryLine[] };
export type SummaryDeposit = { at: string; amount_cents: number };

export function storeDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function itemLabel(sku: string, name: string) {
  const size = bagLabel(sku);
  if (!size) return name;
  return `${strainName(name)} ${size}`;
}

/** Plain text for the group chat. Sale quantities only. No stock and no variance. */
export function summaryPlainText(input: { staff: string; when: string; sales: SummarySale[]; deposits: SummaryDeposit[] }) {
  const cash = input.sales.filter((sale) => sale.payment === "CASH").reduce((sum, sale) => sum + sale.total_cents, 0);
  const debit = input.sales.filter((sale) => sale.payment === "DEBIT").reduce((sum, sale) => sum + sale.total_cents, 0);
  const other = input.sales.filter((sale) => sale.payment !== "CASH" && sale.payment !== "DEBIT").reduce((sum, sale) => sum + sale.total_cents, 0);
  const deposited = input.deposits.reduce((sum, deposit) => sum + deposit.amount_cents, 0);
  const lines = [
    STORE_CODE,
    storeDate(input.when),
    input.staff,
    `Sales: ${input.sales.length}`,
    `Cash: ${formatMoney(cash)}`,
    `Debit: ${formatMoney(debit)}`,
  ];
  if (other > 0) lines.push(`Other: ${formatMoney(other)}`);
  lines.push(`Deposits: ${formatMoney(deposited)}`, `Grand total: ${formatMoney(cash + debit + other)}`, "");
  input.sales.forEach((sale, index) => {
    lines.push(`${index + 1}. ${formatStoreTime(sale.at)} ${sale.payment} ${formatMoney(sale.total_cents)}`);
    for (const line of sale.lines) lines.push(`   ${line.qty} × ${itemLabel(line.sku, line.name)} ${formatMoney(line.line_total_cents)}`);
  });
  if (input.deposits.length > 0) {
    lines.push("");
    for (const deposit of input.deposits) lines.push(`Deposit ${formatStoreTime(deposit.at)} ${formatMoney(deposit.amount_cents)}`);
  }
  return lines.join("\n");
}
