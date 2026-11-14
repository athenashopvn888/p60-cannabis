import { cronOk, json, toResponse } from "@/app/lib/pny-pos/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await cronOk(request);
    await service.assertIntegrationOwner("STOCK_SNAPSHOT");
    return json(await service.snapshotStock());
  } catch (error) {
    return toResponse(error);
  }
}
