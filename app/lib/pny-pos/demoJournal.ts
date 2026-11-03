import { createHmac } from "node:crypto";
import { safeEqual } from "./crypto.ts";

export type DemoJournalLine = { sku: string; qty: number; unit_price_cents: number };

export type DemoJournalSale = {
  id: string;
  ref_no: string;
  total_cents: number;
  staff_uid: string;
  created_at: string;
  payment_method?: "CASH" | "DEBIT";
  lines: DemoJournalLine[];
};

export type DemoJournalOrder = {
  id: string;
  code: string;
  shift_id: string;
  status: "PENDING" | "OPEN" | "CASHED_OUT" | "CANCELLED";
  expires_at: string;
  created_at: string;
  lines: DemoJournalLine[];
  sale?: DemoJournalSale | null;
};

const MAX_ORDERS = 12;

export function signDemoJournal(orders: DemoJournalOrder[], secret: string) {
  const body = Buffer.from(JSON.stringify(orders.slice(-MAX_ORDERS))).toString("base64url");
  const sig = createHmac("sha256", secret).update(`pny-demo-journal:v1:${body}`).digest("base64url");
  return `v1.${body}.${sig}`;
}

export function readDemoJournal(token: string, secret: string): DemoJournalOrder[] {
  if (!token || !secret) return [];
  const [version, body, sig] = token.split(".");
  if (version !== "v1" || !body || !sig) return [];
  const expected = createHmac("sha256", secret).update(`pny-demo-journal:v1:${body}`).digest("base64url");
  if (!safeEqual(sig, expected)) return [];
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DemoJournalOrder[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((order) => order && typeof order.id === "string" && typeof order.code === "string").slice(-MAX_ORDERS);
  } catch {
    return [];
  }
}

export function upsertDemoOrder(orders: DemoJournalOrder[], order: DemoJournalOrder) {
  const without = orders.filter((row) => row.id !== order.id);
  const previous = orders.find((row) => row.id === order.id);
  const next = previous?.status === "CASHED_OUT" && order.status !== "CASHED_OUT"
    ? { ...order, status: "CASHED_OUT" as const, sale: previous.sale ?? order.sale }
    : order;
  return [...without, next].slice(-MAX_ORDERS);
}
