import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PNYS_STORE, storeProfile } from "../app/lib/pny-pos/storeProfile.ts";
import { lockedStore } from "../app/lib/pny-pos/singleStore.ts";
import { LocalSheet, sheetFromEnv } from "../app/lib/pny-pos/sheets.ts";
import { materializeCatalog } from "../app/lib/pny-pos/catalogMaterialization.ts";
import { reconcileTillCatalog } from "../app/lib/pny-pos/tillCatalog.ts";
import type { ItemIndex } from "../app/lib/pny-pos/itemRaw.ts";
import type { FlowerIndex } from "../app/lib/pny-pos/flowerRaw.ts";
import type { State } from "../app/lib/pny-pos/types.ts";
import { matchScannedLabel, skuFromLabelText } from "../app/lib/pny-pos/labelScan.ts";
import { MemoryDb, type PosDb } from "../app/lib/pny-pos/memory.ts";
import { PosService } from "../app/lib/pny-pos/service.ts";

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
  const security = await readFile(new URL("../supabase/migrations/20261113193000_pnys_catalog_rls_reconciliation.sql", import.meta.url), "utf8");
  const securityUndo = await readFile(new URL("../supabase/undo/20261113193000_pnys_catalog_rls_reconciliation.undo.sql", import.meta.url), "utf8");
  const appLogin = await readFile(new URL("../supabase/migrations/20261113200000_pnys_app_login.sql", import.meta.url), "utf8");
  const appLoginUndo = await readFile(new URL("../supabase/undo/20261113200000_pnys_app_login.undo.sql", import.meta.url), "utf8");
  assert.doesNotMatch(forward, /\b(insert|update|delete|alter|drop)\s+(into\s+|table\s+)?pny_pos\b/i);
  assert.doesNotMatch(undo, /\bpny_pos\b/i);
  assert.doesNotMatch(security, /\b(insert|update|delete|alter|drop|truncate)\s+(into\s+|table\s+)?pny_pos\b/i);
  assert.doesNotMatch(securityUndo, /\b(insert|update|delete|alter|drop|truncate)\s+(into\s+|table\s+)?pny_pos\b/i);
  assert.doesNotMatch(appLogin, /\bpny_pos\b/i);
  assert.doesNotMatch(appLoginUndo, /\bpny_pos\b/i);
  assert.match(forward, /create schema if not exists pnys_pos/);
  assert.match(forward, /create schema if not exists pos_hub/);
  assert.match(security, /create role pnys_app nologin nobypassrls/);
  assert.match(security, /enable row level security/);
  assert.match(security, /force row level security/);
  assert.match(security, /create policy pnys_app_all/);
  assert.match(appLogin, /alter role pnys_app login nobypassrls/);
  assert.match(appLogin, /rolpassword is not null/);
  assert.match(appLoginUndo, /alter role pnys_app nologin nobypassrls/);
});

test("shared shell has fixed bars, scroll panel, safe areas and 360px rule", async () => {
  const css = await readFile(new URL("../app/components/pnys/PnysAppShell.module.css", import.meta.url), "utf8");
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /overflow:\s*auto/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /max-width:\s*390px/);
});

