import { json, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";
import { SALES_FEED_HEADER, salesFeedTokenOk } from "@/app/lib/pny-pos/salesFeedAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const header = request.headers.get(SALES_FEED_HEADER);
    const dedicated = Boolean(process.env.PNY01_STOCK_FEED_TOKEN?.trim());
    const authorized = dedicated
      ? salesFeedTokenOk(header, "PNY01_STOCK_FEED_TOKEN")
      : salesFeedTokenOk(header);
    if (!authorized) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }
    return json(await (await getService()).stockFeed());
  } catch (error) {
    return toResponse(error);
  }
}
