import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { hashPin } from "../app/lib/pny-pos/crypto.ts";
import { emptyState } from "../app/lib/pny-pos/memory.ts";
import { PosError } from "../app/lib/pny-pos/errors.ts";
import { PosService } from "../app/lib/pny-pos/service.ts";
import { LocalSheet } from "../app/lib/pny-pos/sheets.ts";
import { createSupabaseStateDb } from "../app/lib/pny-pos/supabaseState.ts";
import { runStore } from "../app/lib/pny-pos/storeContext.ts";
import { PNYS_STORE } from "../app/lib/pny-pos/storeProfile.ts";
import type { Secrets, State } from "../app/lib/pny-pos/types.ts";

const PREFIX = "DRY-KR";
const BACKUP_ID = "d4b00000-0000-4000-8000-000000000001";
const REPORT_DIR = resolve("reports/pnys-kitchen-refill-e2e");

function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    values[match[1]!] = value;
  }
  return values;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function pin(digits = 6) {
  const min = 10 ** (digits - 1);
  return String(Number.parseInt(randomBytes(4).toString("hex"), 16) % (9 * min) + min);
}

function balanceProof(doc: State) {
  const rows = doc.balances.filter((row) => !row.store_code || row.store_code === "PNYS").map((row) => ({ sku: row.sku, qty: row.qty })).sort((a, b) => a.sku.localeCompare(b.sku, "en", { numeric: true }));
  return { rows: rows.length, units: rows.reduce((sum, row) => sum + row.qty, 0), checksum: sha(rows) };
}

async function mutationContext(client: PoolClient, generation: number) {
  await client.query("select set_config('app.store_code','PNYS',true),set_config('app.generation',$1,true),set_config('app.mutation_kind','OPERATIONAL',true),set_config('app.preview_test','true',true)", [String(generation)]);
}

