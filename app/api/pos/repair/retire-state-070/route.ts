import { createHash } from "node:crypto";
import { safeEqual } from "@/app/lib/pny-pos/crypto";
import { json } from "@/app/lib/pny-pos/http";
import { sheetFromEnv } from "@/app/lib/pny-pos/sheets";
import type { SheetRow } from "@/app/lib/pny-pos/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKUP_TAB = "POS_State_Backup";
const KEEP = Array.from({ length: 70 }, (_, index) => `STATE-${String(index).padStart(3, "0")}`);

function chunks(rows: SheetRow[]) {
  return rows
    .filter((row) => row.record_type === "STATE" && row.row_id?.startsWith("STATE-") && row.doc)
    .sort((a, b) => a.row_id.localeCompare(b.row_id));
}

function digest(rows: SheetRow[]) {
  return rows.map((row) => `${row.row_id}:${createHash("sha256").update(row.doc).digest("hex")}:${row.doc.length}`).join("\n");
}

function shiftSummary(raw: string) {
  const parsed = JSON.parse(raw) as {
    shifts?: { id?: string; store_code?: string; status?: string; pin_failed_attempts?: number }[];
    closing_drafts?: { shift_id?: string; closing_started_at?: string | null; closing_submitted_at?: string | null; counts?: unknown[] }[];
  };
  const open = (parsed.shifts ?? []).find((shift) => shift.store_code === "PNY01" && shift.status !== "ENDED");
  const draft = open ? (parsed.closing_drafts ?? []).find((row) => row.shift_id === open.id) : undefined;
  return {
    open_status: open?.status ?? null,
    pin_failed_attempts: open?.pin_failed_attempts ?? null,
    closing_started: Boolean(draft?.closing_started_at),
    closing_submitted: Boolean(draft?.closing_submitted_at),
    counted_lines: Array.isArray(draft?.counts) ? draft.counts.length : 0,
  };
}

export async function POST(request: Request) {
  const secret = process.env.SHIFT_SECRET?.trim() ?? "";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!secret || !token || !safeEqual(token, secret)) return json({ ok: false, error: "unauthorized" }, 401);
  let confirm = "";
  try {
    const body = (await request.json()) as { confirm?: string };
    confirm = body.confirm ?? "";
  } catch {
    confirm = "";
  }
  if (confirm !== "retire-STATE-070") return json({ ok: false, error: "confirmation required" }, 400);

  const sheet = sheetFromEnv();
  if (!sheet.configured) return json({ ok: false, error: "sheet is not configured" }, 500);
  const before = await sheet.readRows("POS_Staff");
  const active = chunks(before);
  const keep = active.filter((row) => row.row_id !== "STATE-070");
  const stale = active.filter((row) => row.row_id === "STATE-070");
  if (keep.map((row) => row.row_id).join() !== KEEP.join()) {
    return json({ ok: false, error: "chunks 000-069 are not intact", count: keep.length }, 409);
  }
  const joined = keep.map((row) => row.doc).join("");
  let summary;
  try {
    summary = shiftSummary(joined);
  } catch {
    return json({ ok: false, error: "chunks 000-069 did not parse; STATE-070 was left in place" }, 409);
  }
  if (!summary.open_status) {
    return json({ ok: false, error: "no open PNY01 shift in chunks 000-069; STATE-070 was left in place" }, 409);
  }
  if (stale.length === 0) {
    return json({ ok: true, already: true, pny01: summary });
  }
  if (stale.length !== 1) return json({ ok: false, error: "more than one STATE-070 row", found: stale.length }, 409);

  const backupDoc = stale[0].doc;
  const sha256 = createHash("sha256").update(backupDoc).digest("hex");
  await sheet.ensureTabs([{
    title: BACKUP_TAB,
    headers: ["backed_up_at", "row_id", "record_type", "doc_length", "sha256", "doc"],
  }]);
  await sheet.appendRows(BACKUP_TAB, [{
    backed_up_at: new Date().toISOString(),
    row_id: "STATE-070",
    record_type: stale[0].record_type ?? "STATE",
    doc_length: String(backupDoc.length),
    sha256,
    doc: backupDoc,
  }], "sha256");

  const beforeDigest = digest(keep);
  await sheet.upsert("POS_Staff", [{
    row_id: "STATE-070",
    record_type: "STATE_RETIRED",
    staff_uid: "",
    sccx_id: "",
    pos_id: "",
    display_name: "",
    active: "",
    updated_at: "",
    created_at: "",
    doc: "",
  }]);

  const after = await sheet.readRows("POS_Staff");
  const afterActive = chunks(after);
  const afterKeep = afterActive.filter((row) => row.row_id !== "STATE-070");
  const retired = after.find((row) => row.row_id === "STATE-070");
  const unchanged = digest(afterKeep) === beforeDigest;
  let parses = false;
  try {
    JSON.parse(afterKeep.map((row) => row.doc).join(""));
    parses = true;
  } catch {
    parses = false;
  }
  return json({
    ok: unchanged && parses && retired?.record_type === "STATE_RETIRED" && !retired.doc,
    backup: { tab: BACKUP_TAB, length: backupDoc.length, sha256 },
    chunks_unchanged: unchanged,
    parses,
    retired: { record_type: retired?.record_type ?? "", doc_length: retired?.doc?.length ?? -1 },
    pny01: summary,
  });
}
