import { assertSecret, toResponse } from "@/app/lib/pny-pos/http";
import { closingSummaryImage } from "@/app/lib/pny-pos/closingSummaryImage";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSecret(request.headers.get("x-sccx-poll-secret"), loadSecrets().poll);
    const { id } = await context.params;
    const service = await getService();
    return closingSummaryImage(await service.closingSummary(id));
  } catch (error) {
    return toResponse(error);
  }
}
