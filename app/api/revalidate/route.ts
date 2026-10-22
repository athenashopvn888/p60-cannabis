import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { FLEET_AFFECTED_PATHS, FLEET_CONTENT_TAG, resetFleetContentCache } from "../../lib/fleetContent";
import { FLEET_DYNAMIC_PATHS } from "../../lib/fleet/routes";
import { revalidateAuthorized } from "../../lib/fleet/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const provided = request.headers.get("x-fleet-revalidate-secret");
  if (!revalidateAuthorized(provided)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  resetFleetContentCache();
  revalidateTag(FLEET_CONTENT_TAG, "max");
  for (const path of FLEET_AFFECTED_PATHS) revalidatePath(path);
  for (const path of FLEET_DYNAMIC_PATHS) revalidatePath(path, "page");
  return NextResponse.json({ ok: true, paths: FLEET_AFFECTED_PATHS.length });
}
