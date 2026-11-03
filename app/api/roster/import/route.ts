import { assertSecret, idempotencyKey, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";
import { PosError } from "@/app/lib/pny-pos/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    assertSecret(request.headers.get("x-roster-secret"), loadSecrets().roster);
    if (!Array.isArray(body.staff)) throw new PosError(400, "STAFF", "staff array is required.");
    const staff = body.staff.map((person) => {
      const row = person as Record<string, unknown>;
      return {
        staff_uid: String(row.staff_uid ?? ""),
        sccx_id: row.sccx_id == null ? undefined : String(row.sccx_id),
        pos_id: row.pos_id == null ? undefined : String(row.pos_id),
        display_name: row.display_name == null ? undefined : String(row.display_name),
        active: row.active == null ? undefined : Boolean(row.active),
      };
    });
    const service = await getService();
    return json(await service.importRoster({ key: idempotencyKey(request, body), staff }));
  } catch (error) {
    return toResponse(error);
  }
}
