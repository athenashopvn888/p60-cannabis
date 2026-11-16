import { json, lineItems, readBody, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    return json(await (await getService()).couponQuote(await staffToken(), {
      lines: lineItems(body),
      coupon_code: String(body.coupon_code ?? ""),
      customer_phone: String(body.customer_phone ?? ""),
    }));
  } catch (error) {
    return toResponse(error);
  }
}
