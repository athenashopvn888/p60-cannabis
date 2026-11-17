export type OcrWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type CatalogProduct = { sku: string; name: string; size: string };
export type RefillSheetDraftLine = {
  id: string;
  sku: string;
  qty: number;
  confidence: number;
  source: string;
  needsReview?: boolean;
};

function clean(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizedHeader(value: string) {
  const token = clean(value).replace(/o/g, "0");
  if (token === "3g" || token === "39") return "3g";
  if (token === "5g" || token === "59" || token === "60" || token === "69") return "5g";
  if (token === "14g" || token === "149") return "14g";
  if (token === "28g" || token === "289") return "28g";
  if (token === "qty" || token === "aty" || token === "oty") return "qty";
  return null;
}

function normalizedNumber(value: string, minDigits = 1) {
  const token = clean(value).replace(/[o]/g, "0").replace(/[il]/g, "1").replace(/[cs]/g, (match) => match === "s" ? "5" : "0");
  return new RegExp(`^\\d{${minDigits},4}$`).test(token) ? token : null;
}

function center(word: OcrWord) {
  return { x: (word.bbox.x0 + word.bbox.x1) / 2, y: (word.bbox.y0 + word.bbox.y1) / 2 };
}

function headerAnchors(word: OcrWord) {
  const label = normalizedHeader(word.text);
  if (label) return [{ label, ...center(word) }];
  const token = clean(word.text).replace(/[og]/g, "0");
  if (/^14.{1,4}(?:28|20|29|00)/.test(token)) {
    const width = word.bbox.x1 - word.bbox.x0;
    const y = center(word).y;
    return [
      { label: "14g", x: word.bbox.x0 + width * 0.28, y },
      { label: "28g", x: word.bbox.x0 + width * 0.72, y },
    ];
  }
  return [];
}

function resolveProductBase(value: string, productBases: Set<string>) {
  const token = clean(value).replace(/[o]/g, "0").replace(/[il]/g, "1").replace(/[cs]/g, (match) => match === "s" ? "5" : "0");
  const exact = [...productBases].filter((base) => token === base || (base.length === 4 && token.startsWith(base)));
  if (exact.length === 1) return exact[0];
  if (!/^\d{3,4}$/.test(token)) return null;
  const fuzzy = [...productBases].filter((base) => base.length === token.length
    && base[0] === token[0]
    && [...base].filter((digit, index) => digit !== token[index]).length === 1);
  return fuzzy.length === 1 ? fuzzy[0] : null;
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
  const usable = words.filter((word) => word.text.trim());
  const headerCandidates = usable.flatMap(headerAnchors);
  const headerRows = headerCandidates.map((anchor) => headerCandidates.filter((candidate) => Math.abs(candidate.y - anchor.y) <= 35));
  const selectedHeaderRow = headerRows.sort((left, right) => new Set(right.map((item) => item.label)).size - new Set(left.map((item) => item.label)).size)[0] ?? [];
  const headers = [...new Map(selectedHeaderRow.sort((left, right) => left.x - right.x).map((header) => [header.label, header])).values()];
  if (headers.length < 3) return [];
  const firstColumnX = Math.min(...headers.map((header) => header.x));
  const headerY = Math.max(...headers.map((header) => header.y));
  const productBases = new Set(products.map((product) => product.sku.match(/^\d+/)?.[0]).filter((base): base is string => Boolean(base)));
  const rowSkus = usable.filter((word) => {
    const base = resolveProductBase(word.text, productBases);
    return Boolean(base && center(word).x < firstColumnX - 6 && center(word).y > headerY + 12);
  }).sort((left, right) => center(left).y - center(right).y);
  const distinctRows = rowSkus.filter((word, index) => {
    const base = resolveProductBase(word.text, productBases);
    return !rowSkus.slice(0, index).some((candidate) => resolveProductBase(candidate.text, productBases) === base && Math.abs(center(candidate).y - center(word).y) < 28);
  });
  const results: RefillSheetDraftLine[] = [];
  const sortedHeaderX = headers.map((header) => header.x).sort((a, b) => a - b);
  const gaps = sortedHeaderX.slice(1).map((value, index) => value - sortedHeaderX[index]);
  const tolerance = Math.max(35, Math.min(80, (gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 90) * 0.46));

  for (const [rowIndex, skuWord] of distinctRows.entries()) {
    const base = resolveProductBase(skuWord.text, productBases)!;
    const skuCenter = center(skuWord);
    const previousY = rowIndex > 0 ? center(distinctRows[rowIndex - 1]).y : skuCenter.y - Math.max(28, (skuWord.bbox.y1 - skuWord.bbox.y0) * 2.2);
    const nextY = rowIndex < distinctRows.length - 1 ? center(distinctRows[rowIndex + 1]).y : skuCenter.y + Math.max(28, (skuWord.bbox.y1 - skuWord.bbox.y0) * 2.2);
    const rowTop = (previousY + skuCenter.y) / 2;
    const rowBottom = (skuCenter.y + nextY) / 2;
    const numeric = usable.filter((word) => {
      const token = normalizedNumber(word.text);
      const point = center(word);
      const perspectiveY = point.y - Math.max(0, point.x - skuCenter.x) * 0.04;
      // The receipt can be slightly rotated or photographed at an angle. Keep
      // a small vertical gutter so a value close to the row rule is not
      // silently assigned to the next row or discarded.
      return word !== skuWord && Boolean(token && token.length <= 3) && point.x > firstColumnX - 18
        && perspectiveY >= rowTop - 6 && perspectiveY < rowBottom + 6;
    });
    let matched = false;
    for (const candidate of numeric) {
      const point = center(candidate);
      const nearest = headers.map((header) => ({ ...header, distance: Math.abs(header.x - point.x) })).sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > tolerance) continue;
      const size = nearest.label === "qty" ? "each" : nearest.label;
      const product = productFor(products, base, size);
      const qty = Number(normalizedNumber(candidate.text));
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 999) continue;
      matched = true;
      const confidence = Math.round(Math.min(skuWord.confidence, candidate.confidence));
      results.push({
        id: `${base}-${nearest.label}-${results.length}`,
        sku: product.sku,
        qty,
        confidence,
        source: `${base} · ${nearest.label}`,
        needsReview: confidence < 85,
      });
    }
    if (!matched) {
      results.push({
        id: `${base}-unread-${results.length}`,
        sku: base,
        qty: 0,
        confidence: 0,
        source: `${base} · CHECK size and quantity`,
        needsReview: true,
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
