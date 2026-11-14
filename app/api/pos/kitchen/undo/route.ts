import { json, kitchenToken, readBody, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const service = await getService();
    return json(await service.kitchenUndo(await kitchenToken(), {
      batch_id: String(body.batch_id ?? ""),
      confirm: body.confirm === true,
    }));
  } catch (error) {
    return toResponse(error);
  }
}
