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
    return json(await (await getService()).managerCreateCoupon(token, {
      key,
      code: String(body.code ?? ""),
      label: String(body.label ?? ""),
      discount_type: body.discount_type === "PERCENT" ? "PERCENT" : "FIXED",
      discount_value: Number(body.discount_value),
      min_spend_cents: Number(body.min_spend_cents),
      max_redemptions_per_customer: Number(body.max_redemptions_per_customer),
      confirm: body.confirm === true,
    }));
  } catch (error) {
    return toResponse(error);
  }
}
