import { json, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";
import { SALES_FEED_HEADER, salesFeedTokenOk } from "@/app/lib/pny-pos/salesFeedAuth";
import { runStore } from "@/app/lib/pny-pos/storeContext";
import { PNY02_STORE } from "@/app/lib/pny-pos/storeProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const dedicated = Boolean(process.env.SALES_FEED_TOKEN_PNY02?.trim());
    const ok = dedicated
      ? salesFeedTokenOk(request.headers.get(SALES_FEED_HEADER), "SALES_FEED_TOKEN_PNY02")
      : salesFeedTokenOk(request.headers.get(SALES_FEED_HEADER));
    if (!ok) return json({ ok: false, error: "Unauthorized." }, 401);
    const since = new URL(request.url).searchParams.get("since");
    const service = await getService();
    return json(await runStore(PNY02_STORE, () => service.salesFeed(since)));
  } catch (error) {
    return toResponse(error);
  }
}
