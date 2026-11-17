import assert from "node:assert/strict";
import test from "node:test";
import { pnysGateApplies, validatePnysEnvironment } from "../scripts/lib/pnys-env-gate.mjs";

const valid = {
  STORE_CODE: "PNYS",
  POS_DB_SCHEMA: "pnys_pos",
  POS_HUB_SCHEMA: "pos_hub",
  VERCEL_PROJECT_PRODUCTION_URL: "pnys-pos.vercel.app",
  POS_SUPABASE_DB_URL: "postgresql://pnys_app:password@example.supabase.com:5432/postgres",
  SESSION_SECRET: "s".repeat(32),
  SHIFT_SECRET: "h".repeat(32),
  ADMIN_SECRET: "a".repeat(32),
  CRON_SECRET: "c".repeat(32),
  ROSTER_SECRET: "r".repeat(32),
  SCCX_POLL_SECRET: "p".repeat(32),
  SALES_FEED_TOKEN: "f".repeat(32),
  PNY_MASTER_PIN_HASH: `scrypt$${"a".repeat(32)}$${"b".repeat(64)}`,
  PNY_KITCHEN_PIN_HASH: `scrypt$${"c".repeat(32)}$${"d".repeat(64)}`,
  PNY_DEMO_PIN_HASH: `scrypt$${"e".repeat(32)}$${"f".repeat(64)}`,
};

test("valid PNYS production identity passes", () => assert.deepEqual(validatePnysEnvironment(valid), []));
test("gate applies to PNYS and not unrelated storefront builds", () => {
  assert.equal(pnysGateApplies(valid), true);
  assert.equal(pnysGateApplies({ STORE_CODE: "PNY01", VERCEL_PROJECT_PRODUCTION_URL: "pny1-pos.vercel.app" }), false);
});
test("redacted, blank, malformed and wrong-project values fail", () => {
  const errors = validatePnysEnvironment({
    ...valid,
    SESSION_SECRET: "[SENSITIVE]",
    ADMIN_SECRET: "",
    POS_SUPABASE_DB_URL: "not-a-url",
    PNY_KITCHEN_PIN_HASH: "bad-hash",
    STORE_CODE: "PNY01",
    POS_DB_SCHEMA: "pny_pos",
    VERCEL_PROJECT_PRODUCTION_URL: "pny1-pos.vercel.app",
  });
  assert.ok(errors.some((line) => line.includes("SESSION_SECRET")));
  assert.ok(errors.some((line) => line.includes("ADMIN_SECRET")));
  assert.ok(errors.some((line) => line.includes("POS_SUPABASE_DB_URL")));
  assert.ok(errors.some((line) => line.includes("PNY_KITCHEN_PIN_HASH")));
  assert.ok(errors.some((line) => line.includes("STORE_CODE")));
  assert.ok(errors.some((line) => line.includes("project identity")));
});
