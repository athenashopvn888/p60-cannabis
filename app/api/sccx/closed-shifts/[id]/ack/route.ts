import { assertSecret, idempotencyKey, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await readBody(request);
    assertSecret(request.headers.get("x-sccx-poll-secret"), loadSecrets().poll);
    const { id } = await context.params;
    const service = await getService();
    return json(await service.ackClosedShift(id, { key: idempotencyKey(request, body) }));
  } catch (error) {
    return toResponse(error);
  }
}
