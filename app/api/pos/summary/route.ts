import { json, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = await getService();
    return json(await service.shiftSummary(await staffToken()));
  } catch (error) {
    return toResponse(error);
  }
}
