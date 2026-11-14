import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { enforceIntegrationOwner, enforceStoreWriteGate, INTEGRATION_CHANNELS } from "../app/lib/pny-pos/controls.ts";
import { PosError } from "../app/lib/pny-pos/errors.ts";

function codeOf(fn: () => unknown) {
  assert.throws(fn, (error) => error instanceof PosError && Boolean(error.code));
  try { fn(); } catch (error) { return (error as PosError).code; }
  return "";
}

test("PNY01 ACTIVE generation 1 may mutate", () => {
  assert.doesNotThrow(() => enforceStoreWriteGate({ write_mode: "ACTIVE", generation: 1 }, 1));
});

test("FROZEN and ARCHIVE_READ_ONLY stores cannot mutate", () => {
  assert.equal(codeOf(() => enforceStoreWriteGate({ write_mode: "FROZEN", generation: 1 }, 1)), "STORE_WRITE_BLOCKED");
  assert.equal(codeOf(() => enforceStoreWriteGate({ write_mode: "ARCHIVE_READ_ONLY", generation: 1 }, 1)), "STORE_WRITE_BLOCKED");
});

test("old deployment generation cannot mutate", () => {
  assert.equal(codeOf(() => enforceStoreWriteGate({ write_mode: "ACTIVE", generation: 2 }, 1)), "STALE_DEPLOYMENT");
});

test("only the enabled PNY01 generation can obtain an integration lease", () => {
  for (const channel of INTEGRATION_CHANNELS) {
    const lease = enforceIntegrationOwner(channel, "PNY01", { owner_store_code: "PNY01", generation: 1, cutover_id: "CUT-1" }, 1);
    assert.deepEqual(lease, { channel, owner_store_code: "PNY01", generation: 1, cutover_id: "CUT-1" });
  }
  assert.equal(codeOf(() => enforceIntegrationOwner("SCCX_ACK", "PNY01", { owner_store_code: "PNYS", generation: 1, cutover_id: "CUT-1" }, 1)), "INTEGRATION_NOT_OWNER");
  assert.equal(codeOf(() => enforceIntegrationOwner("SIGNAL", "PNY01", { owner_store_code: "PNY01", generation: 2, cutover_id: "CUT-1" }, 1)), "INTEGRATION_NOT_OWNER");
});

test("every active integration endpoint checks ownership before work", () => {
  const checks: Record<string, string> = {
    "app/api/cron/sheet-outbox/route.ts": "drainOutbox",
    "app/api/cron/sheet-import/route.ts": 'assertIntegrationOwner("SHEET_IMPORT")',
    "app/api/cron/stock-snapshot/route.ts": 'assertIntegrationOwner("STOCK_SNAPSHOT")',
    "app/api/cron/setb-sync/route.ts": 'assertIntegrationOwner("SETB_SYNC")',
    "app/api/sales/feed/route.ts": 'assertIntegrationOwner("SCCX_FEED")',
    "app/api/sccx/closed-shifts/route.ts": 'assertIntegrationOwner("SCCX_FEED")',
    "app/api/sccx/closed-shifts/[id]/summary.png/route.ts": 'assertIntegrationOwner("SCCX_FEED")',
    "app/api/sccx/closed-shifts/[id]/ack/route.ts": 'assertIntegrationOwner("SCCX_ACK")',
  };
  for (const [file, marker] of Object.entries(checks)) assert.match(readFileSync(file, "utf8"), new RegExp(marker.replace(/[()]/g, "\\$&")));
});

test("bridge status route is preview-only and database read-only", () => {
  const source = readFileSync("app/api/pos/bridge-status/route.ts", "utf8");
  assert.match(source, /VERCEL_ENV !== "preview"/);
  assert.match(source, /begin transaction read only/);
  assert.match(source, /select write_mode,generation/);
  assert.match(source, /select channel,owner_store_code,generation,enabled/);
  assert.match(source, /select count\(\*\)::int/);
  assert.doesNotMatch(source, /\b(insert|update|delete|alter|grant|revoke)\b/i);
});

test("Supabase mutations lock state and enforce the control row before update", () => {
  const source = readFileSync("app/lib/pny-pos/supabaseState.ts", "utf8");
  assert.match(source, /live_state where store_code = \$1 for update/);
  assert.match(source, /enforceStoreWriteGate/);
  assert.ok(source.indexOf("enforceStoreWriteGate(runtime.rows[0])") < source.indexOf("update pny_pos.live_state"));
});

test("delivery acknowledgement is idempotent and revalidates ownership", () => {
  const source = readFileSync("app/lib/pny-pos/supabaseState.ts", "utf8");
  assert.match(source, /for update/);
  assert.match(source, /on conflict\(channel,cutover_id,event_id\) do nothing/);
});
