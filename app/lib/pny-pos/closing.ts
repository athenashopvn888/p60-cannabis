/** Closing math. Prices are the shelf selling price. Nothing is added for tax. */

export type VarianceLine = {
  variance_qty: number;
  shortage_qty: number;
  overage_qty: number;
  shortage_cents: number;
  overage_cents: number;
};

export function lineVariance(input: { expected_qty: number; counted_qty: number; price_cents: number }): VarianceLine {
  const variance_qty = input.counted_qty - input.expected_qty;
  const shortage_qty = Math.max(0, -variance_qty);
  const overage_qty = Math.max(0, variance_qty);
  return {
    variance_qty,
    shortage_qty,
    overage_qty,
    shortage_cents: shortage_qty * input.price_cents,
    overage_cents: overage_qty * input.price_cents,
  };
}

/** Positive means the drawer is short. Negative means cash is over. */
export function closingBalance(input: { cash_sales_cents: number; shortage_cents: number; overage_cents: number; deposited_cents: number }) {
  return input.cash_sales_cents + input.shortage_cents - input.overage_cents - input.deposited_cents;
}
