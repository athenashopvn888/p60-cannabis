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
      customer: body.customer && typeof body.customer === "object" && !Array.isArray(body.customer) ? (() => {
        const row = body.customer as Record<string, unknown>;
        return {
          phone: String(row.phone ?? ""),
          name: row.name == null ? undefined : String(row.name),
          email: row.email == null ? undefined : String(row.email),
          consent_type: row.consent_type === "EXPRESS" ? "EXPRESS" as const : row.consent_type === "IMPLIED" ? "IMPLIED" as const : undefined,
          consented_at: row.consented_at == null ? undefined : String(row.consented_at),
          consent_source: row.consent_source == null ? undefined : String(row.consent_source),
          unsubscribe: row.unsubscribe === true,
        };
      })() : null,
      coupon_code: body.coupon_code == null ? null : String(body.coupon_code),
    }, journal);
    const record = result as { journal_order?: DemoJournalOrder | null } & Record<string, unknown>;
    await rememberDemoOrder(Boolean(demo), journal ?? [], record.journal_order);
    delete record.journal_order;
    return json(record);
  } catch (error) {
    return toResponse(error);
  }
}
