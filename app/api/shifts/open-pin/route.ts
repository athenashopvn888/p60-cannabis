import { assertSecret, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Opens one PNY01 shift for a known staff member. The PIN arrives in a header and is never returned. */
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    assertSecret(request.headers.get("x-shift-secret"), loadSecrets().shift);
    const service = await getService();
    const result = await service.openShiftWithPin({
      staff_uid: String(body.staff_uid ?? ""),
      display_name: body.display_name == null ? undefined : String(body.display_name),
      pos_id: body.pos_id == null ? undefined : String(body.pos_id),
      sccx_id: body.sccx_id == null ? undefined : String(body.sccx_id),
      shift_id: body.shift_id == null ? undefined : String(body.shift_id),
      pin: request.headers.get("x-shift-pin")?.trim() ?? "",
    });
    return json(result);
  } catch (error) {
    return toResponse(error);
  }
}
