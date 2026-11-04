import { assertSecret, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { PosError } from "@/app/lib/pny-pos/errors";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List sales on one shift, or void the sale when it is the only one. */
export async function POST(request: Request) {
  try {
    assertSecret(request.headers.get("x-shift-secret"), loadSecrets().shift);
    const body = await readBody(request);
    const service = await getService();
    const shiftId = String(body.shift_id ?? "");
    if (body.op === "list") return json(await service.listShiftSales(shiftId));
    if (body.op === "void-only") return json(await service.voidOnlyShiftSale(shiftId, String(body.reason ?? "Re-ring for SCCx")));
    if (body.op === "backup-goose") return json(await service.exportGooseCartonSale(shiftId));
    if (body.op === "void-goose") return json(await service.voidGooseCartonSale(shiftId, String(body.reason ?? "Re-ring Goose cartons for SCCx")));
    throw new PosError(400, "BAD_OP", "op must be list, void-only, backup-goose, or void-goose.");
  } catch (error) {
    return toResponse(error);
  }
}
