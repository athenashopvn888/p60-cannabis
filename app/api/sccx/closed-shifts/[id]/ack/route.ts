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
    const owner = await service.assertIntegrationOwner("SCCX_ACK");
    if (await service.integrationEventDelivered("SCCX_ACK", owner.cutover_id, id)) return json({ ok: true, replay: true, shift_id: id });
    const result = await service.ackClosedShift(id, { key: idempotencyKey(request, body) });
    await service.recordIntegrationDelivery(owner, id, { shift_id: id });
    return json(result);
  } catch (error) {
    return toResponse(error);
  }
}
