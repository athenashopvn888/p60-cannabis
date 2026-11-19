import { randomUUID } from "node:crypto";
import { calculateClose, type CloseInput, type CloseResult } from "./close";
import { sha256 } from "./stable";

export type ActorKind = "HUMAN_MASTER" | "AI_MASTER";
export type CorrectionKind = "STOCK_FOUND" | "STOCK_ADJUST" | "SHIFT_TIME" | "MONEY" | "CLOSE_RECALCULATE";
export type CorrectionStatus = "PREVIEWED" | "QUEUED_ACTIVE_SHIFT" | "APPLIED" | "UNDONE";

export type Actor = {
  id: string;
  kind: ActorKind;
  storeScopes: string[];
  triRequested: boolean;
};

export type CorrectionTarget = {
  storeCode: string;
  shiftId: string;
  shiftCode: string;
  kind: CorrectionKind;
  entityId: string;
  field: string;
};

export type CorrectionRequest = {
  idempotencyKey: string;
  target: CorrectionTarget;
  reason: string;
  newValue: unknown;
  expectedVersion: number;
};

export type CorrectionContext = {
  targetVersion: number;
  oldValue: unknown;
  activeShift: boolean;
  safeDuringActiveShift: boolean;
  closeInput: CloseInput;
  possibleDoubleCount?: { source: "COUNT" | "REFILL"; reference: string }[];
};

export type CorrectionPreview = {
  previewId: string;
  createdAt: string;
  expiresAt: string;
  requestHash: string;
  actor: Actor;
  request: CorrectionRequest;
  before: { value: unknown; close: CloseResult; input: CloseInput };
  after: { value: unknown; close: CloseResult; input: CloseInput };
  status: "READY" | "WILL_QUEUE";
  warnings: string[];
};

export type AppliedCorrection = {
  correctionId: string;
  status: CorrectionStatus;
  auditId: string;
  preview: CorrectionPreview;
  appliedAt: string;
};

export interface CorrectionRepository {
  loadContext(target: CorrectionTarget): Promise<CorrectionContext>;
  savePreview(preview: CorrectionPreview): Promise<void>;
  loadPreview(previewId: string): Promise<CorrectionPreview | null>;
  apply(preview: CorrectionPreview): Promise<AppliedCorrection>;
  undo(correctionId: string, actor: Actor, reason: string): Promise<AppliedCorrection>;
}

function authorized(actor: Actor, storeCode: string) {
  if (!actor.id || !actor.storeScopes.includes(storeCode)) throw new Error("FORBIDDEN_STORE_SCOPE");
  if (actor.kind === "AI_MASTER" && !actor.triRequested) throw new Error("AI_PREVIEW_ONLY");
}

export function correctedCloseInput(context: CorrectionContext, request: CorrectionRequest): CloseInput {
  const next = structuredClone(context.closeInput);
  if (request.target.kind === "STOCK_FOUND" || request.target.kind === "STOCK_ADJUST") {
    const line = next.lines.find((item) => item.sku === request.target.entityId);
    if (!line) throw new Error("CORRECTION_SKU_NOT_FOUND");
    if (typeof request.newValue !== "number" || !Number.isSafeInteger(request.newValue)) throw new Error("INVALID_STOCK_VALUE");
    line.countedQty = request.target.kind === "STOCK_FOUND" ? line.countedQty + request.newValue : request.newValue;
  }
  if (request.target.kind === "MONEY") {
    if (typeof request.newValue !== "number" || !Number.isSafeInteger(request.newValue)) throw new Error("INVALID_MONEY_VALUE");
    const allowed = new Set(["openingCashCents", "cashSalesCents", "safeboxCents", "closingFloatCents"]);
    if (!allowed.has(request.target.field)) throw new Error("INVALID_MONEY_FIELD");
    (next as unknown as Record<string, unknown>)[request.target.field] = request.newValue;
  }
  return next;
}

