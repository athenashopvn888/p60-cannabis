import { idempotencyKey, json, kitchenToken, readBody, refillLines, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";
import { runStore } from "@/app/lib/pny-pos/storeContext";
import { ACD01_STORE } from "@/app/lib/pny-pos/storeProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const token = await kitchenToken();
    const input = { key: idempotencyKey(request, body), lines: refillLines(body) };
    const local = await getService();
    if (String(body.store_code ?? "").toUpperCase() === "ACD01") {
      const actor = await local.assertKitchenSession(token);
      return json(await runStore(ACD01_STORE, async () => (await getService()).queueKitchenRefillTrusted(input, actor)));
    }
    return json(await local.queueKitchenRefill(token, input));
  } catch (error) {
    return toResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readBody(request);
    const token = await kitchenToken();
    const input = { key: idempotencyKey(request, body), batch_id: String(body.batch_id ?? "").trim(), lines: refillLines(body) };
    const local = await getService();
    if (String(body.store_code ?? "").toUpperCase() === "ACD01") {
      const actor = await local.assertKitchenSession(token);
      return json(await runStore(ACD01_STORE, async () => (await getService()).editKitchenRefillTrusted(input, actor)));
    }
    return json(await local.editKitchenRefill(token, input));
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await readBody(request);
    const token = await kitchenToken();
    const input = { key: idempotencyKey(request, body), batch_id: String(body.batch_id ?? "").trim() };
    const local = await getService();
    if (String(body.store_code ?? "").toUpperCase() === "ACD01") {
      const actor = await local.assertKitchenSession(token);
      return json(await runStore(ACD01_STORE, async () => (await getService()).deleteKitchenRefillTrusted(input, actor)));
    }
    return json(await local.deleteKitchenRefill(token, input));
  } catch (error) {
    return toResponse(error);
  }
}
