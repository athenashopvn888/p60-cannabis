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
    const since = new URL(request.url).searchParams.get("since");
    const service = await getService();
    return json(await service.salesFeed(since));
  } catch (error) {
    return toResponse(error);
  }
}
