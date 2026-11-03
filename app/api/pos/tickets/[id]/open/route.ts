import { json, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const service = await getService();
    return json(await service.openTicket(await staffToken(), id));
  } catch (error) {
    return toResponse(error);
  }
}
