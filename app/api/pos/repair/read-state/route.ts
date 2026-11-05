import { createHash } from "node:crypto";
import { safeEqual } from "@/app/lib/pny-pos/crypto";
import { json } from "@/app/lib/pny-pos/http";
import { activeStateChunks, reportStore, tryState } from "@/app/lib/pny-pos/shiftReport";
import { sheetFromEnv } from "@/app/lib/pny-pos/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.SHIFT_SECRET?.trim() ?? "";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return Boolean(secret && token && safeEqual(token, secret));
}

export async function GET(request: Request) {
  if (!authorized(request)) return json({ ok: false, error: "unauthorized" }, 401);
  const sheet = sheetFromEnv();
  if (!sheet.configured) return json({ ok: false, error: "sheet is not configured" }, 500);
  const chunks = activeStateChunks(await sheet.readRows("POS_Staff"));
  const joined = chunks.map((row) => row.doc).join("");
  const parsed = tryState(joined);
  return json({
    ok: Boolean(parsed),
    parses: Boolean(parsed),
    chunks: chunks.map((row) => ({ id: row.row_id, length: row.doc.length, sha256: createHash("sha256").update(row.doc).digest("hex") })),
    pny01: parsed ? reportStore(parsed, "PNY01") : null,
    pny02: parsed ? reportStore(parsed, "PNY02") : null,
  });
}
