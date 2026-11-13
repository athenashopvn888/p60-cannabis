import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PNYS_STORE, storeProfile } from "../app/lib/pny-pos/storeProfile.ts";
import { lockedStore } from "../app/lib/pny-pos/singleStore.ts";
import { LocalSheet, sheetFromEnv } from "../app/lib/pny-pos/sheets.ts";
import { materializeCatalog } from "../app/lib/pny-pos/catalogMaterialization.ts";
import type { State } from "../app/lib/pny-pos/types.ts";

test("PNYS uses isolated routes and cookie", () => {
  assert.equal(storeProfile("PNYS"), PNYS_STORE);
  assert.equal(PNYS_STORE.apiBase, "/api/pos");
  assert.equal(PNYS_STORE.menuApi, "/api/menu");
  assert.equal(PNYS_STORE.sessionCookie, "pnys_pos_session");
});

test("STORE_CODE locks the deployment to PNYS", () => {
  const prior = process.env.STORE_CODE;
  process.env.STORE_CODE = "PNYS";
  try { assert.equal(lockedStore()?.code, "PNYS"); }
  finally { if (prior == null) delete process.env.STORE_CODE; else process.env.STORE_CODE = prior; }
});

test("integrations off ignores accidentally inherited Sheet credentials", () => {
  const prior = { enabled: process.env.INTEGRATIONS_ENABLED, id: process.env.GSHEET_ID, email: process.env.GOOGLE_SA_PNY_CLIENT_EMAIL, key: process.env.GOOGLE_SA_PNY_PRIVATE_KEY };
  Object.assign(process.env, { INTEGRATIONS_ENABLED: "0", GSHEET_ID: "must-not-be-used", GOOGLE_SA_PNY_CLIENT_EMAIL: "must-not-be-used", GOOGLE_SA_PNY_PRIVATE_KEY: "must-not-be-used" });
  try { assert.ok(sheetFromEnv() instanceof LocalSheet); }
  finally {
    for (const [key, value] of Object.entries({ INTEGRATIONS_ENABLED: prior.enabled, GSHEET_ID: prior.id, GOOGLE_SA_PNY_CLIENT_EMAIL: prior.email, GOOGLE_SA_PNY_PRIVATE_KEY: prior.key })) {
      if (value == null) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("migration and rollback never write to pny_pos", async () => {
  const forward = await readFile(new URL("../supabase/migrations/20261113090000_pnys_foundation.sql", import.meta.url), "utf8");
  const undo = await readFile(new URL("../supabase/undo/20261113090000_pnys_foundation.undo.sql", import.meta.url), "utf8");
  assert.doesNotMatch(forward, /\b(insert|update|delete|alter|drop)\s+(into\s+|table\s+)?pny_pos\b/i);
  assert.doesNotMatch(undo, /\bpny_pos\b/i);
  assert.match(forward, /create schema if not exists pnys_pos/);
  assert.match(forward, /create schema if not exists pos_hub/);
});

test("shared shell has fixed bars, scroll panel, safe areas and 360px rule", async () => {
  const css = await readFile(new URL("../app/components/pnys/PnysAppShell.module.css", import.meta.url), "utf8");
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /overflow:\s*auto/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /max-width:\s*390px/);
});

test("catalog materialization preserves stock and keeps PNY01-only additions", () => {
  const state = {
    products: [{ sku: "396-3g", sku_sort: 396, name: "KHALIFA KUSH 3g", category: "BUDGET", default_price_cents: 1000, image_url: null, setb_active: true, synced_at: null, created_at: "old" }],
    store_products: [{ store_code: "PNYS", sku: "396-3g", enabled: true, price_override_cents: null, created_at: "old", updated_at: "old" }],
    balances: [{ store_code: "PNYS", sku: "240", qty: 37, created_at: "old", updated_at: "old" }],
  } as Pick<State, "products" | "store_products" | "balances">;
  const before = structuredClone(state.balances);
  const result = materializeCatalog(state, [
    { sku: "240", name: "GRABBA", category: "CIGARETTES", price_cents: 500, image_url: null, active: true },
  ], "PNYS", "now");

  assert.deepEqual(state.balances, before);
  assert.deepEqual(result, { products: 2, store_products: 2, balances: 1 });
  assert.equal(state.products.find((row) => row.sku === "240")?.thc_flag, false);
  assert.equal(state.products.find((row) => row.sku === "396-3g")?.thc_flag, true);
});
