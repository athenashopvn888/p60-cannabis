type Row = Record<string, unknown>;

function rows(value: unknown) {
  return Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === "object") : [];
}

function pick(row: Row, keys: string[]) {
  const copy: Row = {};
  for (const key of keys) if (key in row) copy[key] = row[key];
  return copy;
}

function offLines(value: unknown) {
  return rows(value).map((row) => pick(row, ["sku", "text", "off"]));
}

function section(value: unknown) {
  const row = value && typeof value === "object" ? (value as Row) : {};
  return { offCount: Number(row.offCount ?? 0), ready: row.ready !== false, lines: offLines(row.lines) };
}

/** Staff payload. On-hand, expected, and total quantities stay on the server. */
export function blindStaffState<T extends Row>(view: T): T {
  const next: Row = { ...view };
  next.products = rows(view.products)
    .filter((row) => Number(row.qty ?? 0) > 0)
    .map((row) => pick(row, ["sku", "sku_sort", "name", "category", "price_cents", "price_source", "image_url", "flower_type", "thc"]));
  next.opening_lines = rows(view.opening_lines).map((row) => pick(row, ["sku", "name", "price_cents", "counted_qty", "variance_reason"]));
  next.close_lines = rows(view.close_lines).map((row) => pick(row, ["sku", "name", "text", "price_cents", "counted_qty"]));
  next.count_lines = rows(view.count_lines).map((row) => pick(row, ["sku", "name"]));
  next.incoming = rows(view.incoming).map((row) => pick(row, ["kitchen_row_id", "sku", "text", "qty_sent"]));
  const verify = view.verify && typeof view.verify === "object" ? (view.verify as Row) : null;
  if (verify) {
    next.verify = {
      ...pick(verify, ["show_banner", "deadline_at", "cleared", "total", "reveal", "opening_off"]),
      lines: rows(verify.lines).map((row) => pick(row, ["sku", "text", "name", "price_cents", "counted_qty", "locked"])),
      opening_lines: offLines(verify.opening_lines),
    };
  }
  const stock = view.stock_check && typeof view.stock_check === "object" ? (view.stock_check as Row) : null;
  if (stock) {
    const refills = stock.refills && typeof stock.refills === "object" ? (stock.refills as Row) : {};
    next.stock_check = {
      opening: section(stock.opening),
      closing: section(stock.closing),
      refills: {
        count: Number(refills.count ?? 0),
        lines: rows(refills.lines).map((row) => pick(row, ["sku", "text", "sent", "received", "diff"])),
      },
    };
  }
  next.deposits = rows(view.deposits).map((row) => pick(row, ["id", "deposit_code", "amount_cents", "created_at"]));
  delete next.verify_admin;
  return next as T;
}
