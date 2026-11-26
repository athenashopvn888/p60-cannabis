import type { NextRequest } from "next/server";
import { requireMasterActor } from "./auth";
import { withV2Transaction } from "./db";

export type OutboxItem = {
  outboxId: string;
  subject: string;
  status: "DRAFT" | "APPROVED" | "SENDING" | "SENT" | "FAILED";
  closeVersion: number;
  parityHash: string;
  approvedAt: string | null;
  sentAt: string | null;
};

function assertUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("INVALID_OUTBOX_ID");
  }
}

export async function listOutbox(request: NextRequest) {
  const actor = requireMasterActor(request);
  const storeCode = actor.storeScopes[0];
  return withV2Transaction({ actorId: actor.id, actorKind: actor.kind, storeCode }, async (client) => {
    const result = await client.query<{
      outbox_id: string;
      subject: string;
      status: OutboxItem["status"];
      close_version: number;
      parity_hash: string;
      approved_at: string | null;
      sent_at: string | null;
    }>(`
      select outbox_id, subject, status, close_version, parity_hash,
             approved_at::text, sent_at::text
        from pos_v2.report_outbox
       where store_code = $1
       order by created_at desc
       limit 25
    `, [storeCode]);
    return result.rows.map((row) => ({
      outboxId: row.outbox_id,
      subject: row.subject,
      status: row.status,
      closeVersion: row.close_version,
      parityHash: row.parity_hash,
      approvedAt: row.approved_at,
      sentAt: row.sent_at,
    }));
  });
}

export async function approveOutbox(request: NextRequest) {
  const actor = requireMasterActor(request);
  if (actor.kind === "AI_MASTER" && !actor.triRequested) throw new Error("AI_PREVIEW_ONLY");
  const body = await request.json() as { storeCode?: string; outboxId?: string; action?: string };
  const storeCode = body.storeCode?.trim().toUpperCase() ?? "";
  if (body.action !== "approve") throw new Error("PREVIEW_EMAIL_TRANSPORT_DISABLED");
  if (storeCode !== actor.storeScopes[0]) throw new Error("FORBIDDEN_STORE_SCOPE");
  assertUuid(body.outboxId ?? "");
  return withV2Transaction({ actorId: actor.id, actorKind: actor.kind, storeCode }, async (client) => {
    const result = await client.query<{ outbox_id: string; status: OutboxItem["status"]; approved_at: string }>(`
      update pos_v2.report_outbox
         set status = 'APPROVED', approved_by = $3, approved_at = now()
       where store_code = $1 and outbox_id = $2 and status = 'DRAFT'
       returning outbox_id, status, approved_at::text
    `, [storeCode, body.outboxId, actor.id]);
    if (result.rows.length !== 1) throw new Error("OUTBOX_NOT_DRAFT");
    await client.query(`
      insert into pos_v2.correction_audit(store_code,audit_id,correction_id,action,actor_id,actor_kind,old_value,new_value,reason)
      select store_code, gen_random_uuid(), correction_id, 'SEND_CORRECTED_REPORT', $3, $4,
             jsonb_build_object('status','DRAFT'), jsonb_build_object('status','APPROVED'),
             'Master Admin approved corrected close email'
        from pos_v2.report_outbox
       where store_code = $1 and outbox_id = $2 and correction_id is not null
    `, [storeCode, body.outboxId, actor.id, actor.kind]);
    return { outboxId: result.rows[0].outbox_id, status: result.rows[0].status, approvedAt: result.rows[0].approved_at };
  });
}
