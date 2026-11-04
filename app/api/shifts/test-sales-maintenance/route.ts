import { assertSecret, json, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { PosError } from "@/app/lib/pny-pos/errors";
import { getService, loadSecrets } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSecret(request.headers.get("x-shift-secret"), loadSecrets().shift);
    const body = await readBody(request);
    if (body.op !== "preview") throw new PosError(400, "BAD_OP", "Only preview is enabled.");
    const refs = Array.isArray(body.ref_nos) ? body.ref_nos.map(String) : [];
    return json(await (await getService()).previewTriTestSales(refs));
  } catch (error) {
    return toResponse(error);
  }
}
