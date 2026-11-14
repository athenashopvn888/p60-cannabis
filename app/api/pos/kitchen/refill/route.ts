import { json, kitchenToken, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const lines = Array.isArray(body.lines)
      ? body.lines.map((line) => {
          const row = (line ?? {}) as Record<string, unknown>;
          return { sku: String(row.sku ?? ""), size: row.size == null ? "" : String(row.size), qty: Number(row.qty) };
        })
      : undefined;
    const service = await getService();
    return json(await service.kitchenRefill(await kitchenToken(), {
      text: typeof body.text === "string" ? body.text : undefined,
      lines,
      batch_id: typeof body.batch_id === "string" ? body.batch_id : undefined,
      confirm: body.confirm === true,
    }));
  } catch (error) {
    return toResponse(error);
  }
}
