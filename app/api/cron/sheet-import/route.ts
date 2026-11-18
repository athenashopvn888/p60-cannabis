import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.INTEGRATIONS_ENABLED === "0") return json({ ok: true, disabled: true });
  try {
    const service = await cronOk(request);
    await service.assertIntegrationOwner("SHEET_IMPORT");
    if (new URL(request.url).searchParams.get("dry_run") === "1") {
      return json({ ok: true, dry_run: true, cron: "sheet-import", owner_checked: true });
    }
    return json(await service.refreshIncoming({ force: true }));
  } catch (error) {
    return toResponse(error);
  }
}