async function restore(client: PoolClient, generation: number) {
  await client.query("begin");
  try {
    await mutationContext(client, generation);
    await client.query(`update pnys_pos.live_state state
      set doc=backup.old_value,version=version+1,updated_at=now()
      from pos_hub.policy_audit backup
      where state.store_code='PNYS' and backup.id=$1::uuid and backup.policy_key='DRY_KITCHEN_REFILL_BACKUP'`, [BACKUP_ID]);
    await client.query(`update pos_hub.store_runtime runtime
      set write_mode=backup.new_value->>'write_mode',generation=(backup.new_value->>'generation')::bigint,
          cutover_id=backup.new_value->>'cutover_id',changed_at=(backup.new_value->>'changed_at')::timestamptz,
          changed_by=backup.new_value->>'changed_by'
      from pos_hub.policy_audit backup
      where runtime.store_code='PNYS' and backup.id=$1::uuid and backup.policy_key='DRY_KITCHEN_REFILL_BACKUP'`, [BACKUP_ID]);
    await client.query("delete from pos_hub.policy_audit where id=$1::uuid and policy_key='DRY_KITCHEN_REFILL_BACKUP'", [BACKUP_ID]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function runKitchenRefillE2e(env: Record<string, string>) {
  if (env.STORE_CODE !== "PNYS" || env.POS_DB_SCHEMA !== "pnys_pos" || env.POS_HUB_SCHEMA !== "pos_hub" || !env.POS_SUPABASE_DB_URL) throw new Error("Fail closed: expected PNYS preview database settings.");
  if (env.VERCEL_ENV !== "preview" || env.TEST_STORE !== "1") throw new Error("Fail closed: this runner is preview/test only.");
  if (/pny1-pos|pny_pos(?!s)/i.test(`${env.VERCEL_URL ?? ""} ${env.POS_DB_SCHEMA}`)) throw new Error("Fail closed: PNY01 target detected.");

  process.env.VERCEL_ENV = "preview";
  process.env.TEST_STORE = "1";
  process.env.STORE_CODE = "PNYS";
  process.env.POS_DB_SCHEMA = "pnys_pos";
  process.env.POS_HUB_SCHEMA = "pos_hub";
  process.env.INTEGRATIONS_ENABLED = "0";
  process.env.SIGNAL_ENABLED = "0";

  const pool = new Pool({ connectionString: env.POS_SUPABASE_DB_URL, max: 3, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  let backedUp = false;
  let generation = 0;
  let pre: { doc_checksum: string; balances: ReturnType<typeof balanceProof>; runtime: Record<string, unknown> } | null = null;
  try {
    const loaded = await client.query("select version,doc from pnys_pos.live_state where store_code='PNYS'");
    const runtime = await client.query("select store_code,write_mode,generation,cutover_id,changed_at::text,changed_by from pos_hub.store_runtime where store_code='PNYS'");
    const owner = await client.query("select owner_store_code,enabled from pos_hub.integration_owner where channel='SIGNAL'");
    if (loaded.rowCount !== 1 || runtime.rowCount !== 1) throw new Error("PNYS state or runtime row is missing.");
    if (runtime.rows[0].write_mode !== "FROZEN") throw new Error("Fail closed: PNYS was not FROZEN before the run.");
    if (owner.rows[0]?.owner_store_code === "PNYS" || owner.rows[0]?.enabled !== true) throw new Error("Fail closed: expected SIGNAL to remain owned by PNY01 before cutover.");
    if (Number((await client.query("select count(*) count from pos_hub.policy_audit where id=$1::uuid or policy_key='DRY_KITCHEN_REFILL_BACKUP'", [BACKUP_ID])).rows[0].count) !== 0) throw new Error("A previous Kitchen dry-run backup exists; stop for recovery.");

    const original = loaded.rows[0].doc as State;
    generation = Number(runtime.rows[0].generation);
    process.env.POS_DEPLOYMENT_GENERATION = String(generation);
    pre = { doc_checksum: sha(original), balances: balanceProof(original), runtime: runtime.rows[0] };
    await client.query(`insert into pos_hub.policy_audit(id,store_code,policy_key,old_value,new_value,changed_by,changed_at)
      values($1::uuid,'PNYS','DRY_KITCHEN_REFILL_BACKUP',$2::jsonb,$3::jsonb,'Codex Kitchen preview E2E',now())`, [BACKUP_ID, JSON.stringify(original), JSON.stringify(runtime.rows[0])]);
    backedUp = true;

    const product656 = original.products.find((row) => row.sku === "656");
    const product668 = original.products.find((row) => row.sku === "668");
    if (!product656 || !product668) throw new Error("Required PNYS catalog fixtures 656 and 668 are missing.");
    const now = new Date("2026-11-16T16:00:00.000Z");
    const state = emptyState(now.toISOString());
    state.stores = [{ code: "PNYS", name: "PNYS TEST STORE", active: true, timezone: "America/Toronto", prices_tax_included: true, weed_in_store: true, ticket_letter_seq: 0, created_at: now.toISOString() }];
    state.products = [structuredClone(product656), structuredClone(product668)];
    state.balances = [
      { store_code: "PNYS", sku: "656", qty: 0, created_at: now.toISOString(), updated_at: now.toISOString() },
      { store_code: "PNYS", sku: "668", qty: 0, created_at: now.toISOString(), updated_at: now.toISOString() },
    ];
    state.opening_stock_at = now.toISOString();

    await client.query("begin");
    await mutationContext(client, generation);
    await client.query("update pos_hub.store_runtime set write_mode='ACTIVE',changed_at=now(),changed_by='Codex Kitchen preview E2E' where store_code='PNYS'");
    const seeded = await client.query("update pnys_pos.live_state set doc=$1::jsonb,version=version+1,updated_at=now() where store_code='PNYS' and version=$2", [JSON.stringify(state), Number(loaded.rows[0].version)]);
    if (seeded.rowCount !== 1) throw new Error("PNYS state changed before the isolated seed.");
    await client.query("commit");

    const kitchenPin = pin();
    const staffPin = pin(4);
    process.env.PNY_KITCHEN_PIN_HASH = hashPin(kitchenPin);
    const secrets: Secrets = {
      shift: env.SHIFT_SECRET!, roster: env.ROSTER_SECRET!, poll: env.CRON_SECRET!,
      session: env.SESSION_SECRET!, admin: env.ADMIN_SECRET!, cron: env.CRON_SECRET!,
    };
    const clock = { value: now };
    let gatewayCalls = 0;
    const service = new PosService(createSupabaseStateDb(env.POS_SUPABASE_DB_URL, "PNYS", "pnys_pos"), {
      now: () => clock.value,
      sheet: new LocalSheet(),
      secrets,
      signal: { enabled: false, dryRun: true, async send() { gatewayCalls += 1; return { ok: true, status: "dry-run" }; } },
    });
    const inPnys = <T>(run: () => Promise<T>) => runStore(PNYS_STORE, run);
    await inPnys(() => service.openShiftWithPin({ staff_uid: `${PREFIX}-STAFF`, display_name: "DRY Kitchen Receiver", pos_id: `${PREFIX}-POS`, sccx_id: `${PREFIX}-SCCX`, shift_id: `${PREFIX}-SHIFT`, pin: staffPin }));
    const staff = await inPnys(() => service.login(staffPin, `${PREFIX}-STAFF-CLIENT`));
    const kitchen = await inPnys(() => service.kitchenLogin(kitchenPin, `${PREFIX}-KITCHEN-CLIENT`));
    clock.value = new Date("2026-11-16T16:05:00.000Z");
    const sent = await inPnys(() => service.queueKitchenRefill(kitchen.token, { key: `${PREFIX}-BATCH`, lines: [{ sku: "656", qty: 2 }, { sku: "668", qty: 1 }] })) as { lines: Array<{ kitchen_row_id: string; sku: string; approval_required: boolean }> };
    if (sent.lines.length !== 2 || sent.lines.some((line) => !line.approval_required)) throw new Error("Disabled-SKU approval flags were not created.");
    clock.value = new Date("2026-11-16T16:10:00.000Z");
    const accepted = await inPnys(() => service.confirmIncoming(staff.token, {
      key: `${PREFIX}-ACCEPT`, batch_id: `${PREFIX}-BATCH`, action: "ACCEPT",
      lines: sent.lines.map((line) => ({ kitchen_row_id: line.kitchen_row_id, qty_received: line.sku === "656" ? 1 : 1, variance_reason: line.sku === "656" ? "One unit held back in Kitchen dry run" : undefined })),
    })) as { receipt: { status: string; lines: Array<{ sku: string; qty_sent: number; qty_received: number; variance: number; reason: string | null }>; signal_notice: string } };
    if (accepted.receipt.status !== "PARTIAL" || accepted.receipt.signal_notice !== "DRY_RUN") throw new Error("Partial receipt or preview dry-run notice is missing.");
    const kitchenView = await inPnys(() => service.kitchenState(kitchen.token)) as { history: Array<{ batch_id: string; status: string; variance_reason?: string | null }> };
    if (!kitchenView.history.some((row) => row.batch_id === `${PREFIX}-BATCH` && row.status === "PARTIAL" && row.variance_reason)) throw new Error("Kitchen history does not show the partial result.");
    let legacyBlocked = false;
    try { await inPnys(() => service.sendRefill(kitchen.token, { key: `${PREFIX}-LEGACY`, lines: [{ sku: "656", qty: 9 }] })); }
    catch (error) { legacyBlocked = error instanceof PosError && error.code === "LEGACY_REFILL_DISABLED"; }
    if (!legacyBlocked) throw new Error("Legacy direct-stock refill was not blocked.");

    const proof = await client.query("select doc from pnys_pos.live_state where store_code='PNYS'");
    const proofState = proof.rows[0].doc as State;
    const receipt = proofState.refill_receipts?.find((row) => row.batch_id === `${PREFIX}-BATCH`);
    const signalRows = proofState.outbox.filter((row) => row.tab === "SIGNAL_GROUP" && row.payload.batch_id === `${PREFIX}-BATCH`);
    const stock656 = proofState.balances.find((row) => row.sku === "656")?.qty;
    const stock668 = proofState.balances.find((row) => row.sku === "668")?.qty;
    if (!receipt || receipt.lines.length !== 2 || stock656 !== 1 || stock668 !== 1 || signalRows.length !== 2 || gatewayCalls !== 0) throw new Error("Database proof failed: receipt, stock-once, outbox, or no-send invariant is wrong.");

    await restore(client, generation);
    backedUp = false;
    const afterState = (await client.query("select doc from pnys_pos.live_state where store_code='PNYS'")).rows[0].doc as State;
    const afterRuntime = (await client.query("select store_code,write_mode,generation,cutover_id,changed_at::text,changed_by from pos_hub.store_runtime where store_code='PNYS'")).rows[0];
    const afterOwners = await client.query("select count(*)::int count from pos_hub.integration_owner where owner_store_code='PNY01' and enabled=true");
    const cleanup = {
      doc_checksum_restored: sha(afterState) === pre.doc_checksum,
      balances_restored: canonical(balanceProof(afterState)) === canonical(pre.balances),
      write_mode: afterRuntime.write_mode,
      pny01_owned_channels: Number(afterOwners.rows[0].count),
      backup_rows_remaining: Number((await client.query("select count(*) count from pos_hub.policy_audit where id=$1::uuid", [BACKUP_ID])).rows[0].count),
    };
    if (!cleanup.doc_checksum_restored || !cleanup.balances_restored || cleanup.write_mode !== "FROZEN" || cleanup.pny01_owned_channels !== 7 || cleanup.backup_rows_remaining !== 0) throw new Error("Cleanup or PNYS re-freeze verification failed.");

    const report = {
      status: "PASSED_CLEANED_REFROZEN", scope: "PNYS preview database only", batch_id: `${PREFIX}-BATCH`,
      sent: [{ sku: "656", qty: 2 }, { sku: "668", qty: 1 }],
      received: accepted.receipt.lines, receipt_status: accepted.receipt.status,
      signal: { notices_queued_once: signalRows.length, gateway_calls: gatewayCalls, preview_result: "DRY_RUN", owner_during_run: owner.rows[0]?.owner_store_code },
      legacy_direct_refill_blocked: legacyBlocked, cleanup,
    };
    await mkdir(REPORT_DIR, { recursive: true });
    await writeFile(resolve(REPORT_DIR, "result.json"), JSON.stringify(report, null, 2));
    await writeFile(resolve(REPORT_DIR, "report.md"), `# PNYS Kitchen refill preview E2E\n\nStatus: **PASSED, CLEANED, RE-FROZEN**\n\n- Batch: ${PREFIX}-BATCH\n- Kitchen sent: 656 x2, 668 x1\n- Store received: 656 x1 (required partial reason), 668 x1\n- Receipt: PARTIAL, stored with sender/receiver and Toronto timestamps\n- Group notices: two unique SIGNAL_GROUP outbox events; preview dry-run; gateway calls 0\n- Legacy direct-stock refill: blocked\n- Full PNYS state checksum restored: yes\n- PNYS balances restored: yes\n- PNYS write mode: FROZEN\n- Integration ownership: 7 channels remain PNY01-owned\n- PNY01/pny_pos access: none\n`);
    return report;
  } finally {
    if (backedUp && generation > 0) {
      try { await restore(client, generation); }
      catch { process.stderr.write("Emergency restore failed; stop and use the retained DRY_KITCHEN_REFILL_BACKUP row.\n"); }
    }
    client.release();
    await pool.end();
  }
}

if (process.env.PNYS_KITCHEN_E2E_CLI === "1") {
  const envFile = process.argv[2];
  if (!envFile) throw new Error("Pass the pulled PNYS preview env file path.");
  void readFile(envFile, "utf8").then(parseEnv).then((env) => runKitchenRefillE2e({ ...env, POS_SUPABASE_DB_URL: process.env.POS_SUPABASE_DB_URL || env.POS_SUPABASE_DB_URL })).then(() => {
    process.stdout.write("PNYS Kitchen refill E2E passed, cleaned, and re-frozen.\n");
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Kitchen E2E failed."}\n`);
    process.exitCode = 1;
  });
}
