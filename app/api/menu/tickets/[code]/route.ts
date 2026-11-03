import { json, loadDemoJournal, rememberDemoOrder, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const service = await getService();
    const demo = service.bootstrap().demo;
    const journal = demo ? await loadDemoJournal() : undefined;
    const result = await service.ticketStatus(code, journal);
    await rememberDemoOrder(Boolean(demo), journal ?? [], result.journal_order);
    const body = { ...result } as { journal_order?: unknown };
    delete body.journal_order;
    return json(body);
  } catch (error) {
    return toResponse(error);
  }
}
