export interface ItemPriceDisplay {
  display: string;
  isMultiple: boolean;
  values: string[];
}

const MULTI_PRICE_PATTERN = /^\s*\$?\d+(?:\.\d{1,2})?\s*(?:\/\s*\$?\d+(?:\.\d{1,2})?\s*)+$/;

function formatMoney(value: string) {
  const clean = value.trim().replace(/^\$/, "");
  return clean ? "$" + clean : "";
}

export function getItemPriceDisplay(rawPrice: string | null | undefined): ItemPriceDisplay {
  const raw = String(rawPrice ?? "").trim();
  if (!raw) return { display: "", isMultiple: false, values: [] };

  if (MULTI_PRICE_PATTERN.test(raw)) {
    const values = raw.split("/").map(formatMoney).filter(Boolean);
    return {
      display: values.join(" / "),
      isMultiple: values.length > 1,
      values,
    };
  }

  return {
    display: raw.startsWith("$") ? raw : "$" + raw,
    isMultiple: false,
    values: [raw.startsWith("$") ? raw : "$" + raw],
  };
}
