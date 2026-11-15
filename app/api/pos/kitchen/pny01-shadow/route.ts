import { json, kitchenToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sizeFromSku(sku: string) {
  const match = sku.match(/-(3g|5g|14g|28g)$/i);
  return match?.[1] ?? "each";
}

export async function GET() {
  try {
    if (process.env.VERCEL_ENV === "production" || process.env.TEST_STORE !== "1") return json({ ok: false, error: "Preview test only." }, 403);
    const token = await kitchenToken();
    if (!token) return json({ authenticated: false }, 401);
    await (await getService()).kitchenState(token);
    const response = await fetch("https://pny1-pos.vercel.app/api/menu", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("PNY01 public menu feed is unavailable.");
    const body = await response.json() as { items?: Array<{ sku?: string; name?: string; category?: string; price_cents?: number; image_url?: string | null; availability?: string }> };
    const products = (body.items ?? []).map((row) => ({
      sku: String(row.sku ?? "").trim(),
      name: String(row.name ?? "").trim(),
      category: String(row.category ?? "ITEMS").trim(),
      price_cents: Number(row.price_cents ?? 0),
      image_url: row.image_url ?? null,
      size: sizeFromSku(String(row.sku ?? "")),
      on_hand: null,
      sold_24h: null,
      pending_qty: 0,
      suggested_refill_qty: 0,
      availability: String(row.availability ?? "Available"),
      enabled: true,
      approval_required: false,
    })).filter((row) => row.sku && row.name);
    return json({ authenticated: true, store_code: "PNY01_TEST", stores: [{ code: "PNY01_TEST", name: "PNY01 Live Catalog · Test Receiver" }], products, history: [], source: "PNY01 public menu read-only", stock_precision: "UNAVAILABLE" });
  } catch (error) {
    return toResponse(error);
  }
}
