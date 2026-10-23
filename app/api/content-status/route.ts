import { NextResponse } from "next/server";
import { getCigaretteSnapshot, toPublicCigaretteState } from "../../lib/cigaretteFeed";
import { getFleetContent } from "../../lib/fleetContent";
import { contentStatusPayload } from "../../lib/fleet/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnostic only. Publish verification reads the page marker, not this route. */
export async function GET() {
  const [fleet, cig] = await Promise.all([getFleetContent(), getCigaretteSnapshot()]);
  const published = toPublicCigaretteState(cig);
  const payload = contentStatusPayload(fleet, {
    web: published.web,
    tv: published.tv,
    guides: cig.guides.show,
  });
  return NextResponse.json({
    ...payload,
    manifest: fleet.active ? "ok" : "err",
    mode: fleet.active ? "sheet" : "coded",
  }, { headers: { "Cache-Control": "no-store" } });
}
