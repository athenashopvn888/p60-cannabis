type Row = Record<string, unknown>;

function rows(value: unknown) {
  return Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === "object") : [];
}

function pick(row: Row, keys: string[]) {
  const copy: Row = {};
  for (const key of keys) if (key in row) copy[key] = row[key];
  return copy;
}

/** Staff payload. Stock counts and expected quantities stay on the server. */
export function blindStaffState<T extends Row>(view: T): T {
  const next: Row = { ...view };
  next.products = rows(view.products)
    .filter((row) => Number(row.qty ?? 0) > 0)
    .map((row) => pick(row, ["sku", "sku_sort", "name", "category", "price_cents", "price_source", "image_url"]));
  next.opening_lines = rows(view.opening_lines).map((row) => pick(row, ["sku", "name", "price_cents", "counted_qty", "variance_reason"]));
  next.close_lines = rows(view.close_lines).map((row) => pick(row, ["sku", "name", "price_cents", "counted_qty"]));
  next.count_lines = rows(view.count_lines).map((row) => pick(row, ["sku", "name"]));
  next.incoming = rows(view.incoming).map((row) => pick(row, ["kitchen_row_id", "sku", "name", "kind"]));
  return next as T;
}
