export interface ItemPriceDisplay {
  display: string;
  isMultiple: boolean;
  values: string[];
}

const MULTI_PRICE_PATTERN = /^\s*\$?\d+(?:\.\d{1,2})?\s*(?:\/\s*\$?\d+(?:\.\d{1,2})?\s*)+$/;

// Current FMD ITEMS_RAW multi-price groups. This also protects customer-facing
// pages while an older live feed still returns only the first option.
const CANONICAL_MULTI_PRICE_BY_SKU: Record<string, string> = {
  "701": "$20 / $25",
  "702": "$20 / $25",
  "704": "$20 / $25",
  "705": "$20 / $25",
  "706": "$20 / $25",
  "707": "$20 / $25",
  "708": "$20 / $25",
  "668": "$20 / $30",
  "669": "$20 / $30",
  "670": "$20 / $30",
  "671": "$20 / $30",
  "856": "$30 / $45",
  "857": "$30 / $45",
  "840": "$40 / $30",
  "841": "$40 / $30",
  "842": "$40 / $30",
  "843": "$40 / $30",
  "844": "$40 / $30",
  "845": "$40 / $30",
  "859": "$40 / $30 / $25",
  "860": "$40 / $30 / $25",
  "861": "$40 / $30 / $25",
  "961": "$20 / $50 / $100",
  "962": "$20 / $50 / $100",
  "963": "$20 / $50 / $100",
  "970": "$15 / $50",
  "971": "$15 / $50",
  "655": "$25 / $35 / $50",
  "656": "$25 / $35 / $50",
  "657": "$25 / $35 / $50",
  "680": "$16 / $35",
  "681": "$16 / $35",
  "682": "$16 / $35",
  "683": "$16 / $35",
  "613": "$40 / $55",
  "614": "$40 / $55",
};

function formatMoney(value: string) {
  const clean = value.trim().replace(/^\$/, "");
  return clean ? "$" + clean : "";
}

export function getItemPriceDisplay(rawPrice: string | null | undefined, sku?: string | null): ItemPriceDisplay {
  const raw = String(rawPrice ?? "").trim();
  const skuPrices = String(sku ?? "")
    .split(",")
    .map((part) => CANONICAL_MULTI_PRICE_BY_SKU[part.trim().replace(/\.0$/, "")])
    .filter(Boolean);
  const canonical = skuPrices.length > 0 && skuPrices.every((price) => price === skuPrices[0])
    ? skuPrices[0]
    : "";
  const resolved = MULTI_PRICE_PATTERN.test(raw) ? raw : canonical || raw;
  if (!resolved) return { display: "", isMultiple: false, values: [] };

  if (MULTI_PRICE_PATTERN.test(resolved)) {
    const values = resolved.split("/").map(formatMoney).filter(Boolean);
    return {
      display: values.join(" / "),
      isMultiple: values.length > 1,
      values,
    };
  }

  return {
    display: resolved.startsWith("$") ? resolved : "$" + resolved,
    isMultiple: false,
    values: [resolved.startsWith("$") ? resolved : "$" + resolved],
  };
}
