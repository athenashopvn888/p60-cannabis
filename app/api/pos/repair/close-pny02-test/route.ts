import { createHash, randomUUID } from "node:crypto";
import { sha256 } from "@/app/lib/pny-pos/crypto";
import { safeEqual } from "@/app/lib/pny-pos/crypto";
import { json } from "@/app/lib/pny-pos/http";
import { getService } from "@/app/lib/pny-pos/runtime";
import { activeStateChunks, reportStore, tryState, type ParsedState } from "@/app/lib/pny-pos/shiftReport";
import { sheetFromEnv } from "@/app/lib/pny-pos/sheets";
import type { SheetDb } from "@/app/lib/pny-pos/sheetStore";
import { runStore } from "@/app/lib/pny-pos/storeContext";
import { PNY02_STORE } from "@/app/lib/pny-pos/storeProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKUP_TAB = "POS_State_Backup";

function authorized(request: Request) {
  const secret = process.env.SHIFT_SECRET?.trim() ?? "";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return Boolean(secret && token && safeEqual(token, secret));
}

function balanceKey(parsed: ParsedState) {
  const rows = (parsed.balances ?? [])
    .filter((row) => !row.store_code || row.store_code === "PNY01")
    .map((row) => [row.sku ?? "", row.qty ?? 0] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ ok: false, error: "unauthorized" }, 401);
  let confirm = "";
  try {
    confirm = ((await request.json()) as { confirm?: string }).confirm ?? "";
  } catch {
    confirm = "";
  }
  if (confirm !== "close-pny02-test") return json({ ok: false, error: "confirmation required" }, 400);

  const sheet = sheetFromEnv();
  if (!sheet.configured) return json({ ok: false, error: "sheet is not configured" }, 500);
  const chunks = activeStateChunks(await sheet.readRows("POS_Staff"));
  const parsed = tryState(chunks.map((row) => row.doc).join(""));
  if (!parsed) return json({ ok: false, error: "state does not parse; PNY02 was left open" }, 409);
  const pny01 = reportStore(parsed, "PNY01");
  if (!pny01.closed || pny01.open_shifts.length > 0) {
    return json({ ok: false, error: "PNY01 is not closed", pny01 }, 409);
  }
  const pny02before = reportStore(parsed, "PNY02");
  if (pny02before.closed && pny02before.open_shifts.length === 0) {
    return json({ ok: true, already: true, pny01, pny02: pny02before });
  }

  const backed: { id: string; length: number; sha256: string }[] = [];
  await sheet.ensureTabs([{
    title: BACKUP_TAB,
    headers: ["backed_up_at", "row_id", "record_type", "doc_length", "sha256", "doc"],
  }]);
  for (let index = 0; index < chunks.length; index += 10) {
    const batch = chunks.slice(index, index + 10).map((row) => {
      const hash = createHash("sha256").update(row.doc).digest("hex");
      backed.push({ id: row.row_id ?? "", length: row.doc.length, sha256: hash });
      return {
        backed_up_at: new Date().toISOString(),
        row_id: `${row.row_id}-pny02-close`,
        record_type: "STATE",
        doc_length: String(row.doc.length),
        sha256: hash,
        doc: row.doc,
      };
    });
    await sheet.appendRows(BACKUP_TAB, batch, "sha256");
  }

  const beforeKey = balanceKey(parsed);
  const service = await getService();
  const db = (service as unknown as { db: SheetDb }).db;
  const token = randomUUID();
  const deposit = pny02before.draft_final_deposit_cents ?? 0;
  await db.transaction(async (tx) => {
    const shift = tx.state.shifts.find((row) => row.store_code === "PNY02" && row.status !== "ENDED");
    if (!shift) return;
    tx.state.sessions.push({
      id: randomUUID(),
      shift_id: shift.id,
      token_hash: sha256(token),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      revoked_at: null,
      created_at: new Date().toISOString(),
    });
  });
  const closed = await runStore(PNY02_STORE, () => service.endShiftFromPos(token, {
    key: "close-pny02-test-2026-11-05",
    lines: [],
    final_deposit_cents: deposit,
  }));

  const afterChunks = activeStateChunks(await sheet.readRows("POS_Staff"));
  const after = tryState(afterChunks.map((row) => row.doc).join(""));
  const afterKey = after ? balanceKey(after) : "";
  return json({
    ok: Boolean(after) && afterKey === beforeKey,
    parses: Boolean(after),
    backup_rows: backed.length,
    pny01_stock_unchanged: afterKey === beforeKey,
    deposit_cents: deposit,
    close: { message: (closed as { message?: string }).message ?? "", summary_text: (closed as { summary_text?: string }).summary_text ?? "" },
    pny01: after ? reportStore(after, "PNY01") : null,
    pny02: after ? reportStore(after, "PNY02") : null,
  });
}
