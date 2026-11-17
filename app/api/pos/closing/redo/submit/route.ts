import { json, readBody, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const token = await staffToken();
    if (!token) return json({ error: "Sign in again." }, 401);
    const body = await readBody(request);
    const key = request.headers.get("idempotency-key") || String(body.key ?? body.request_id ?? "");
    return json(await (await getService()).submitClosingRedo(token, {
      key,
      counts: Array.isArray(body.counts) ? body.counts as { sku: string; counted_qty: number }[] : [],
      final_deposit_cents: Number(body.final_deposit_cents),
      float_cents: Number(body.float_cents),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
