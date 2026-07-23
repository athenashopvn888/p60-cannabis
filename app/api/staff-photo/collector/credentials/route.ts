import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { publicError, readStaffState } from "@/app/lib/staffPhotoStore";
import { STORE_CODE, STORE_NAME } from "@/app/lib/staffPhotoCore";
import { currentDailyPin } from "@/app/lib/staffPhotoPin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyBearer(request, process.env.PNY_STAFF_RETRIEVAL_TOKEN)) return Response.json({ ok: false }, { status: 401 });
  try {
    const state = await readStaffState();
    const credentials = currentDailyPin(state.pinVersion);
    return Response.json({ ok: true, store: { code: STORE_CODE, name: STORE_NAME }, loginUrl: `${new URL(request.url).origin}/staff-photo`, pin: credentials.pin, pinVersion: state.pinVersion, operationalDay: credentials.dayKey, validFrom: credentials.validFrom.toISOString(), validUntil: credentials.validUntil.toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return publicError(error); }
}
