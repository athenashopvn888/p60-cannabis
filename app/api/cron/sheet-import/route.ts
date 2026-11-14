import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await cronOk(request);
    await service.assertIntegrationOwner("SHEET_IMPORT");
    return json(await service.refreshIncoming({ force: true }));
  } catch (error) {
    return toResponse(error);
  }
}
