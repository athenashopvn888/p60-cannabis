import { verifyVercelOidcToken } from "@vercel/oidc";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_ID = "prj_YxPnreV6iBh3AZIrTKKUK1z9tnuJ";
const OWNER_ID = "team_IqYig3d4WKblBzRjJ50L7GEc";
const CHANNELS = ["SCCX_FEED", "SCCX_ACK", "SIGNAL", "SHEET_OUTBOX", "SHEET_IMPORT", "STOCK_SNAPSHOT", "SETB_SYNC"];

type CutoverBody = {
  cutover_id: string;
  products: Array<Record<string, unknown> & { sku: string }>;
  store_products: Array<Record<string, unknown> & { sku: string }>;
  balances: Array<Record<string, unknown> & { sku: string; qty: number }>;
  staff: Array<Record<string, unknown> & { staff_uid: string }>;
  yogi_shift: Record<string, unknown> & { id: string; staff_uid: string; pin_hash: string; pin_expires_at: string };
};

async function authorize(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Error("Unauthorized");
  await verifyVercelOidcToken(header.slice(7), {
    projectId: PROJECT_ID,
    ownerId: OWNER_ID,
    environment: ["production", "development"],
  });
}

function pool() {
  const connectionString = process.env.POS_SUPABASE_DB_URL;
  if (!connectionString) throw new Error("POS database is unavailable");
  return new Pool({ connectionString, max: 1, ssl: { rejectUnauthorized: false } });
}

