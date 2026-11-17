import { json, kitchenToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (process.env.VERCEL_ENV === "production" || process.env.TEST_STORE !== "1") return json({ ok: false, error: "Preview test only." }, 403);
    const token = await kitchenToken();
    if (!token) return json({ authenticated: false, error: "Kitchen sign-in required." }, 401);
    const service = await getService();
    const [body, menu] = await Promise.all([
      service.kitchenState(token),
      service.menu() as Promise<{ items?: Array<{ sku?: string; price_cents?: number }> }>,
    ]);
    const prices = new Map((menu.items ?? []).map((row) => [String(row.sku ?? "").trim(), Number(row.price_cents ?? 0)]));
    return json({
      ...body,
      store_code: "PNY01_TEST",
      stores: [{ code: "PNY01_TEST", name: "PNY01 Stock Snapshot · Test Receiver" }],
      products: body.products.map((product) => ({ ...product, price_cents: prices.get(product.sku) ?? 0 })),
      history: [],
      receipts: [],
      source: "PNYS refreshed PNY01 stock snapshot",
      stock_precision: "EXACT_TEST_MIRROR",
    });
  } catch (error) {
    return toResponse(error);
  }
}
