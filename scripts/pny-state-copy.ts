/**
 * PNY01 opening copy. Dry-run unless PNY_STATE_COPY=after-close and --apply.
 * Reads the last closing count. Does not write the Google sheet.
 *
 * Dry run:
 *   node scripts/pny-state-copy.ts --store=PNY01
 *   node scripts/pny-state-copy.ts --store=PNY01 --snapshot=/path/to/pny01-close.json
 *
 * Apply only after Tri approves, with the pny01_till database URL in the environment:
 *   PNY_STATE_COPY=after-close node scripts/pny-state-copy.ts --store=PNY01 --apply
 */
import { readFileSync } from "node:fs";
import { bagLabel } from "../app/lib/pny-pos/flowerSku.ts";
import { emptyState } from "../app/lib/pny-pos/memory.ts";
import { quoteForSku } from "../app/lib/pny-pos/sizePrice.ts";
import { sheetFromEnv } from "../app/lib/pny-pos/sheets.ts";

type Line = { sku: string; name: string; qty: number; price_cents: number | null };

const store = (process.argv.find((arg) => arg.startsWith("--store="))?.split("=")[1] ?? "PNY01").toUpperCase();
const apply = process.argv.includes("--apply");
const snapshot = process.argv.find((arg) => arg.startsWith("--snapshot="))?.split("=")[1];
const allowed = process.env.PNY_STATE_COPY === "after-close";

function sizeOf(sku: string, name: string) {
  return bagLabel(sku) || (name.match(/\b(3g|5g|6g|14g|28g)\b/i)?.[1] ?? "").toLowerCase();
}

function fromSnapshot(path: string): { lines: Line[]; float_cents: number; source: string } {
  const body = JSON.parse(readFileSync(path, "utf8")) as {
    pny01?: { counted?: { sku: string; name: string; counted_qty: number }[]; accepted?: { sku: string; name: string; qty: number }[]; final_deposit_cents?: number };
    float_cents?: number;
  };
  const block = body.pny01;
  if (!block) throw new Error("Snapshot has no pny01 closing count.");
  const lines: Line[] = [];
  for (const row of block.counted ?? []) lines.push({ sku: row.sku, name: row.name, qty: row.counted_qty, price_cents: quoteForSku(row.sku)?.cents ?? null });
  for (const row of block.accepted ?? []) lines.push({ sku: row.sku, name: row.name, qty: row.qty, price_cents: quoteForSku(row.sku)?.cents ?? null });
  return { lines, float_cents: body.float_cents ?? 0, source: `snapshot ${path}` };
}

async function fromSheet(): Promise<{ lines: Line[]; float_cents: number; source: string }> {
  const sheet = sheetFromEnv();
  if (!sheet.configured) throw new Error("Sheet credentials are not configured. Pass --snapshot or set the read-only sheet env.");
  const rows = await sheet.readRows("POS_Staff");
  const parts = rows.filter((row) => row.record_type === "STATE" && String(row.row_id ?? "").startsWith("STATE-") && row.doc);
  if (parts.length === 0) throw new Error("POS_Staff has no state.");
  const state = JSON.parse(parts.sort((a, b) => String(a.row_id).localeCompare(String(b.row_id))).map((row) => row.doc).join("")) as {
    shifts?: { id: string; store_code?: string; status: string; ended_at?: string | null; float_cents?: number }[];
    closings?: { shift_id: string; float_cents?: number; closing_lines?: { sku: string; name: string; left: number; price_cents?: number }[] }[];
  };
  const shifts = (state.shifts ?? []).filter((row) => (row.store_code ?? "PNY01") === "PNY01" && row.status === "ENDED");
  const latest = shifts.sort((a, b) => String(b.ended_at ?? "").localeCompare(String(a.ended_at ?? "")))[0];
  if (!latest) throw new Error("PNY01 has no ended shift on the sheet.");
  const closing = (state.closings ?? []).find((row) => row.shift_id === latest.id);
  if (!closing) throw new Error("PNY01's last ended shift has no closing count.");
  const lines = (closing.closing_lines ?? []).map((row) => ({
    sku: row.sku,
    name: row.name,
    qty: row.left,
    price_cents: row.price_cents && row.price_cents > 0 ? row.price_cents : quoteForSku(row.sku)?.cents ?? null,
  }));
  return { lines, float_cents: closing.float_cents ?? latest.float_cents ?? 0, source: "sheet POS_Staff read" };
}

const loaded = snapshot ? fromSnapshot(snapshot) : await fromSheet();
const lines = loaded.lines.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
const units = lines.reduce((sum, row) => sum + row.qty, 0);
const missing = lines.filter((row) => row.price_cents == null || row.price_cents <= 0);
const report = [
  `PNY01 opening dry-run. Source: ${loaded.source}.`,
  `Last closing becomes opening stock. No open shift. Float $${(loaded.float_cents / 100).toFixed(2)}.`,
  `SKU count ${lines.length}. Total units ${units}. Missing a price: ${missing.length}.`,
  "",
  ...lines.map((row) => `${row.sku}\t${sizeOf(row.sku, row.name) || "-"}\t${row.qty}\t${row.name}`),
];
if (missing.length) {
  report.push("", "Missing a price:");
  for (const row of missing) report.push(`${row.sku}\t${row.name}`);
}
console.log(report.join("\n"));

if (!apply || !allowed || store !== "PNY01") {
  console.log("\nNo database write. To apply after Tri approves: PNY_STATE_COPY=after-close node scripts/pny-state-copy.ts --store=PNY01 --apply");
  process.exit(0);
}

const url = process.env.POS_SUPABASE_DB_URL?.trim() ?? "";
if (!url) throw new Error("POS_SUPABASE_DB_URL is required to apply.");
const { Pool } = await import("pg");
const pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  await client.query("begin");
  const current = await client.query(`select doc from pny_pos.live_state where store_code = 'PNY01'`);
  const doc = emptyState();
  const previous = current.rows[0]?.doc;
  if (previous && Array.isArray(previous.staff)) doc.staff = previous.staff;
  const at = new Date().toISOString();
  doc.opening_stock_at = at;
  for (const row of lines) {
    doc.balances.push({ sku: row.sku, qty: row.qty, store_code: "PNY01", updated_at: at, created_at: at });
  }
  await client.query(
    `update pny_pos.live_state set doc = $1::jsonb, version = version + 1, updated_at = now() where store_code = 'PNY01'`,
    [JSON.stringify(doc)],
  );
  await client.query("commit");
  console.log("Applied PNY01 opening stock. The sheet was not written.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
