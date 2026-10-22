import { NextResponse } from "next/server";
import { getCigaretteSnapshot } from "../../lib/cigaretteFeed";
import { getFleetContent } from "../../lib/fleetContent";
import { contentStatusPayload } from "../../lib/fleet/status";
import { SHOW_CIGARETTES } from "../../lib/siteConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnostic only. Publish verification reads the page marker, not this route. */
export async function GET() {
  const [fleet, cig] = await Promise.all([getFleetContent(), getCigaretteSnapshot()]);
  const payload = contentStatusPayload(fleet, {
    web: SHOW_CIGARETTES && cig.web.show,
    tv: SHOW_CIGARETTES && cig.tv.show,
    guides: SHOW_CIGARETTES && cig.guides.show,
  });
  return NextResponse.json({
    ...payload,
    manifest: fleet.active ? "ok" : "err",
    mode: fleet.active ? "sheet" : "coded",
  }, { headers: { "Cache-Control": "no-store" } });
}
