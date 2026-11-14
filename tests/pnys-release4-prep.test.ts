import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MemoryDb } from "../app/lib/pny-pos/memory.ts";
import { PosError } from "../app/lib/pny-pos/errors.ts";
import type { IntegrationChannel } from "../app/lib/pny-pos/controls.ts";

const channels: IntegrationChannel[] = ["SCCX_FEED", "SCCX_ACK", "SIGNAL", "SHEET_OUTBOX", "SHEET_IMPORT", "STOCK_SNAPSHOT", "SETB_SYNC"];

test("FROZEN and ARCHIVE_READ_ONLY reject server mutations without committing state", async () => {
  for (const mode of ["FROZEN", "ARCHIVE_READ_ONLY"] as const) {
    const db = new MemoryDb();
    db.writeMode = mode;
    await assert.rejects(() => db.transaction(async ({ state }) => { state.deposit_seq += 1; }), (error: unknown) => error instanceof PosError && error.code === "STORE_WRITE_BLOCKED");
    assert.equal(db.state.deposit_seq, 0);
  }
});

test("non-owner and old generations cannot lease, ack, send or record delivery", async () => {
  const db = new MemoryDb();
  db.generation = 2;
  for (const channel of channels) db.integrationOwners.set(channel, { channel, owner_store_code: "OTHER", generation: 2, cutover_id: "CUT-2" });
  for (const channel of channels) await assert.rejects(() => db.assertIntegrationOwner(channel), (error: unknown) => error instanceof PosError && error.code === "INTEGRATION_NOT_OWNER");
  const stale = { channel: "SIGNAL" as const, owner_store_code: "PNY01", generation: 1, cutover_id: "CUT-1" };
  db.integrationOwners.set("SIGNAL", { ...stale, generation: 2, cutover_id: "CUT-2" });
  await assert.rejects(() => db.recordIntegrationDelivery(stale, "event-1"), (error: unknown) => error instanceof PosError && ["INTEGRATION_NOT_OWNER", "INTEGRATION_STALE_LEASE"].includes(error.code));
  assert.equal(db.integrationDeliveries.size, 0);
});

test("delivery identity is unique by channel cutover and event", async () => {
  const db = new MemoryDb();
  const lease = { channel: "SHEET_OUTBOX" as const, owner_store_code: "PNY01", generation: db.generation, cutover_id: "CUT-1" };
  db.integrationOwners.set("SHEET_OUTBOX", lease);
  assert.equal(await db.recordIntegrationDelivery(lease, "event-1"), true);
  assert.equal(await db.recordIntegrationDelivery(lease, "event-1"), false);
  assert.equal(db.integrationDeliveries.size, 1);
});

test("PNYS migration is isolated, generation-gated, reversible and covers every channel", () => {
  const sql = readFileSync("supabase/migrations/20261114170000_pnys_release4_prep.sql", "utf8");
  const undo = readFileSync("supabase/undo/20261114170000_pnys_release4_prep.undo.sql", "utf8");
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /\bpny_pos\b/);
  assert.match(sql, /PNYS_STALE_DEPLOYMENT/);
  assert.match(sql, /unique \(channel, cutover_id, event_id\)/);
  for (const channel of channels) assert.match(sql, new RegExp(channel));
  assert.match(undo, /drop table if exists pos_hub\.integration_delivery/);
  assert.doesNotMatch(undo.replace(/^--.*$/gm, ""), /\bpny_pos\b/);
});

test("opening cash UI requires a warning and carries the adjustment into the till report", () => {
  const open = readFileSync("app/pos/OpeningFloatCheck.tsx", "utf8");
  const report = readFileSync("app/pos/TillSummary.tsx", "utf8");
  assert.match(open, /Previous closing cash/);
  assert.match(open, /Current opening count/);
  assert.match(open, /Are you sure\?/);
  assert.match(open, /confirmAdjustment/);
  assert.match(report, /opening-float-adjustment/);
  assert.match(report, /Recorded by/);
});

test("maintenance build has an explicit no-trade screen and server write block", () => {
  const page = readFileSync("app/pos/page.tsx", "utf8");
  const screen = readFileSync("app/pos/MaintenanceScreen.tsx", "utf8");
  const db = readFileSync("app/lib/pny-pos/supabaseState.ts", "utf8");
  assert.match(page, /maintenanceMode\(\)/);
  assert.match(screen, /TEMPORARILY PAUSED/);
  assert.match(screen, /DO NOT TRADE/);
  assert.match(db, /maintenanceMode\(\)/);
});