export async function GET(request: Request) {
  try {
    await authorize(request);
    const db = pool();
    const client = await db.connect();
    try {
      const [state, runtime, owners] = await Promise.all([
        client.query("select version,doc from pnys_pos.live_state where store_code='PNYS'"),
        client.query("select store_code,write_mode,generation,cutover_id from pos_hub.store_runtime where store_code in ('PNY01','PNYS') order by store_code"),
        client.query("select channel,owner_store_code,generation,enabled,cutover_id from pos_hub.integration_owner order by channel"),
      ]);
      return Response.json({ ok: true, state: state.rows[0], runtime: runtime.rows, owners: owners.rows }, { headers: { "cache-control": "no-store" } });
    } finally {
      client.release();
      await db.end();
    }
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  const db = pool();
  const client = await db.connect();
  try {
    await authorize(request);
    const body = await request.json() as CutoverBody;
    if (!/^PNYS-CUTOVER-\d{8}T\d{6}Z$/.test(body.cutover_id)) throw new Error("Invalid cutover id");
    if (body.products.length < 200 || body.store_products.length < 200 || body.balances.length < 200) throw new Error("Catalog payload is incomplete");
    if (new Set(body.products.map((row) => row.sku)).size !== body.products.length) throw new Error("Duplicate product SKU");
    if (body.balances.some((row) => !Number.isInteger(row.qty) || row.qty < 0)) throw new Error("Invalid stock quantity");
    if (!body.yogi_shift.pin_hash || !body.yogi_shift.pin_expires_at) throw new Error("Yogi shift PIN hash is missing");

    await client.query("begin");
    await client.query(`create table if not exists pnys_pos.cutover_backup (
      cutover_id text primary key,
      live_state_version bigint not null,
      live_state_doc jsonb not null,
      runtime_rows jsonb not null,
      owner_rows jsonb not null,
      created_at timestamptz not null default now(),
      created_by text not null
    )`);
    const current = await client.query("select version,doc from pnys_pos.live_state where store_code='PNYS' for update");
    if (current.rowCount !== 1) throw new Error("PNYS live state is missing");
    const runtimeBefore = await client.query("select * from pos_hub.store_runtime where store_code in ('PNY01','PNYS') order by store_code for update");
    const ownersBefore = await client.query("select * from pos_hub.integration_owner order by channel for update");
    if (ownersBefore.rowCount !== 7) throw new Error("Expected seven integration owner rows");
    await client.query(
      "insert into pnys_pos.cutover_backup(cutover_id,live_state_version,live_state_doc,runtime_rows,owner_rows,created_by) values($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,'Codex for Tri') on conflict(cutover_id) do nothing",
      [body.cutover_id, current.rows[0].version, JSON.stringify(current.rows[0].doc), JSON.stringify(runtimeBefore.rows), JSON.stringify(ownersBefore.rows)],
    );

    const now = new Date().toISOString();
    const next = current.rows[0].doc as Record<string, unknown>;
    const existingStores = Array.isArray(next.stores) ? next.stores as Array<Record<string, unknown>> : [];
    next.stores = [{
      ...(existingStores.find((row) => row.code === "PNYS") ?? {}),
      code: "PNYS", name: "PNY01 · P60 Cannabis", active: true, timezone: "America/Toronto",
      prices_tax_included: true, opening_count_required: false, closing_count_required: true,
      weed_in_store: true,
    }];
    next.products = body.products;
    next.store_products = body.store_products.map((row) => ({ ...row, store_code: "PNYS", updated_at: now }));
    next.balances = body.balances.map((row) => ({ ...row, store_code: "PNYS", updated_at: now }));
    next.staff = body.staff;
    next.shifts = [{
      ...body.yogi_shift,
      store_code: "PNYS", status: "ACTIVE", started_at: now, ended_at: null, end_reason: null,
      opening_count_required: false, opening_confirmed_at: now, refill_confirmed_at: now,
      pin_failed_attempts: 0, created_at: now,
    }];
    for (const key of ["sessions", "incoming", "refill_receipts", "stock_requests", "counts", "count_lines", "tickets", "ticket_lines", "sales", "sale_lines", "deposits", "closings", "closing_versions", "closing_drafts", "idempotency", "outbox", "cursors", "admin_sessions"]) next[key] = [];
    next.ledger = body.balances.filter((row) => row.qty > 0).map((row) => ({
      id: crypto.randomUUID(), sku: row.sku, qty_delta: row.qty, movement_type: "OPENING_BALANCE",
      ref_type: "cutover", ref_id: body.cutover_id, actor: "Codex for Tri", reason: "PNY01 final closing stock",
      shift_id: null, store_code: "PNYS", created_at: now,
    }));
    next.audit = [...(Array.isArray(next.audit) ? next.audit : []), {
      id: crypto.randomUUID(), action: "PNYS_CUTOVER", ref_type: "cutover", ref_id: body.cutover_id,
      actor: "Codex for Tri", detail: { products: body.products.length, balances: body.balances.length, active_staff: "Yogi", opening_count_required: false }, created_at: now,
    }];
    next.opening_stock_at = now;

    await client.query("update pos_hub.store_runtime set write_mode='ARCHIVE_READ_ONLY',generation=2,cutover_id=$1,changed_at=now(),changed_by='Codex for Tri' where store_code='PNY01'", [body.cutover_id]);
    await client.query("update pos_hub.store_runtime set write_mode='ACTIVE',generation=2,cutover_id=$1,changed_at=now(),changed_by='Codex for Tri' where store_code='PNYS'", [body.cutover_id]);
    await client.query("select set_config('app.store_code','PNYS',true),set_config('app.generation','2',true),set_config('app.mutation_kind','OPERATIONAL',true),set_config('app.preview_test','false',true)");
    await client.query("update pnys_pos.live_state set doc=$1::jsonb,version=version+1,updated_at=now() where store_code='PNYS'", [JSON.stringify(next)]);
    await client.query("update pos_hub.store_policy set opening_count_required=false,closing_count_required=true,updated_at=now(),updated_by='Codex for Tri' where store_code in ('PNY01','PNYS')");
    await client.query("update pos_hub.integration_owner set owner_store_code='PNYS',generation=2,enabled=true,cutover_id=$1,switched_at=now(),switched_by='Codex for Tri' where channel=any($2::text[])", [body.cutover_id, CHANNELS]);
    await client.query("commit");

    return Response.json({ ok: true, cutover_id: body.cutover_id, products: body.products.length, balances: body.balances.length, stock_units: body.balances.reduce((sum, row) => sum + row.qty, 0), active_shift: "Yogi", generation: 2 });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Cutover failed" }, { status: 409 });
  } finally {
    client.release();
    await db.end();
  }
}