export async function previewCorrection(repository: CorrectionRepository, actor: Actor, request: CorrectionRequest, now = new Date()): Promise<CorrectionPreview> {
  if (request.reason.trim().length < 5) throw new Error("CORRECTION_REASON_REQUIRED");
  if (!request.idempotencyKey.trim()) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  if (!actor.id || !actor.storeScopes.includes(request.target.storeCode)) throw new Error("FORBIDDEN_STORE_SCOPE");
  const context = await repository.loadContext(request.target);
  if (context.targetVersion !== request.expectedVersion) throw new Error("STALE_CORRECTION_PREVIEW");
  const afterInput = correctedCloseInput(context, request);
  const warnings = (context.possibleDoubleCount ?? []).map((match) => `Possible double count: ${match.source} ${match.reference}.`);
  if (context.activeShift && !context.safeDuringActiveShift) warnings.push("Active shift: correction will queue and apply after the current action completes.");
  const requestHash = sha256({ actor: actor.id, request, targetVersion: context.targetVersion });
  const preview: CorrectionPreview = {
    previewId: randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    requestHash,
    actor,
    request,
    before: { value: context.oldValue, close: calculateClose(context.closeInput), input: structuredClone(context.closeInput) },
    after: { value: request.newValue, close: calculateClose(afterInput), input: structuredClone(afterInput) },
    status: context.activeShift && !context.safeDuringActiveShift ? "WILL_QUEUE" : "READY",
    warnings,
  };
  await repository.savePreview(preview);
  return preview;
}

export async function applyCorrection(repository: CorrectionRepository, actor: Actor, previewId: string, now = new Date()): Promise<AppliedCorrection> {
  const preview = await repository.loadPreview(previewId);
  if (!preview) throw new Error("CORRECTION_PREVIEW_NOT_FOUND");
  if (new Date(preview.expiresAt).getTime() <= now.getTime()) throw new Error("CORRECTION_PREVIEW_EXPIRED");
  authorized(actor, preview.request.target.storeCode);
  if (preview.actor.id !== actor.id || preview.actor.kind !== actor.kind) throw new Error("CORRECTION_ACTOR_CHANGED");
  const context = await repository.loadContext(preview.request.target);
  if (context.targetVersion !== preview.request.expectedVersion) throw new Error("STALE_CORRECTION_PREVIEW");
  if (sha256({ actor: actor.id, request: preview.request, targetVersion: context.targetVersion }) !== preview.requestHash) throw new Error("CORRECTION_PREVIEW_TAMPERED");
  return repository.apply(preview);
}

export async function undoCorrection(repository: CorrectionRepository, actor: Actor, correctionId: string, reason: string) {
  if (reason.trim().length < 5) throw new Error("UNDO_REASON_REQUIRED");
  if (!correctionId) throw new Error("CORRECTION_ID_REQUIRED");
  return repository.undo(correctionId, actor, reason);
}

export class MemoryCorrectionRepository implements CorrectionRepository {
  readonly previews = new Map<string, CorrectionPreview>();
  readonly applied = new Map<string, AppliedCorrection>();
  readonly idempotency = new Map<string, string>();
  context: CorrectionContext;

  constructor(context: CorrectionContext) { this.context = structuredClone(context); }

  async loadContext() { return structuredClone(this.context); }
  async savePreview(preview: CorrectionPreview) { this.previews.set(preview.previewId, structuredClone(preview)); }
  async loadPreview(previewId: string) { return structuredClone(this.previews.get(previewId) ?? null); }

  async apply(preview: CorrectionPreview): Promise<AppliedCorrection> {
    const existing = this.idempotency.get(preview.request.idempotencyKey);
    if (existing) return structuredClone(this.applied.get(existing)!);
    const correctionId = randomUUID();
    const result: AppliedCorrection = {
      correctionId,
      status: preview.status === "WILL_QUEUE" ? "QUEUED_ACTIVE_SHIFT" : "APPLIED",
      auditId: randomUUID(),
      preview: structuredClone(preview),
      appliedAt: new Date().toISOString(),
    };
    if (result.status === "APPLIED") {
      this.context.oldValue = preview.request.newValue;
      this.context.targetVersion += 1;
      this.context.closeInput = correctedCloseInput(this.context, preview.request);
    }
    this.applied.set(correctionId, result);
    this.idempotency.set(preview.request.idempotencyKey, correctionId);
    return structuredClone(result);
  }

  async undo(correctionId: string, actor: Actor, reason: string): Promise<AppliedCorrection> {
    const source = this.applied.get(correctionId);
    if (!source) throw new Error("CORRECTION_NOT_FOUND");
    authorized(actor, source.preview.request.target.storeCode);
    if (source.status !== "APPLIED") throw new Error("CORRECTION_NOT_UNDOABLE");
    const undone: AppliedCorrection = {
      ...structuredClone(source),
      correctionId: randomUUID(),
      status: "UNDONE",
      auditId: randomUUID(),
      appliedAt: new Date().toISOString(),
      preview: { ...structuredClone(source.preview), warnings: [...source.preview.warnings, `Undo: ${reason}`] },
    };
    this.applied.set(undone.correctionId, undone);
    return undone;
  }
}
