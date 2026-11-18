import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await cronOk(request);
    if (new URL(request.url).searchParams.get("dry_run") === "1") {
      return json({ ok: true, dry_run: true, cron: "reconcile" });
    }
    const report = await service.reconciliation();
    return json(report, report.ok ? 200 : 409);
  } catch (error) {
    return toResponse(error);
  }
}
