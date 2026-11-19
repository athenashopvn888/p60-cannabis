import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  type Actor,
  type AppliedCorrection,
  type CorrectionContext,
  type CorrectionPreview,
  type CorrectionRepository,
  type CorrectionTarget,
} from "@/src/domain/corrections";
import { buildCloseReportBundle } from "@/src/domain/report";
import { buildCloseWorkbook } from "./xlsx";

type LatestCloseRow = {
  close_id: string;
  version: number;
  input_json: CorrectionPreview["before"]["input"];
  result_json: CorrectionPreview["before"]["close"];
};

function assertUuid(value: string, label: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error(`INVALID_${label}`);
}

export class PostgresCorrectionRepository implements CorrectionRepository {
  constructor(private readonly client: PoolClient, private readonly actor: Actor) {}

  private async latestClose(storeCode: string, shiftId: string, lock = false): Promise<LatestCloseRow> {
    const result = await this.client.query<LatestCloseRow>(`
      select close_id, version, input_json, result_json
        from pos_v2.close_versions
       where store_code = $1 and shift_id = $2
       order by version desc
       limit 1${lock ? " for update" : ""}
    `, [storeCode, shiftId]);
    if (result.rows.length !== 1) throw new Error("CLOSE_NOT_FOUND");
    return result.rows[0];
  }

  async loadContext(target: CorrectionTarget): Promise<CorrectionContext> {
    assertUuid(target.shiftId, "SHIFT_ID");
    const shiftResult = await this.client.query<{ status: string; started_at: string; ended_at: string | null; row_version: string }>(`
      select status, started_at::text, ended_at::text, row_version::text
        from pos_v2.shifts where store_code = $1 and shift_id = $2
    `, [target.storeCode, target.shiftId]);
    if (shiftResult.rows.length !== 1) throw new Error("SHIFT_NOT_FOUND");
    const shift = shiftResult.rows[0];
    const close = await this.latestClose(target.storeCode, target.shiftId);
    let oldValue: unknown = close.result_json;
    let targetVersion = close.version;
    if (target.kind === "STOCK_FOUND" || target.kind === "STOCK_ADJUST") {
      const line = close.input_json.lines.find((item) => item.sku === target.entityId);
      if (!line) throw new Error("CORRECTION_SKU_NOT_FOUND");
      oldValue = line.countedQty;
    } else if (target.kind === "MONEY") {
      oldValue = (close.input_json as unknown as Record<string, unknown>)[target.field];
    } else if (target.kind === "SHIFT_TIME") {
      if (!new Set(["startedAt", "endedAt"]).has(target.field)) throw new Error("INVALID_SHIFT_TIME_FIELD");
      oldValue = target.field === "startedAt" ? shift.started_at : shift.ended_at;
      targetVersion = Number(shift.row_version);
    }
    const duplicate = await this.client.query<{ reference: string }>(`
      select r.refill_code as reference
        from pos_v2.refills r
        join pos_v2.refill_lines l on l.store_code = r.store_code and l.refill_id = r.refill_id
       where r.store_code = $1 and r.shift_id = $2 and l.sku = $3 and r.status in ('PARTIAL','ACCEPTED')
       limit 3
    `, [target.storeCode, target.shiftId, target.entityId]);
    return {
      targetVersion,
      oldValue,
      activeShift: shift.status !== "CLOSED",
      safeDuringActiveShift: false,
      closeInput: close.input_json,
      possibleDoubleCount: duplicate.rows.map((row) => ({ source: "REFILL" as const, reference: row.reference })),
    };
  }

  async savePreview(preview: CorrectionPreview): Promise<void> {
    assertUuid(preview.previewId, "PREVIEW_ID");
    const target = preview.request.target;
    await this.client.query(`
      insert into pos_v2.corrections(
        store_code, correction_id, idempotency_key, kind, shift_id, target_entity, target_field,
        reason, status, expected_version, before_json, after_json, preview_hash,
        actor_id, actor_kind, tri_requested
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,'PREVIEWED',$9,$10,$11,$12,$13,$14,$15)
    `, [
      target.storeCode, preview.previewId, preview.request.idempotencyKey, target.kind, target.shiftId,
      target.entityId, target.field, preview.request.reason, preview.request.expectedVersion,
      JSON.stringify(preview.before), JSON.stringify(preview.after), preview.requestHash,
      preview.actor.id, preview.actor.kind, preview.actor.triRequested,
    ]);
    await this.client.query(`insert into pos_v2.correction_snapshots(store_code, correction_id, snapshot_json) values ($1,$2,$3)`, [target.storeCode, preview.previewId, JSON.stringify(preview)]);
    await this.client.query(`
      insert into pos_v2.correction_audit(store_code,audit_id,correction_id,action,actor_id,actor_kind,old_value,new_value,reason)
      values ($1,$2,$3,'PREVIEW',$4,$5,$6,$7,$8)
    `, [target.storeCode, randomUUID(), preview.previewId, preview.actor.id, preview.actor.kind, JSON.stringify(preview.before.value), JSON.stringify(preview.after.value), preview.request.reason]);
  }

