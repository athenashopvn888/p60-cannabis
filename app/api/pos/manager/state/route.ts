import { json, managerToken, toResponse } from "@/app/lib/pny-pos/http";
import { readManagerStoreSnapshot } from "@/app/lib/pny-pos/managerSnapshot";
import { exposeManagerStore, resolveManagerStoreRoute } from "@/app/lib/pny-pos/managerStoreView";
import { getService } from "@/app/lib/pny-pos/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = await managerToken();
    if (!token) return json({ authenticated: false }, 401);
    const requested = new URL(request.url).searchParams.get("store")?.toUpperCase();
    const route = resolveManagerStoreRoute(requested, {
      vercelEnv: process.env.VERCEL_ENV,
      testStore: process.env.NEXT_PUBLIC_TEST_STORE,
    });
    const view = await (await getService()).managerState(
      token,
      route.internalStore,
      route.useRetainedSnapshot ? () => readManagerStoreSnapshot("PNY01") : undefined,
    );
    return json(exposeManagerStore(view, route));
  } catch (error) {
    return toResponse(error);
  }
}
