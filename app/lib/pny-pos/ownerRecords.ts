import { formatMoney, formatStoreTime } from "./money.ts";

export type OwnerOffLine = { sku: string; text: string; off: number };

/** Money layout for the owner records page. STOCK GONE is cash sales. */
export function ownerMoneyLayout(input: {
  cash_sales_cents: number;
  deposited_cents: number;
  cash_on_hand_cents: number;
  balance_cents: number;
  deposits: { id: string; deposit_code: string | null; amount_cents: number; created_at: string }[];
}) {
  const balance = input.balance_cents;
  const word = balance > 0 ? "SHORT" : balance < 0 ? "OVER" : "EVEN";
  return {
    stock_gone_cents: input.cash_sales_cents,
    deposits_total_cents: input.deposited_cents,
    deposits: input.deposits,
    coh_cents: input.cash_on_hand_cents,
    final_balance_cents: balance,
    final_balance_word: word as "OVER" | "SHORT" | "EVEN",
    final_balance_label:
      word === "EVEN"
        ? "EVEN $0.00"
        : word === "OVER"
          ? `OVER +${formatMoney(Math.abs(balance))}`
          : `SHORT -${formatMoney(Math.abs(balance))}`,
  };
}

export function ownerShiftTimes(startedAt: string, endedAt: string | null) {
  return {
    open_toronto: formatStoreTime(startedAt),
    close_toronto: endedAt ? formatStoreTime(endedAt) : null,
    date_toronto: new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(startedAt)),
  };
}
