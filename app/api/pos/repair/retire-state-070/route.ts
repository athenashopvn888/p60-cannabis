import { createHash } from "node:crypto";
import { safeEqual } from "@/app/lib/pny-pos/crypto";
import { json } from "@/app/lib/pny-pos/http";
import { sheetFromEnv } from "@/app/lib/pny-pos/sheets";
import type { SheetRow } from "@/app/lib/pny-pos/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKUP_TAB = "POS_State_Backup";

type Shift = {
  id?: string;
  store_code?: string;
  status?: string;
  end_reason?: string | null;
  pin_failed_attempts?: number;
  started_at?: string;
  ended_at?: string | null;
};
type Draft = {
  shift_id?: string;
  closing_started_at?: string | null;
  closing_submitted_at?: string | null;
  counts?: unknown[];
  final_deposit_cents?: number | null;
};
type Closing = { shift_id?: string; final_deposit_cents?: number | null };
type Parsed = { shifts?: Shift[]; closing_drafts?: Draft[]; closings?: Closing[]; balances?: { sku?: string; qty?: number; store_code?: string }[] };

function activeChunks(rows: SheetRow[]) {
  return rows
    .filter((row) => row.record_type === "STATE" && row.row_id?.startsWith("STATE-") && row.doc)
    .sort((a, b) => (a.row_id ?? "").localeCompare(b.row_id ?? ""));
}

function tryState(raw: string): Parsed | null {
  try {
    const value = JSON.parse(raw) as Parsed;
    if (!value || typeof value !== "object" || !Array.isArray(value.shifts)) return null;
    return value;
  } catch {
    return null;
  }
}

function summarize(parsed: Parsed) {
  const shifts = parsed.shifts ?? [];
  const describe = (store: string) => {
    const rows = shifts.filter((shift) => (shift.store_code ?? "PNY01") === store);
    const open = rows.find((shift) => shift.status !== "ENDED");
    const latest = [...rows].sort((a, b) => (b.ended_at || b.started_at || "").localeCompare(a.ended_at || a.started_at || ""))[0];
    const focus = open ?? latest;
    const draft = focus ? (parsed.closing_drafts ?? []).find((row) => row.shift_id === focus.id) : undefined;
    const closing = focus ? (parsed.closings ?? []).find((row) => row.shift_id === focus.id) : undefined;
    return {
      open: Boolean(open),
      status: focus?.status ?? null,
      end_reason: focus?.end_reason ?? null,
      pin_failed_attempts: focus?.pin_failed_attempts ?? null,
      closing_started: Boolean(draft?.closing_started_at),
      closing_submitted: Boolean(draft?.closing_submitted_at),
      counted_lines: Array.isArray(draft?.counts) ? draft.counts.length : 0,
      final_deposit_cents: closing?.final_deposit_cents ?? draft?.final_deposit_cents ?? null,
      shift_count: rows.length,
    };
  };
  const pny02Qty = (parsed.balances ?? []).filter((row) => row.store_code === "PNY02" && (row.qty ?? 0) > 0).length;
  return { pny01: describe("PNY01"), pny02: describe("PNY02"), pny02_stocked_skus: pny02Qty };
}

export async function POST(request: Request) {
  const secret = process.env.SHIFT_SECRET?.trim() ?? "";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!secret || !token || !safeEqual(token, secret)) return json({ ok: false, error: "unauthorized" }, 401);
  let confirm = "";
  try {
    confirm = ((await request.json()) as { confirm?: string }).confirm ?? "";
  } catch {
    confirm = "";
  }
  if (confirm !== "retire-STATE-070") return json({ ok: false, error: "confirmation required" }, 400);

  const sheet = sheetFromEnv();
  if (!sheet.configured) return json({ ok: false, error: "sheet is not configured" }, 500);
  const before = await sheet.readRows("POS_Staff");
  const chunks = activeChunks(before);
  const lengths = chunks.map((row) => ({ id: row.row_id, length: row.doc.length }));
  let keepCount = 0;
  let parsed: Parsed | null = null;
  for (let count = chunks.length; count >= 1; count -= 1) {
    const candidate = tryState(chunks.slice(0, count).map((row) => row.doc).join(""));
    const open = candidate?.shifts?.find((shift) => (shift.store_code ?? "PNY01") === "PNY01" && shift.status !== "ENDED");
    if (candidate && open) {
      parsed = candidate;
      keepCount = count;
      break;
    }
  }
  if (!parsed) return json({ ok: false, error: "no prefix kept an open PNY01 shift", chunks: lengths }, 409);
  const stale = chunks.slice(keepCount);
  const summary = summarize(parsed);
  if (stale.length === 0) return json({ ok: true, already: true, chunks: lengths.length, ...summary });

  await sheet.ensureTabs([{
    title: BACKUP_TAB,
    headers: ["backed_up_at", "row_id", "record_type", "doc_length", "sha256", "doc"],
  }]);
  const backedUp = stale.map((row) => {
    const sha256 = createHash("sha256").update(row.doc).digest("hex");
    return {
      backed_up_at: new Date().toISOString(),
      row_id: row.row_id ?? "",
      record_type: row.record_type ?? "STATE",
      doc_length: String(row.doc.length),
      sha256,
      doc: row.doc,
    };
  });
  await sheet.appendRows(BACKUP_TAB, backedUp, "sha256");
  const beforeDigest = createHash("sha256").update(chunks.slice(0, keepCount).map((row) => row.doc).join("")).digest("hex");
  await sheet.upsert("POS_Staff", stale.map((row) => ({
    row_id: row.row_id ?? "",
    record_type: "STATE_RETIRED",
    staff_uid: "",
    sccx_id: "",
    pos_id: "",
    display_name: "",
    active: "",
    updated_at: "",
    created_at: "",
    doc: "",
  })));

  const after = activeChunks(await sheet.readRows("POS_Staff"));
  const afterDigest = createHash("sha256").update(after.map((row) => row.doc).join("")).digest("hex");
  const afterParsed = tryState(after.map((row) => row.doc).join(""));
  return json({
    ok: Boolean(afterParsed) && afterDigest === beforeDigest && after.length === keepCount,
    retired: backedUp.map((row) => ({ id: row.row_id, length: Number(row.doc_length), sha256: row.sha256 })),
    kept_chunks: keepCount,
    chunks_unchanged: afterDigest === beforeDigest,
    parses: Boolean(afterParsed),
    ...(afterParsed ? summarize(afterParsed) : summary),
  });
}
