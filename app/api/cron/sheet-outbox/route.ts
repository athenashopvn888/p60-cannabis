import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await cronOk(request);
    if (process.env.INTEGRATIONS_ENABLED === "0" || process.env.SHEET_OUTBOX_ENABLED === "0") {
      return json({ ok: true, disabled: true, ...(await service.outboxStatus()) });
    }
    const result = await service.drainOutbox();
    return json(result, result.ok ? 200 : 503);
  } catch (error) {
    return toResponse(error);
  }
}
