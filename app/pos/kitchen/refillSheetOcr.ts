export type OcrWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type CatalogProduct = { sku: string; name: string; size: string };
export type RefillSheetDraftLine = { id: string; sku: string; qty: number; confidence: number; source: string };

function clean(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizedHeader(value: string) {
  const token = clean(value).replace(/o/g, "0");
  if (token === "3g" || token === "39") return "3g";
  if (token === "5g" || token === "59") return "5g";
  if (token === "14g" || token === "149") return "14g";
  if (token === "28g" || token === "289") return "28g";
  if (token === "qty" || token === "aty" || token === "oty") return "qty";
  return null;
}

function normalizedNumber(value: string, minDigits = 1) {
  const token = clean(value).replace(/[o]/g, "0").replace(/[il]/g, "1").replace(/c/g, "0");
  return new RegExp(`^\\d{${minDigits},4}$`).test(token) ? token : null;
}

function center(word: OcrWord) {
  return { x: (word.bbox.x0 + word.bbox.x1) / 2, y: (word.bbox.y0 + word.bbox.y1) / 2 };
}

function productFor(products: CatalogProduct[], base: string, size: string) {
  const exactSku = size === "each" ? base : `${base}-${size}`;
  const tierSize = size === "5g" && Number(base) >= 300 && Number(base) <= 599 ? "6g" : size;
  const tierSku = tierSize === "each" ? base : `${base}-${tierSize}`;
  return products.find((product) => product.sku.toLowerCase() === exactSku.toLowerCase())
    ?? products.find((product) => product.sku.toLowerCase() === tierSku.toLowerCase())
    ?? products.find((product) => product.sku.match(/^\d+/)?.[0] === base && [clean(size), clean(tierSize)].includes(clean(product.size)));
}

/**
 * Parses the printed refill-sheet grid. OCR only creates a draft; callers must
 * always show the detected rows for human review before creating a refill.
 */
export function parseRefillSheetWords(words: OcrWord[], products: CatalogProduct[]): RefillSheetDraftLine[] {
  const usable = words.filter((word) => word.text.trim() && word.confidence >= 20);
  const headerCandidates = usable.flatMap((word) => {
    const label = normalizedHeader(word.text);
    return label ? [{ label, ...center(word) }] : [];
  });
  const headerRows = headerCandidates.map((anchor) => headerCandidates.filter((candidate) => Math.abs(candidate.y - anchor.y) <= 35));
  const selectedHeaderRow = headerRows.sort((left, right) => new Set(right.map((item) => item.label)).size - new Set(left.map((item) => item.label)).size)[0] ?? [];
  const headers = [...new Map(selectedHeaderRow.sort((left, right) => left.x - right.x).map((header) => [header.label, header])).values()];
  if (headers.length < 3) return [];
  const firstColumnX = Math.min(...headers.map((header) => header.x));
  const productBases = new Set(products.map((product) => product.sku.match(/^\d+/)?.[0]).filter(Boolean));
  const rowSkus = usable.filter((word) => {
    const base = normalizedNumber(word.text, 3);
    return Boolean(base && productBases.has(base) && center(word).x < firstColumnX - 6);
  });
  const results: RefillSheetDraftLine[] = [];
  const sortedHeaderX = headers.map((header) => header.x).sort((a, b) => a - b);
  const gaps = sortedHeaderX.slice(1).map((value, index) => value - sortedHeaderX[index]);
  const tolerance = Math.max(35, Math.min(80, (gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 90) * 0.46));

  for (const skuWord of rowSkus) {
    const base = normalizedNumber(skuWord.text, 3)!;
    const skuCenter = center(skuWord);
    const rowHeight = Math.max(18, (skuWord.bbox.y1 - skuWord.bbox.y0) * 1.7);
    const numeric = usable.filter((word) => {
      const token = normalizedNumber(word.text);
      const point = center(word);
      return word !== skuWord && Boolean(token && token.length <= 3) && point.x > firstColumnX - 18 && Math.abs(point.y - skuCenter.y) <= rowHeight;
    });
    for (const candidate of numeric) {
      const point = center(candidate);
      const nearest = headers.map((header) => ({ ...header, distance: Math.abs(header.x - point.x) })).sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > tolerance) continue;
      const size = nearest.label === "qty" ? "each" : nearest.label;
      const product = productFor(products, base, size);
      const qty = Number(normalizedNumber(candidate.text));
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 999) continue;
      results.push({
        id: `${base}-${nearest.label}-${results.length}`,
        sku: product.sku,
        qty,
        confidence: Math.round(Math.min(skuWord.confidence, candidate.confidence)),
        source: `${base} · ${nearest.label}`,
      });
    }
  }

  const merged = new Map<string, RefillSheetDraftLine>();
  for (const line of results) {
    const existing = merged.get(line.sku);
    if (!existing || line.confidence > existing.confidence) merged.set(line.sku, line);
  }
  return [...merged.values()].sort((a, b) => a.sku.localeCompare(b.sku, "en", { numeric: true }));
}
