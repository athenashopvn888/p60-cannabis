const TV_TIME_ZONE = "America/Toronto";

function toDate(value: string | number | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = value.trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 12-hour America/Toronto clock, e.g. "09:45 am". */
export function formatBoardTime(value: string | number | Date): string | null {
  const date = toDate(value);
  if (!date) return null;

  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: TV_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return formatted.replace(/\s*([AP]M)$/i, (_, half: string) => ` ${half.toLowerCase()}`);
}

function readPayloadStockTime(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const raw = record.stockDate ?? record.asOf;
  if (typeof raw === "string" || typeof raw === "number") return formatBoardTime(raw);
  return null;
}

/**
 * Stock clock from /api/tv-data. Prefer `x-tv-data-as-of`, then a payload
 * `stockDate` or `asOf`. Never falls back to the client fetch time.
 */
export function readStockUpdatedAt(response: Response, payload: unknown): string | null {
  const header = response.headers.get("x-tv-data-as-of");
  if (header && header.trim()) {
    const fromHeader = formatBoardTime(header);
    if (fromHeader) return fromHeader;
  }
  return readPayloadStockTime(payload);
}
