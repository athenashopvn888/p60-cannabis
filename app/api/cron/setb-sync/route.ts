import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";
import { catalogFromFeed, defaultSetbProductsUrl } from "@/app/lib/pny-pos/setbFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await cronOk(request);
    const disabled = process.env.INTEGRATIONS_ENABLED === "0" || process.env.SETB_SYNC_ENABLED === "0";
    if (disabled) return json({ ok: true, disabled: true, authenticated: true, dry_run: new URL(request.url).searchParams.get("dry_run") === "1" });
    await service.assertIntegrationOwner("SETB_SYNC");
    if (new URL(request.url).searchParams.get("dry_run") === "1") {
      return json({ ok: true, dry_run: true, cron: "setb-sync", owner_checked: true });
    }
    const url = defaultSetbProductsUrl();
    const headers: Record<string, string> = {};
    if (process.env.SETB_SYNC_SECRET) headers.authorization = `Bearer ${process.env.SETB_SYNC_SECRET}`;
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) return json({ ok: false, error: "Product sync failed." }, 502);
    const payload = await response.json() as unknown;
    const rows = catalogFromFeed(payload).map((product) => ({
      sku: product.sku,
      name: product.name,
      category: product.category,
      price_cents: product.price_cents,
      image_url: product.image_url,
      active: product.active,
    }));
    return json(await service.syncSetb(rows));
  } catch (error) {
    return toResponse(error);
  }
}
