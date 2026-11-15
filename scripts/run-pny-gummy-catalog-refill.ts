import pg from "pg";
import { applyGummyCatalogRefill, gummyFixChecksum, type GummyFixStore } from "../app/lib/pny-pos/gummyCatalogFix.ts";
import type { State } from "../app/lib/pny-pos/types.ts";

const { Client } = pg;
const APPLY = process.argv.includes("--apply") && process.argv.includes("--tri-approved");
const DATABASE_URL = process.env.PNY_DATABASE_URL?.trim();
const BACKUPS: Record<GummyFixStore, string> = {
  PNY01: "65665701-1115-4000-a000-000000000001",
  PNYS: "65665702-1115-4000-a000-000000000001",
};

if (!DATABASE_URL) throw new Error("PNY_DATABASE_URL is required and must stay outside logs and files.");

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("begin");
  if (!APPLY) await client.query("set transaction read only");
  const reports = [];
  for (const [store, schema] of [["PNY01", "pny_pos"], ["PNYS", "pnys_pos"]] as const) {
    const row = (await client.query(`select version,updated_at,doc from ${schema}.live_state where store_code=$1 ${APPLY ? "for update" : ""}`, [store])).rows[0];
    if (!row) throw new Error(`${store}_STATE_NOT_FOUND`);
    const before = row.doc as State;
    const beforeHash = gummyFixChecksum(before);
    const next = structuredClone(before);
    const report = applyGummyCatalogRefill(next, store, new Date().toISOString());
    reports.push({ ...report, version_before: Number(row.version), checksum_before: beforeHash });
    if (!APPLY || !report.changed) continue;

    await client.query(
      "insert into pos_hub.policy_audit(id,store_code,policy_key,old_value,new_value,changed_by) values ($1::uuid,$2,'PNY_GUMMY_CATALOG_REFILL_BACKUP',$3::jsonb,$4::jsonb,'Codex for Tri')",
      [BACKUPS[store], store, JSON.stringify(before), JSON.stringify({ version: Number(row.version), updated_at: row.updated_at, checksum: beforeHash })],
    );
    if (store === "PNYS") {
      const activated = await client.query("update pos_hub.store_runtime set write_mode='ACTIVE',changed_at=now(),changed_by='Codex for Tri - approved gummy recovery' where store_code='PNYS' and write_mode='FROZEN'");
      if (activated.rowCount !== 1) throw new Error("PNYS_NOT_FROZEN");
      await client.query("select set_config('app.store_code','PNYS',true),set_config('app.generation',(select generation::text from pos_hub.store_runtime where store_code='PNYS'),true)");
    }
    const updated = await client.query(
      `update ${schema}.live_state set doc=$1::jsonb,version=version+1,updated_at=now() where store_code=$2 and version=$3 returning version`,
      [JSON.stringify(next), store, Number(row.version)],
    );
    if (updated.rowCount !== 1) throw new Error(`${store}_VERSION_GUARD_FAILED`);
    if (store === "PNYS") {
      const refrozen = await client.query("update pos_hub.store_runtime set write_mode='FROZEN',changed_at=now(),changed_by='Codex for Tri - approved gummy recovery complete' where store_code='PNYS' and write_mode='ACTIVE'");
      if (refrozen.rowCount !== 1) throw new Error("PNYS_REFREEZE_FAILED");
    }
  }
  if (APPLY) await client.query("commit"); else await client.query("rollback");
  console.log(JSON.stringify({ mode: APPLY ? "APPLIED" : "READ_ONLY", reports }, null, 2));
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
