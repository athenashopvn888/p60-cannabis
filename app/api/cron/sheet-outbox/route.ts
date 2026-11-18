import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await cronOk(request);
    if (new URL(request.url).searchParams.get("dry_run") === "1") {
      await Promise.all([
        service.assertIntegrationOwner("SHEET_OUTBOX"),
        service.assertIntegrationOwner("SIGNAL"),
      ]);
      return json({ ok: true, dry_run: true, cron: "sheet-outbox", owners_checked: ["SHEET_OUTBOX", "SIGNAL"] });
    }
    if (process.env.INTEGRATIONS_ENABLED === "0") {
      return json({ ok: true, disabled: true, ...(await service.outboxStatus()) });
    }
    const [sheet, signal] = await Promise.all([
      process.env.SHEET_OUTBOX_ENABLED === "0" ? Promise.resolve({ ok: true, enabled: false, sent: 0 }) : service.drainOutbox(),
      service.drainSignalOutbox(),
    ]);
    const ok = sheet.ok && signal.ok;
    return json({ ok, sheet, signal }, ok ? 200 : 503);
  } catch (error) {
    return toResponse(error);
  }
}
