import { json, managerToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await managerToken();
    if (!token) return json({ authenticated: false }, 401);
    return json(await (await getService()).managerState(token));
  } catch (error) {
    return toResponse(error);
  }
}
