import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await cronOk(request);
    const url = process.env.SETB_PRODUCTS_URL?.trim();
    if (!url) return json({ ok: true, skipped: true });
    const headers: Record<string, string> = {};
    if (process.env.SETB_SYNC_SECRET) headers.authorization = `Bearer ${process.env.SETB_SYNC_SECRET}`;
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) return json({ ok: false, error: "Product sync failed." }, 502);
    const payload = await response.json() as { products?: Record<string, unknown>[] } | Record<string, unknown>[];
    const rows = Array.isArray(payload) ? payload : payload.products ?? [];
    return json(await service.syncSetb(rows));
  } catch (error) {
    return toResponse(error);
  }
}
