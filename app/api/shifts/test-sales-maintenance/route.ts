import { assertSecret, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { PosError } from "@/app/lib/pny-pos/errors";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSecret(request.headers.get("x-shift-secret"), loadSecrets().shift);
    const body = await readBody(request);
    const refs = Array.isArray(body.ref_nos) ? body.ref_nos.map(String) : [];
    const service = await getService();
    if (body.op === "preview") return json(await service.previewTriTestSales(refs));
    if (body.op === "void-approved") return json(await service.voidApprovedTriTestSales(refs, String(body.reason ?? "Owner-approved test sale")));
    throw new PosError(400, "BAD_OP", "Unsupported maintenance operation.");
  } catch (error) {
    return toResponse(error);
  }
}
