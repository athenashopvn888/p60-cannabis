import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.INTEGRATIONS_ENABLED === "0") return json({ ok: true, disabled: true });
  try {
    const service = await cronOk(request);
    await service.assertIntegrationOwner("SHEET_IMPORT");
    return json(await service.refreshIncoming({ force: true }));
  } catch (error) {
    return toResponse(error);
  }
}
