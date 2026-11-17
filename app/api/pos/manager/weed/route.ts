import { idempotencyKey, json, managerToken, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const token = await managerToken();
    if (!token) return json({ authenticated: false }, 401);
    const key = idempotencyKey(request, body);
    if (!key) return json({ error: "An idempotency key is required.", code: "KEY_REQUIRED" }, 400);
    const service = await getService();
    if (body.action === "undo") {
      return json(await service.managerUndoWeedMode(token, {
        key,
        backup_id: String(body.backup_id ?? ""),
        confirm: body.confirm === true,
      }));
    }
    if (typeof body.weed_in_store !== "boolean") return json({ error: "Pick WEED or NO WEED.", code: "BAD_WEED_MODE" }, 400);
    return json(await service.managerSetWeedMode(token, {
      key,
      weed_in_store: body.weed_in_store,
      confirm: body.confirm === true,
    }));
  } catch (error) {
    return toResponse(error);
  }
}
