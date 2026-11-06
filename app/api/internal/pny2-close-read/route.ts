import { json, toResponse } from "@/app/lib/pny-pos/http";
import { pny2CloseReport, readSheetState } from "@/app/lib/pny-pos/pny2CloseRead";
import { PosError } from "@/app/lib/pny-pos/errors";
import { safeEqual } from "@/app/lib/pny-pos/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Temporary read of the PNY02 close. Does not write the sheet or any store. */
export async function GET(request: Request) {
  try {
    const expected = process.env.PNY_READ_TOKEN?.trim() ?? "";
    const got = request.headers.get("x-read-token")?.trim() ?? "";
    if (!expected || !got || !safeEqual(got, expected)) throw new PosError(401, "UNAUTHORIZED", "Unauthorized.");
    if (process.env.PNY_SHEET_READ_ONLY !== "1") throw new PosError(409, "READ_ONLY", "Refusing to read unless the sheet is marked read only.");
    const state = await readSheetState();
    return json(pny2CloseReport(state));
  } catch (error) {
    return toResponse(error);
  }
}