  async loadPreview(previewId: string): Promise<CorrectionPreview | null> {
    assertUuid(previewId, "PREVIEW_ID");
    const result = await this.client.query<{ snapshot_json: CorrectionPreview }>(`
      select s.snapshot_json from pos_v2.correction_snapshots s
      join pos_v2.corrections c using (store_code, correction_id)
      where s.store_code = $1 and s.correction_id = $2
    `, [this.actor.storeScopes[0], previewId]);
    return result.rows[0]?.snapshot_json ?? null;
  }

  private async writeCloseVersion(preview: CorrectionPreview, correctionId: string, input = preview.after.input, result = preview.after.close) {
    const target = preview.request.target;
    const latest = await this.latestClose(target.storeCode, target.shiftId, true);
    if (latest.version !== preview.request.expectedVersion && preview.request.target.kind !== "SHIFT_TIME") throw new Error("STALE_CORRECTION_PREVIEW");
    const nextVersion = latest.version + 1;
    await this.client.query(`
      insert into pos_v2.close_versions(store_code,close_id,shift_id,version,input_json,result_json,parity_hash,created_by,correction_id)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [target.storeCode, latest.close_id, target.shiftId, nextVersion, JSON.stringify(input), JSON.stringify(result), result.parityHash, this.actor.id, correctionId]);
    for (const line of input.lines) {
      const qtyDiff = line.countedQty - line.expectedQty;
      await this.client.query(`
        insert into pos_v2.close_lines(store_code,close_id,version,sku,expected_qty,counted_qty,unit_price_cents,qty_diff,value_diff_cents)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [target.storeCode, latest.close_id, nextVersion, line.sku, line.expectedQty, line.countedQty, line.unitPriceCents, qtyDiff, qtyDiff * line.unitPriceCents]);
    }
    return { closeId: latest.close_id, version: nextVersion };
  }

  async apply(preview: CorrectionPreview): Promise<AppliedCorrection> {
    const target = preview.request.target;
    const correction = await this.client.query<{ status: string }>(`
      select status from pos_v2.corrections where store_code = $1 and correction_id = $2 for update
    `, [target.storeCode, preview.previewId]);
    if (correction.rows[0]?.status === "APPLIED" || correction.rows[0]?.status === "QUEUED_ACTIVE_SHIFT") {
      return { correctionId: preview.previewId, status: correction.rows[0].status as AppliedCorrection["status"], auditId: preview.previewId, preview, appliedAt: new Date().toISOString() };
    }
    if (correction.rows[0]?.status !== "PREVIEWED") throw new Error("CORRECTION_NOT_APPLICABLE");
    if (preview.status === "WILL_QUEUE") {
      const auditId = randomUUID();
      await this.client.query(`update pos_v2.corrections set status = 'QUEUED_ACTIVE_SHIFT' where store_code = $1 and correction_id = $2`, [target.storeCode, preview.previewId]);
      await this.client.query(`insert into pos_v2.correction_audit(store_code,audit_id,correction_id,action,actor_id,actor_kind,old_value,new_value,reason) values ($1,$2,$3,'QUEUE',$4,$5,$6,$7,$8)`, [target.storeCode,auditId,preview.previewId,this.actor.id,this.actor.kind,JSON.stringify(preview.before.value),JSON.stringify(preview.after.value),preview.request.reason]);
      return { correctionId: preview.previewId, status: "QUEUED_ACTIVE_SHIFT", auditId, preview, appliedAt: new Date().toISOString() };
    }

    const context = await this.loadContext(target);
    if (context.targetVersion !== preview.request.expectedVersion) throw new Error("STALE_CORRECTION_PREVIEW");
    let closeReference: { closeId: string; version: number } | undefined;
    if (target.kind === "STOCK_FOUND" || target.kind === "STOCK_ADJUST") {
      const beforeQty = Number(preview.before.value);
      const afterQty = preview.after.input.lines.find((line) => line.sku === target.entityId)?.countedQty;
      if (afterQty === undefined) throw new Error("CORRECTION_SKU_NOT_FOUND");
      const delta = afterQty - beforeQty;
      const balance = await this.client.query<{ quantity: string }>(`select quantity::text from pos_v2.inventory_balances where store_code=$1 and sku=$2 for update`, [target.storeCode,target.entityId]);
      if (balance.rows.length !== 1 || Number(balance.rows[0].quantity) + delta < 0) throw new Error("INVALID_CORRECTED_BALANCE");
      await this.client.query(`update pos_v2.inventory_balances set quantity=quantity+$3,row_version=row_version+1,updated_at=now() where store_code=$1 and sku=$2`, [target.storeCode,target.entityId,delta]);
      await this.client.query(`insert into pos_v2.inventory_movements(store_code,movement_id,sku,quantity_delta,movement_type,source_id,created_by) values ($1,$2,$3,$4,'CORRECTION',$5,$6)`, [target.storeCode,randomUUID(),target.entityId,delta,preview.previewId,this.actor.id]);
      closeReference = await this.writeCloseVersion(preview, preview.previewId);
    } else if (target.kind === "MONEY" || target.kind === "CLOSE_RECALCULATE") {
      closeReference = await this.writeCloseVersion(preview, preview.previewId);
    } else if (target.kind === "SHIFT_TIME") {
      const column = target.field === "startedAt" ? "started_at" : "ended_at";
      await this.client.query(`update pos_v2.shifts set ${column}=$3::timestamptz,row_version=row_version+1 where store_code=$1 and shift_id=$2 and row_version=$4`, [target.storeCode,target.shiftId,preview.request.newValue,preview.request.expectedVersion]);
    }

    if (closeReference) {
      const report = buildCloseReportBundle(preview.after.input, preview.after.close, true);
      const xlsx = await buildCloseWorkbook(preview.after.input, preview.after.close);
      await this.client.query(`
        insert into pos_v2.report_outbox(store_code,outbox_id,close_id,close_version,correction_id,recipient_key,subject,body_text,xlsx_bytes,parity_hash,status)
        values ($1,$2,$3,$4,$5,'DOLI',$6,$7,$8,$9,'DRAFT')
        on conflict (store_code,close_id,close_version,recipient_key,parity_hash) do nothing
      `, [target.storeCode,randomUUID(),closeReference.closeId,closeReference.version,preview.previewId,report.subject,report.body,xlsx,report.parityHash]);
    }
    const auditId = randomUUID();
    await this.client.query(`update pos_v2.corrections set status='APPLIED',applied_at=now() where store_code=$1 and correction_id=$2`, [target.storeCode,preview.previewId]);
    await this.client.query(`insert into pos_v2.correction_audit(store_code,audit_id,correction_id,action,actor_id,actor_kind,old_value,new_value,reason) values ($1,$2,$3,'APPLY',$4,$5,$6,$7,$8)`, [target.storeCode,auditId,preview.previewId,this.actor.id,this.actor.kind,JSON.stringify(preview.before.value),JSON.stringify(preview.after.value),preview.request.reason]);
    return { correctionId: preview.previewId, status: "APPLIED", auditId, preview, appliedAt: new Date().toISOString() };
  }

  async undo(correctionId: string, actor: Actor, reason: string): Promise<AppliedCorrection> {
    const preview = await this.loadPreview(correctionId);
    if (!preview) throw new Error("CORRECTION_NOT_FOUND");
    const target = preview.request.target;
    const row = await this.client.query<{ status: string }>(`select status from pos_v2.corrections where store_code=$1 and correction_id=$2 for update`, [target.storeCode,correctionId]);
    if (row.rows[0]?.status !== "APPLIED") throw new Error("CORRECTION_NOT_UNDOABLE");
    if (target.kind === "STOCK_FOUND" || target.kind === "STOCK_ADJUST") {
      const beforeQty = Number(preview.before.value);
      const afterQty = preview.after.input.lines.find((line) => line.sku === target.entityId)?.countedQty;
      if (afterQty === undefined) throw new Error("CORRECTION_SKU_NOT_FOUND");
      const delta = beforeQty - afterQty;
      await this.client.query(`update pos_v2.inventory_balances set quantity=quantity+$3,row_version=row_version+1,updated_at=now() where store_code=$1 and sku=$2 and quantity+$3>=0`, [target.storeCode,target.entityId,delta]);
      await this.client.query(`insert into pos_v2.inventory_movements(store_code,movement_id,sku,quantity_delta,movement_type,source_id,created_by) values ($1,$2,$3,$4,'UNDO',$5,$6)`, [target.storeCode,randomUUID(),target.entityId,delta,correctionId,actor.id]);
      await this.writeCloseVersion({ ...preview, request: { ...preview.request, expectedVersion: (await this.latestClose(target.storeCode,target.shiftId)).version } }, correctionId, preview.before.input, preview.before.close);
    } else if (target.kind === "MONEY" || target.kind === "CLOSE_RECALCULATE") {
      await this.writeCloseVersion({ ...preview, request: { ...preview.request, expectedVersion: (await this.latestClose(target.storeCode,target.shiftId)).version } }, correctionId, preview.before.input, preview.before.close);
    } else if (target.kind === "SHIFT_TIME") {
      const column = target.field === "startedAt" ? "started_at" : "ended_at";
      await this.client.query(`update pos_v2.shifts set ${column}=$3::timestamptz,row_version=row_version+1 where store_code=$1 and shift_id=$2`, [target.storeCode,target.shiftId,preview.before.value]);
    }
    const auditId = randomUUID();
    await this.client.query(`update pos_v2.corrections set status='UNDONE',undone_at=now() where store_code=$1 and correction_id=$2`, [target.storeCode,correctionId]);
    await this.client.query(`insert into pos_v2.correction_audit(store_code,audit_id,correction_id,action,actor_id,actor_kind,old_value,new_value,reason) values ($1,$2,$3,'UNDO',$4,$5,$6,$7,$8)`, [target.storeCode,auditId,correctionId,actor.id,actor.kind,JSON.stringify(preview.after.value),JSON.stringify(preview.before.value),reason]);
    return { correctionId, status: "UNDONE", auditId, preview, appliedAt: new Date().toISOString() };
  }
}
