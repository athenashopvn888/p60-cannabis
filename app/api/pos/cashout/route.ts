import type { DemoJournalOrder } from "@/app/lib/pny-pos/demoJournal";
import { idempotencyKey, json, lineItems, loadDemoJournal, readBody, rememberDemoOrder, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    const demo = service.bootstrap().demo;
    const journal = demo ? await loadDemoJournal() : undefined;
    const result = await service.cashout(await staffToken(), {
      key: idempotencyKey(request, body),
      lines: lineItems(body),
      ticket_id: body.ticket_id == null || body.ticket_id === "" ? null : String(body.ticket_id),
      payment_method: body.payment_method == null ? null : String(body.payment_method),
    }, journal);
    const record = result as { journal_order?: DemoJournalOrder | null } & Record<string, unknown>;
    await rememberDemoOrder(Boolean(demo), journal ?? [], record.journal_order);
    delete record.journal_order;
    return json(record);
  } catch (error) {
    return toResponse(error);
  }
}
