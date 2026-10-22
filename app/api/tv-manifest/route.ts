import { NextResponse } from "next/server";
import { getFleetContent, tvManifestDecision } from "../../lib/fleetContent";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const fleet = await getFleetContent();
  const decision = tvManifestDecision(fleet, request.headers.get("if-none-match"));
  const headers = {
    ETag: decision.etag,
    "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  };
  if (decision.status === 304) return new NextResponse(null, { status: 304, headers });
  return NextResponse.json(decision.body, { headers });
}
