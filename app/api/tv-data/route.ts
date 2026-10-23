import { NextResponse } from "next/server";
import { getCigaretteSnapshot, reconcileSurfaceItems, snapshotHeaders } from "../../lib/cigaretteFeed";
import { allFlowers, allItems } from "../../lib/products";
import { getTvData } from "../../lib/tvStock";

export const runtime = "nodejs";

// The handler runs every time. Cigarette on/off is re-read about every 60s
// inside the shared feed cache. This response itself is not cached.
export const revalidate = 0;

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") || "flowers";
  const snap = await getCigaretteSnapshot();
  const cigHeaders = snapshotHeaders(snap);

  const { body, headers } = await getTvData({
    type,
    staticFlowers: allFlowers,
    staticItems: allItems,
  });

  let payload = body;
  if (type === "items" && Array.isArray(body)) {
    payload = reconcileSurfaceItems(body, snap.items, snap.tv.show);
    headers["x-tv-data-item-count"] = String(payload.length);
  }

  return NextResponse.json(payload, { headers: { ...headers, ...cigHeaders } });
}
