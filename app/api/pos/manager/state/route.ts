import { json, managerToken, toResponse } from "@/app/lib/pny-pos/http";
import { readManagerStoreSnapshot } from "@/app/lib/pny-pos/managerSnapshot";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = await managerToken();
    if (!token) return json({ authenticated: false }, 401);
    const requested = new URL(request.url).searchParams.get("store")?.toUpperCase();
    const storeCode = requested === "PNY01" ? "PNY01" : "PNYS";
    return json(await (await getService()).managerState(
      token,
      storeCode,
      storeCode === "PNY01" ? () => readManagerStoreSnapshot("PNY01") : undefined,
    ));
  } catch (error) {
    return toResponse(error);
  }
}
