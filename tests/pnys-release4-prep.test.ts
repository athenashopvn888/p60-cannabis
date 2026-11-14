import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MemoryDb } from "../app/lib/pny-pos/memory.ts";
import { PosError } from "../app/lib/pny-pos/errors.ts";
import { hashPin } from "../app/lib/pny-pos/crypto.ts";
import { applyDemoSeed } from "../app/lib/pny-pos/seed.ts";
import { PosService } from "../app/lib/pny-pos/service.ts";
import { LocalSheet } from "../app/lib/pny-pos/sheets.ts";
import type { IntegrationChannel } from "../app/lib/pny-pos/controls.ts";
import type { Secrets } from "../app/lib/pny-pos/types.ts";

const channels: IntegrationChannel[] = ["SCCX_FEED", "SCCX_ACK", "SIGNAL", "SHEET_OUTBOX", "SHEET_IMPORT", "STOCK_SNAPSHOT", "SETB_SYNC"];

const authPins = { demo: "24680", kitchen: "135790", manager: "86420" };
const authSecrets: Secrets = {
  shift: "test-shift-secret-value",
  roster: "test-roster-secret-value",
  poll: "test-poll-secret-value",
  session: "test-session-secret-value-32chars",
  admin: "test-admin-secret-value",
  cron: "test-cron-secret-value",
};

test("FROZEN and ARCHIVE_READ_ONLY reject server mutations without committing state", async () => {
  for (const mode of ["FROZEN", "ARCHIVE_READ_ONLY"] as const) {
    const db = new MemoryDb();
    db.writeMode = mode;
    await assert.rejects(() => db.transaction(async ({ state }) => { state.deposit_seq += 1; }), (error: unknown) => error instanceof PosError && error.code === "STORE_WRITE_BLOCKED");
    assert.equal(db.state.deposit_seq, 0);
  }
});

test("a frozen preview allows only Staff Kitchen and Manager authentication state", { concurrency: false }, async () => {
  const saved = {
    demo: process.env.PNY_DEMO_PIN_HASH,
    kitchen: process.env.PNY_KITCHEN_PIN_HASH,
    manager: process.env.PNY_MASTER_PIN_HASH,
  };
  try {
    process.env.PNY_DEMO_PIN_HASH = hashPin(authPins.demo);
    process.env.PNY_KITCHEN_PIN_HASH = hashPin(authPins.kitchen);
    process.env.PNY_MASTER_PIN_HASH = hashPin(authPins.manager);
    const now = new Date("2026-11-14T15:00:00.000Z");
    const db = new MemoryDb();
    applyDemoSeed(db.state, now, process.env.PNY_DEMO_PIN_HASH);
    db.writeMode = "FROZEN";
    db.allowFrozenPreviewAuth = true;
    const svc = new PosService(db, { now: () => now, sheet: new LocalSheet(), secrets: authSecrets, demo: { pinHash: process.env.PNY_DEMO_PIN_HASH, label: "TEST" } });

    assert.match((await svc.login(authPins.demo, "10.10.0.1")).token, /^v1\./);
    assert.match((await svc.kitchenLogin(authPins.kitchen, "10.10.0.2")).token, /^v1\./);
    assert.ok((await svc.managerLogin(authPins.manager, "10.10.0.3")).token);
    await assert.rejects(
      () => db.transaction(async ({ state }) => { state.deposit_seq += 1; }),
      (error: unknown) => error instanceof PosError && error.code === "STORE_WRITE_BLOCKED" && error.message === "Store frozen",
    );
    assert.equal(db.state.deposit_seq, 0);
    for (const channel of channels) {
      db.integrationOwners.set(channel, { channel, owner_store_code: "OTHER", generation: db.generation, cutover_id: "PRE-CUTOVER" });
      await assert.rejects(() => db.assertIntegrationOwner(channel), (error: unknown) => error instanceof PosError && error.code === "INTEGRATION_NOT_OWNER");
    }
  } finally {
    if (saved.demo) process.env.PNY_DEMO_PIN_HASH = saved.demo; else delete process.env.PNY_DEMO_PIN_HASH;
    if (saved.kitchen) process.env.PNY_KITCHEN_PIN_HASH = saved.kitchen; else delete process.env.PNY_KITCHEN_PIN_HASH;
    if (saved.manager) process.env.PNY_MASTER_PIN_HASH = saved.manager; else delete process.env.PNY_MASTER_PIN_HASH;
  }
});

test("a gate block is Store frozen and never consumes Manager PIN attempts", { concurrency: false }, async () => {
  const saved = process.env.PNY_MASTER_PIN_HASH;
  try {
    process.env.PNY_MASTER_PIN_HASH = hashPin(authPins.manager);
    const now = new Date("2026-11-14T15:00:00.000Z");
    const db = new MemoryDb();
    applyDemoSeed(db.state, now, hashPin(authPins.demo));
    db.writeMode = "FROZEN";
    const svc = new PosService(db, { now: () => now, sheet: new LocalSheet(), secrets: authSecrets, demo: { pinHash: hashPin(authPins.demo), label: "TEST" } });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await assert.rejects(
        () => svc.managerLogin(authPins.manager, `10.11.0.${attempt + 1}`),
        (error: unknown) => error instanceof PosError && error.code === "STORE_WRITE_BLOCKED" && error.message === "Store frozen",
      );
    }
    db.allowFrozenPreviewAuth = true;
    assert.ok((await svc.managerLogin(authPins.manager, "10.11.0.9")).token);
  } finally {
    if (saved) process.env.PNY_MASTER_PIN_HASH = saved; else delete process.env.PNY_MASTER_PIN_HASH;
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

test("the PNYS database guard permits only tagged frozen-preview auth transactions", () => {
  const sql = readFileSync("supabase/migrations/20261114204500_pnys_frozen_preview_auth.sql", "utf8");
  const undo = readFileSync("supabase/undo/20261114204500_pnys_frozen_preview_auth.undo.sql", "utf8");
  const db = readFileSync("app/lib/pny-pos/supabaseState.ts", "utf8");
  assert.match(sql, /mode = 'FROZEN'/);
  assert.match(sql, /mutation_kind = 'AUTH_SESSION'/);
  assert.match(sql, /preview_test/);
  assert.match(db, /set_config\('app\.mutation_kind'/);
  assert.match(db, /isAuthSessionOnlyChange/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /\bpny_pos\b/);
  assert.doesNotMatch(undo, /mutation_kind|preview_test/);
});

test("opening cash UI requires a warning and carries the adjustment into the till report", () => {
  const open = readFileSync("app/pos/OpeningFloatCheck.tsx", "utf8");
  const report = readFileSync("app/pos/TillSummary.tsx", "utf8");
  assert.match(open, /Previous closing cash/);
  assert.match(open, /Current opening count/);
  assert.match(open, /Are you sure\?/);
  assert.match(open, /confirmAdjustment/);
  assert.match(report, /opening-float-adjustment/);
  assert.match(report, /floatAdjustment\.staff/);
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
