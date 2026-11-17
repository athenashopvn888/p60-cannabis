import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await cronOk(request);
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
