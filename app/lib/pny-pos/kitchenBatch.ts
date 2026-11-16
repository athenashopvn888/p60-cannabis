import { bagLabel, parseFlowerSku } from "./flowerSku.ts";
import type { AuditRow } from "./types.ts";

export const KITCHEN_DEDUPE_MS = 10 * 60 * 1000;

export type ParsedRefill = { sku: string; size: string; qty: number; raw: string };

const SIZE_WORD = /^(3g|5g|6g|14g|28g|pack|each)$/i;

export function kitchenSignature(kind: string, lines: { sku: string; qty: number }[]) {
  return `${kind}|${lines.map((line) => `${line.sku}:${line.qty}`).sort().join("|")}`;
}

export function normalizeKitchenSku(sku: string, size?: string) {
  const raw = sku.trim().replace(/^#/, "");
  const wanted = (size ?? "").trim().toLowerCase();
  const sized = parseFlowerSku(raw);
  if (!raw) return { ok: false as const, error: "Enter a SKU." };
  if (sized) {
    const label = bagLabel(raw);
    if (wanted && wanted !== "each" && wanted !== "pack" && wanted !== label && wanted !== sized.size) {
      return { ok: false as const, error: `${raw} is ${label || sized.size}, not ${wanted}.` };
    }
    return { ok: true as const, sku: raw, size: label || sized.size };
  }
  if (wanted === "3g" || wanted === "5g" || wanted === "14g" || wanted === "28g" || wanted === "6g") {
    const flowerSize = wanted === "6g" ? "5g" : wanted;
    const sku = `${raw}-${flowerSize}`;
    return { ok: true as const, sku, size: bagLabel(sku) || flowerSize };
  }
  return { ok: true as const, sku: raw, size: wanted === "pack" ? "pack" : wanted === "each" ? "each" : "" };
}

/** Paste or CSV. Accepts `sku,size,qty`, `sku,qty`, or `sku size qty`. */
export function parseKitchenRefill(text: string): { lines: ParsedRefill[]; errors: string[] } {
  const lines: ParsedRefill[] = [];
  const errors: string[] = [];
  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  for (const row of rows) {
    if (/^sku\b/i.test(row)) continue;
    const cells = row.split(/[,;\t]/).map((cell) => cell.trim()).filter(Boolean);
    const parts = cells.length > 1 ? cells : row.split(/\s+/);
    if (parts.length < 2) {
      errors.push(`Could not read "${row}". Use SKU, size, qty.`);
      continue;
    }
    const qtyText = parts[parts.length - 1] ?? "";
    const qty = Number(qtyText);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      errors.push(`"${row}" needs a whole quantity from 1 to 999.`);
      continue;
    }
    const head = parts.slice(0, -1);
    const size = head.length > 1 && SIZE_WORD.test(head[head.length - 1] ?? "") ? head.pop() ?? "" : "";
    const sku = head.join(" ").trim();
    const normalized = normalizeKitchenSku(sku, size);
    if (!normalized.ok) {
      errors.push(normalized.error);
      continue;
    }
    lines.push({ sku: normalized.sku, size: normalized.size, qty, raw: row });
  }
  return { lines, errors };
}

export function kitchenBatchUndone(audits: AuditRow[], batchId: string) {
  return audits.some((row) => row.action === "KITCHEN_UNDO" && row.ref_id === batchId);
}

export function findKitchenDuplicate(audits: AuditRow[], batchId: string, signature: string, nowMs: number) {
  for (const row of audits) {
    if (row.action !== "KITCHEN_REFILL" && row.action !== "KITCHEN_ADJUST") continue;
    if (kitchenBatchUndone(audits, row.ref_id ?? "")) continue;
    if (row.ref_id === batchId) return "batch" as const;
    const saved = typeof row.detail.signature === "string" ? row.detail.signature : "";
    if (saved && saved === signature && nowMs - Date.parse(row.created_at) < KITCHEN_DEDUPE_MS) return "window" as const;
  }
  return null;
}

/** A jump such as +517 when one unit is on the shelf has to be confirmed. */
export function needsLargeConfirm(onHand: number, delta: number) {
  if (Math.abs(delta) >= 50) return true;
  return onHand <= 10 && Math.abs(delta) >= 20;
}

export const KITCHEN_REASONS = ["damaged", "recount", "correction", "other"] as const;
export type KitchenReason = (typeof KITCHEN_REASONS)[number];

export function kitchenReason(value: string, note: string) {
  const reason = value.trim().toLowerCase();
  if (!KITCHEN_REASONS.includes(reason as KitchenReason)) return { ok: false as const, error: "Pick a reason." };
  if (reason === "other" && !note.trim()) return { ok: false as const, error: "Add a note for Other." };
  return { ok: true as const, reason: reason as KitchenReason, note: note.trim() };
}
