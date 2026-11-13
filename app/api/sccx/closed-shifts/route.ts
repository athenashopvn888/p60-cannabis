import { assertSecret, json, toResponse } from "@/app/lib/pny-pos/http";
import { STORE_CODE } from "@/app/lib/pny-pos/constants";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";
import { PosError } from "@/app/lib/pny-pos/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertSecret(request.headers.get("x-sccx-poll-secret"), loadSecrets().poll);
    const store = new URL(request.url).searchParams.get("store") ?? STORE_CODE;
    if (store !== STORE_CODE) throw new PosError(404, "STORE", "This till is PNY01 only.");
    const service = await getService();
    const body = await service.closedShifts();
    const origin = new URL(request.url).origin;
    return json({
      ...body,
      closings: body.closings.map((row) => ({
        ...row,
        summary_image_url: `${origin}/api/sccx/closed-shifts/${encodeURIComponent(row.shift_id)}/summary.png`,
      })),
    });
  } catch (error) {
    return toResponse(error);
  }
}
