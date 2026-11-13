export type ScanCatalogItem = { sku: string; thc_hidden?: boolean };

export type LabelMatch =
  | { ok: true; raw: string; sku: string; thcHidden: boolean }
  | { ok: false; raw: string; reason: "NOT_FOUND" };

const SIZE_SUFFIX: Record<string, string> = {
  "3": "3g",
  "5": "5g",
  "6": "5g",
  "14": "14g",
  "28": "28g",
};

/**
 * Product labels begin with the till's numeric label number. A later number may
 * be a batch (for example 461-B101), so matching always uses the first number.
 */
export function skuFromLabelText(raw: string) {
  const normalized = raw.trim();
  const labelNumber = normalized.match(/(?:^|\D)(\d{2,4})(?=\D|$)/)?.[1];
  if (!labelNumber) return null;
  const size = normalized.match(/(?:^|[^a-z0-9])(3|5|6|14|28)\s*g(?:\b|$)/i)?.[1];
  return size ? `${labelNumber}-${SIZE_SUFFIX[size]}` : labelNumber;
}

export function matchScannedLabel(raw: string, catalog: ScanCatalogItem[]): LabelMatch {
  const direct = raw.trim().toLowerCase();
  const inferred = skuFromLabelText(raw)?.toLowerCase() ?? "";
  const row = catalog.find((item) => item.sku.toLowerCase() === direct)
    ?? catalog.find((item) => item.sku.toLowerCase() === inferred);
  if (!row) return { ok: false, raw, reason: "NOT_FOUND" };
  return { ok: true, raw, sku: row.sku, thcHidden: row.thc_hidden === true };
}
