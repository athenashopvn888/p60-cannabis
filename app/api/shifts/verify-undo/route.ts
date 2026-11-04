import { assertSecret, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Backup or undo one shift's opening verify. The deadline is not moved here. */
export async function POST(request: Request) {
  try {
    assertSecret(request.headers.get("x-shift-secret"), loadSecrets().shift);
    const body = await readBody(request);
    const service = await getService();
    const shiftId = String(body.shift_id ?? "");
    if (body.op === "backup") return json(await service.exportVerifyBackup(shiftId));
    if (body.op === "revert") return json(await service.undoOpeningVerify(shiftId));
    throw new Error("op must be backup or revert");
  } catch (error) {
    return toResponse(error);
  }
}
