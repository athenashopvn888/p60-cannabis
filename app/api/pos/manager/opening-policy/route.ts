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
    if (typeof body.opening_count_required !== "boolean") return json({ error: "Pick ON or OFF.", code: "BAD_OPENING_POLICY" }, 400);
    return json(await (await getService()).managerSetOpeningCountPolicy(token, {
      key,
      opening_count_required: body.opening_count_required,
      confirm: body.confirm === true,
    }));
  } catch (error) {
    return toResponse(error);
  }
}
