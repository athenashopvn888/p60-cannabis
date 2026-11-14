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
    const lease = await service.assertIntegrationOwner("SCCX_ACK");
    const key = idempotencyKey(request, body);
    const result = await service.ackClosedShift(id, { key });
    await service.recordIntegrationDelivery(lease, `closing:${id}:ack:${key}`, { shift_id: id });
    return json(result);
  } catch (error) {
    return toResponse(error);
  }
}
