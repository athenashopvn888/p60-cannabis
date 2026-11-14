import { json, kitchenToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await kitchenToken();
    if (!token) return json({ authenticated: false }, 401);
    return json(await (await getService()).kitchenState(token));
  } catch (error) {
    return toResponse(error);
  }
}
