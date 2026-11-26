import type { NextRequest } from "next/server";
import { applyCorrection, previewCorrection, undoCorrection, type CorrectionRequest } from "@/src/domain/corrections";
import { requireMasterActor } from "./auth";
import { withV2Transaction } from "./db";
import { PostgresCorrectionRepository } from "./postgresCorrectionRepository";

type CorrectionBody =
  | { action: "preview"; storeCode: string; request: CorrectionRequest }
  | { action: "apply"; storeCode: string; previewId: string }
  | { action: "undo"; storeCode: string; correctionId: string; reason: string };

export async function runCorrectionRequest(request: NextRequest) {
  const actor = requireMasterActor(request);
  const body = await request.json() as CorrectionBody;
  const storeCode = body.storeCode?.trim().toUpperCase();
  if (!storeCode || actor.storeScopes.length !== 1 || actor.storeScopes[0] !== storeCode) throw new Error("FORBIDDEN_STORE_SCOPE");
  if (actor.kind === "AI_MASTER" && !actor.triRequested && body.action !== "preview") throw new Error("AI_PREVIEW_ONLY");
  return withV2Transaction({ actorId: actor.id, actorKind: actor.kind, storeCode }, async (client) => {
    await client.query("select set_config('app.tri_requested', $1, true)", [actor.triRequested ? "true" : "false"]);
    const repository = new PostgresCorrectionRepository(client, actor);
    if (body.action === "preview") {
      if (body.request.target.storeCode !== storeCode) throw new Error("FORBIDDEN_STORE_SCOPE");
      return previewCorrection(repository, actor, body.request);
    }
    if (body.action === "apply") return applyCorrection(repository, actor, body.previewId);
    if (body.action === "undo") return undoCorrection(repository, actor, body.correctionId, body.reason);
    throw new Error("INVALID_CORRECTION_ACTION");
  });
}
