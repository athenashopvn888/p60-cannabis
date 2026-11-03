import { json, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const service = await getService();
    await service.state(await staffToken());
    return json(await service.refreshIncoming());
  } catch (error) {
    return toResponse(error);
  }
}
