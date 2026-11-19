import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCorrection, MemoryCorrectionRepository, previewCorrection, undoCorrection, type Actor, type CorrectionContext, type CorrectionRequest } from "../src/domain/corrections";
import { TEST_CLOSE_INPUT } from "./fixtures";

const human: Actor = { id: "tri", kind: "HUMAN_MASTER", storeScopes: ["ACD01"], triRequested: true };
const baseContext: CorrectionContext = {
  targetVersion: 4,
  oldValue: 20,
  activeShift: false,
  safeDuringActiveShift: false,
  closeInput: TEST_CLOSE_INPUT,
};
const request: CorrectionRequest = {
  idempotencyKey: "acd01-s00001-found-396",
  target: { storeCode: "ACD01", shiftId: "shift-test", shiftCode: "S00001", kind: "STOCK_FOUND", entityId: "396-3g", field: "countedQty" },
  reason: "Found during recount",
  newValue: 2,
  expectedVersion: 4,
};

test("Master correction previews before and after then applies once", async () => {
  const repository = new MemoryCorrectionRepository(baseContext);
  const preview = await previewCorrection(repository, human, request, new Date("2026-11-19T00:00:00Z"));
  assert.equal(preview.before.close.finalVarianceCents, 21700);
  assert.equal(preview.after.close.finalVarianceCents, 25700);
  const applied = await applyCorrection(repository, human, preview.previewId, new Date("2026-11-19T00:01:00Z"));
  const retry = await repository.apply(preview);
  assert.equal(applied.correctionId, retry.correctionId);
  assert.equal(applied.status, "APPLIED");
});

test("active-shift unsafe correction queues without changing staff flow", async () => {
  const repository = new MemoryCorrectionRepository({ ...baseContext, activeShift: true });
  const preview = await previewCorrection(repository, human, request);
  const applied = await applyCorrection(repository, human, preview.previewId);
  assert.equal(preview.status, "WILL_QUEUE");
  assert.equal(applied.status, "QUEUED_ACTIVE_SHIFT");
  assert.equal(repository.context.targetVersion, 4);
});

test("cross-store and self-initiated AI apply are refused", async () => {
  const repository = new MemoryCorrectionRepository(baseContext);
  await assert.rejects(() => previewCorrection(repository, { ...human, storeScopes: ["PNYS"] }, request), /FORBIDDEN_STORE_SCOPE/);
  const ai = { ...human, id: "codex", kind: "AI_MASTER" as const, triRequested: false };
  const preview = await previewCorrection(repository, ai, request);
  await assert.rejects(() => applyCorrection(repository, ai, preview.previewId), /AI_PREVIEW_ONLY/);
});

test("stale preview and tampered apply are refused", async () => {
  const repository = new MemoryCorrectionRepository(baseContext);
  const preview = await previewCorrection(repository, human, request);
  repository.context.targetVersion = 5;
  await assert.rejects(() => applyCorrection(repository, human, preview.previewId), /STALE_CORRECTION_PREVIEW/);
});

test("applied correction creates an auditable undo event", async () => {
  const repository = new MemoryCorrectionRepository(baseContext);
  const preview = await previewCorrection(repository, human, request);
  const applied = await applyCorrection(repository, human, preview.previewId);
  const undone = await undoCorrection(repository, human, applied.correctionId, "Owner requested rollback");
  assert.equal(undone.status, "UNDONE");
  assert.notEqual(undone.auditId, applied.auditId);
});
