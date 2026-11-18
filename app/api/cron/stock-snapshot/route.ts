import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await cronOk(request);
    if (process.env.INTEGRATIONS_ENABLED === "0") {
      return json({ ok: true, disabled: true, authenticated: true, dry_run: new URL(request.url).searchParams.get("dry_run") === "1" });
    }
    await service.assertIntegrationOwner("STOCK_SNAPSHOT");
    if (new URL(request.url).searchParams.get("dry_run") === "1") {
      return json({ ok: true, dry_run: true, cron: "stock-snapshot", owner_checked: true });
    }
    return json(await service.snapshotStock());
  } catch (error) {
    return toResponse(error);
  }
}
