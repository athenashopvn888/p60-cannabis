import type { DemoJournalOrder } from "@/app/lib/pny-pos/demoJournal";
import { clientIp, idempotencyKey, json, lineItems, loadDemoJournal, readBody, rememberDemoOrder, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    const demo = service.bootstrap().demo;
    const journal = demo ? await loadDemoJournal() : undefined;
    const result = await service.placeOrder({ key: idempotencyKey(request, body), lines: lineItems(body) }, clientIp(request), journal);
    const record = result as { journal_order?: DemoJournalOrder | null } & Record<string, unknown>;
    await rememberDemoOrder(Boolean(demo), journal ?? [], record.journal_order);
    delete record.journal_order;
    return json(record);
  } catch (error) {
    return toResponse(error);
  }
}
