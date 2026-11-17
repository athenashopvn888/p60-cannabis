import { json, staffToken, toResponse } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const token = await staffToken();
    if (!token) return json({ error: "Sign in again." }, 401);
    return json(await (await getService()).startClosingRedo(token));
  } catch (error) {
    return toResponse(error);
  }
}
