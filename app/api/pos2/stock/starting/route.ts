import { adminToken, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";
import { runStore } from "@/app/lib/pny-pos/storeContext";
import { PNY02_STORE } from "@/app/lib/pny-pos/storeProfile";
import { PNY2_START_KEY } from "@/app/lib/pny-pos/pny2StartingStock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-time PNY02 opening. Admin cookie required. The lines are fixed in code. */
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    const key = String(body.key ?? PNY2_START_KEY);
    return json(await runStore(PNY02_STORE, async () => service.loadPny2StartingStock(await adminToken(), { key })));
  } catch (error) {
    return toResponse(error);
  }
}
