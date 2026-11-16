import { json, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";
import { SALES_FEED_HEADER, salesFeedTokenOk } from "@/app/lib/pny-pos/salesFeedAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!salesFeedTokenOk(request.headers.get(SALES_FEED_HEADER))) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }
    const params = new URL(request.url).searchParams;
    const since = params.get("since");
    const limit = Number(params.get("limit") ?? "50");
    const service = await getService();
    await service.assertIntegrationOwner("SCCX_FEED");
    return json(await service.salesFeed(since, limit));
  } catch (error) {
    return toResponse(error);
  }
}
