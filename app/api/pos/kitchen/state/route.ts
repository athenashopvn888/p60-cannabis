import { json, kitchenToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";
import { runStore } from "@/app/lib/pny-pos/storeContext";
import { ACD01_STORE } from "@/app/lib/pny-pos/storeProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stores = [
  { code: "PNY01", name: "P60 Cannabis" },
  { code: "ACD01", name: "Amesbury Cannabis Dispensary" },
];

export async function GET(request: Request) {
  try {
    const token = await kitchenToken();
    if (!token) return json({ authenticated: false }, 401);
    const local = await getService();
    const requested = new URL(request.url).searchParams.get("store")?.toUpperCase();
    if (requested === "ACD01") {
      await local.assertKitchenSession(token);
      const view = await runStore(ACD01_STORE, async () => (await getService()).kitchenStateTrusted());
      return json({ ...view, stores });
    }
    const view = await local.kitchenState(token);
    return json({ ...view, store_code: "PNY01", stores });
  } catch (error) {
    return toResponse(error);
  }
}