test("customer routes cannot render the PNYS staff shell or link to staff routes", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(layout, /PnysAppShell|data-pnys-shell/);
  const customerRoutes = [
    "../app/page.tsx",
    "../app/menu/page.tsx",
    "../app/delivery/page.tsx",
    "../app/[tier]/page.tsx",
    "../app/items/[category]/page.tsx",
    "../app/item/[slug]/page.tsx",
  ];
  for (const route of customerRoutes) {
    const source = await readFile(new URL(route, import.meta.url), "utf8");
    assert.doesNotMatch(source, /PnysAppShell|data-pnys-shell|href\s*=\s*["']\/pos(?:[\/"'])/i, route);
  }
});

test("PIN screens have no staff navigation before authentication", async () => {
  const pos = await readFile(new URL("../app/pos/PosApp.tsx", import.meta.url), "utf8");
  const till = await readFile(new URL("../app/pos/till/TillApp.tsx", import.meta.url), "utf8");
  assert.ok(pos.indexOf("if (!view.authenticated") < pos.indexOf("data-pnys-shell"));
  assert.doesNotMatch(till, /Back to POS/);
});

test("a reconciled PNYS clone makes the login ready without changing live_state", async () => {
  const db = new MemoryDb() as MemoryDb & Pick<PosDb, "isReady">;
  db.isReady = async () => true;
  const service = new PosService(db, {
    sheet: new LocalSheet(),
    secrets: { shift: "s", roster: "r", poll: "p", session: "session-secret-value", admin: "a", cron: "c" },
    demo: null,
  });
  assert.deepEqual(await service.publicStatus(), { waiting_for_opening: false });
  const adapter = await readFile(new URL("../app/lib/pny-pos/supabaseState.ts", import.meta.url), "utf8");
  assert.match(adapter, /select exists\(select 1 from pnys_pos\.clone_audit/);
  assert.doesNotMatch(adapter, /update pnys_pos\.clone_audit/i);
});

test("label scans use the first number and the approved size mapping", () => {
  assert.equal(skuFromLabelText("261 DAYDREAM DIESEL 14g 461-B101"), "261-14g");
  assert.equal(skuFromLabelText("224S5gSP1026"), "224-5g");
  assert.deepEqual(matchScannedLabel("224S5gSP1026", [{ sku: "224-5g" }]), {
    ok: true,
    raw: "224S5gSP1026",
    sku: "224-5g",
    thcHidden: false,
  });
  assert.equal(skuFromLabelText("406 DAYDREAM 6g LOT 999"), "406-5g");
  assert.equal(skuFromLabelText("715 BACKWOODS"), "715");
  const catalog = [{ sku: "261-14g" }, { sku: "406-5g", thc_hidden: true }];
  assert.deepEqual(matchScannedLabel("261 DAYDREAM DIESEL 14g 461-B101", catalog), {
    ok: true, raw: "261 DAYDREAM DIESEL 14g 461-B101", sku: "261-14g", thcHidden: false,
  });
  assert.deepEqual(matchScannedLabel("406 DAYDREAM 6g", catalog), {
    ok: true, raw: "406 DAYDREAM 6g", sku: "406-5g", thcHidden: true,
  });
  assert.deepEqual(matchScannedLabel("999 UNKNOWN 14g", catalog), {
    ok: false, raw: "999 UNKNOWN 14g", reason: "NOT_FOUND",
  });
});

test("scanner keeps native and free fallback decoding and is wired to all count/refill surfaces", async () => {
  const scanner = await readFile(new URL("../app/pos/ProductScanner.tsx", import.meta.url), "utf8");
  const pos = await readFile(new URL("../app/pos/PosApp.tsx", import.meta.url), "utf8");
  const count = await readFile(new URL("../app/pos/CountCard.tsx", import.meta.url), "utf8");
  const refill = await readFile(new URL("../app/pos/RefillList.tsx", import.meta.url), "utf8");
  assert.match(scanner, /BarcodeDetector/);
  assert.match(scanner, /@zxing\/browser/);
  assert.match(scanner, /decodeFromStream/);
  assert.match(scanner, /import\("jsqr"\)/);
  assert.match(scanner, /adaptiveThreshold/);
  assert.match(scanner, /facingMode:\s*\{ ideal:\s*"environment"/);
  assert.match(scanner, /focusMode:\s*"continuous"/);
  assert.match(scanner, /NEXT_PUBLIC_PNYS_SCAN_ENABLED === "1"/);
  assert.match(scanner, /disabled=\{!scannerEnabled\}/);
  assert.match(scanner, /THC hidden this shift/);
  assert.match(pos, /data-testid="scan-button"|<ProductScanner/);
  assert.match(count, /<ProductScanner/);
  assert.match(refill, /<ProductScanner/);
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

test("till reconciliation gives every audited balance SKU a catalog row", () => {
  const skus = "1010,1019,1027,1070,1081,1082,204-14g,204-5g,222-14g,225-14g,225-5g,236-14g,236-5g,315-3g,340-3g,340-5g,347-3g,347-5g,376-3g,418-3g,418-5g,425-5g,426-3g,426-5g,428-3g,430-3g,430-5g,431-3g,431-5g,502-3g,502-5g,503-3g,503-5g,506-3g,506-5g,509-3g,509-5g,610,611,680,681,713,714,717,720,721,921,940,960,969".split(",");
  const state = {
    products: [],
    store_products: [],
    balances: skus.map((sku) => ({ store_code: "PNYS", sku, qty: 1, created_at: "old", updated_at: "old" })),
  } as Pick<State, "products" | "store_products" | "balances">;
  const items: ItemIndex = new Map([
    ["1070", { sku: "1070", name: "GEEK UNIVERSE 25k PUFFS NVape", category: "VAPE PENS", price_cents: 1800, image: null }],
    ["1082", { sku: "1082", name: "OVNS PIONEER", category: "VAPE PENS", price_cents: 2300, image: null }],
    ["921", { sku: "921", name: "MARS ROCKETS", category: "PREROLLS", price_cents: 2000, image: null }],
    ["940", { sku: "940", name: "2G THCVape KNOCK-OUT", category: "VAPE DISPOSABLE", price_cents: 5000, image: null }],
    ["969", { sku: "969", name: "NERD BOMBS 2x200mg", category: "EDIBLES", price_cents: 2000, image: null }],
  ]);
  const result = reconcileTillCatalog(state, "PNYS", "now", { flowers: new Map() as FlowerIndex, items });

  assert.equal(result.missingBalanceSkus.length, 0);
  assert.equal(state.products.length, 50);
  assert.equal(state.store_products.length, 50);
  assert.equal(state.products.find((row) => row.sku === "204-5g")?.default_price_cents, 2000);
  assert.equal(state.products.find((row) => row.sku === "204-5g")?.thc_flag, true);
  assert.equal(state.products.find((row) => row.sku === "1070")?.default_price_cents, 1800);
  assert.equal(state.products.find((row) => row.sku === "721")?.name, "BACKWOODS");
  assert.equal(state.products.find((row) => row.sku === "721")?.default_price_cents, 0);
  assert.equal(state.store_products.find((row) => row.sku === "721")?.enabled, false);
});

test("PNYS foundation matches PNY01 tax-included store setting and assumes the restricted app role", async () => {
  const foundation = await readFile(new URL("../scripts/pnys-foundation.ts", import.meta.url), "utf8");
  const adapter = await readFile(new URL("../app/lib/pny-pos/supabaseState.ts", import.meta.url), "utf8");
  assert.match(foundation, /prices_tax_included:\s*true/);
  assert.match(adapter, /set local role pnys_app/);
  assert.match(adapter, /set role pnys_app/);
});

test("PNYS poll paths are detached reads and legacy projection rewrites are removed", async () => {
  const adapter = await readFile(new URL("../app/lib/pny-pos/supabaseState.ts", import.meta.url), "utf8");
  const service = await readFile(new URL("../app/lib/pny-pos/service.ts", import.meta.url), "utf8");
  const feedRoute = await readFile(new URL("../app/api/sales/feed/route.ts", import.meta.url), "utf8");

  assert.match(adapter, /async peek\(\)/);
  assert.match(adapter, /if \(after === before\)/);
  assert.doesNotMatch(adapter, /async function project\(/);
  assert.doesNotMatch(adapter, /delete from \$\{schema\}/i);
  assert.match(service, /private async readState\(\)/);
  assert.match(service, /has_more: hasMore/);
  assert.match(feedRoute, /params\.get\("limit"\)/);
});

test("PNYS mutations take a database row lock before changing stock or command receipts", async () => {
  const adapter = await readFile(new URL("../app/lib/pny-pos/supabaseState.ts", import.meta.url), "utf8");
  assert.match(adapter, /select version, doc from \$\{schema\}\.live_state where store_code = \$1 for update/i);
});

test("outbox CRON authenticates even while integrations are off and reports failures with a non-2xx status", async () => {
  const route = await readFile(new URL("../app/api/cron/sheet-outbox/route.ts", import.meta.url), "utf8");
  const retry = await readFile(new URL("../app/api/pos/admin/outbox/retry/route.ts", import.meta.url), "utf8");
  const vercel = await readFile(new URL("../vercel.json", import.meta.url), "utf8");
  assert.ok(route.indexOf("cronOk(request)") < route.indexOf("INTEGRATIONS_ENABLED"));
  assert.match(route, /service\.outboxStatus\(\)/);
  assert.match(route, /result\.ok \? 200 : 503/);
  assert.match(retry, /retryOutboxFailures/);
  assert.match(retry, /adminToken\(\)/);
  assert.match(vercel, /\/api\/cron\/sheet-outbox/);
  assert.match(vercel, /"schedule": "\*\/1 \* \* \* \*"|"schedule": "\* \* \* \* \*"/);
});

test("the Release 2b4 register accounts for every B01-B25 item and names evidence for every fix", async () => {
  const register = await readFile(new URL("../docs/pnys-release-2b4-audit.md", import.meta.url), "utf8");
  const rows = [...register.matchAll(/^\| (B\d{2}) \| (fixed|already fixed|deferred) \| (.+) \| (.+) \|$/gm)];
  assert.deepEqual(rows.map((row) => row[1]), Array.from({ length: 25 }, (_, index) => `B${String(index + 1).padStart(2, "0")}`));
  for (const row of rows) {
    assert.ok(row[3]?.trim());
    assert.ok(row[4]?.trim());
    if (row[2] !== "deferred") assert.match(row[4] ?? "", /`[^`]+`/);
  }
});
