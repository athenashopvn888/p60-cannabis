import { createHash } from "node:crypto";
import { skuSortKey } from "./flowerSku.ts";
import type { State } from "./types.ts";

export const GUMMY_CATALOG = [
  { sku: "656", name: "KNOCK OUT GUMMIES 3000MG", category: "EDIBLES", price_cents: 3500 },
  { sku: "657", name: "KNOCK OUT GUMMIES 5000MG", category: "EDIBLES", price_cents: 5000 },
] as const;

export type GummyFixStore = "PNY01" | "PNYS";

const IDS: Record<GummyFixStore, {
  batch: string;
  audit: string;
  incoming: Record<"656" | "657", string>;
  ledger: Record<"656" | "657", string>;
}> = {
  PNY01: {
    batch: "RANDY-PNY01-2026-11-15-KNOCK-OUT",
    audit: "65665701-1115-4000-8000-000000000001",
    incoming: {
      "656": "65665701-1115-4000-8000-000000000656",
      "657": "65665701-1115-4000-8000-000000000657",
    },
    ledger: {
      "656": "65665701-1115-4000-9000-000000000656",
      "657": "65665701-1115-4000-9000-000000000657",
    },
  },
  PNYS: {
    batch: "RANDY-PNYS-2026-11-15-KNOCK-OUT",
    audit: "65665702-1115-4000-8000-000000000001",
    incoming: {
      "656": "65665702-1115-4000-8000-000000000656",
      "657": "65665702-1115-4000-8000-000000000657",
    },
    ledger: {
      "656": "65665702-1115-4000-9000-000000000656",
      "657": "65665702-1115-4000-9000-000000000657",
    },
  },
};

function qty(state: State, store: GummyFixStore, sku: string) {
  return state.balances.find((row) => (row.store_code ?? store) === store && row.sku === sku)?.qty ?? 0;
}

export function gummyRecoveryBatch(store: GummyFixStore) {
  return IDS[store].batch;
}

export function gummyFixChecksum(state: State) {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}

export function applyGummyCatalogRefill(state: State, store: GummyFixStore, at: string) {
  const blocked = state.shifts.find((row) => row.store_code === store && ["ACTIVE", "LOCKED", "CLOSING"].includes(row.status));
  if (blocked) throw new Error(`${store}_SHIFT_OPEN`);

  const ids = IDS[store];
  const batchRows = state.incoming.filter((row) => row.store_code === store && row.batch_id === ids.batch);
  if (batchRows.length > 0) {
    const complete = GUMMY_CATALOG.every((item) => batchRows.some((row) => row.sku === item.sku && row.qty_sent === 2));
    if (!complete || batchRows.length !== GUMMY_CATALOG.length) throw new Error(`${store}_PARTIAL_RECOVERY_BATCH`);
    return {
      changed: false,
      store,
      batch_id: ids.batch,
      before: Object.fromEntries(GUMMY_CATALOG.map((item) => [item.sku, qty(state, store, item.sku)])),
      after: Object.fromEntries(GUMMY_CATALOG.map((item) => [item.sku, qty(state, store, item.sku)])),
    };
  }

  const before = Object.fromEntries(GUMMY_CATALOG.map((item) => [item.sku, qty(state, store, item.sku)]));
  for (const item of GUMMY_CATALOG) {
    const product = state.products.find((row) => row.sku === item.sku);
    if (product) {
      product.name = item.name;
      product.category = item.category;
      product.default_price_cents = item.price_cents;
      product.setb_active = true;
      product.thc_flag = true;
      product.synced_at = at;
    } else {
      state.products.push({
        sku: item.sku,
        sku_sort: skuSortKey(item.sku),
        name: item.name,
        category: item.category,
        default_price_cents: item.price_cents,
        image_url: null,
        setb_active: true,
        thc_flag: true,
        synced_at: at,
        created_at: at,
      });
    }

    const storeProduct = state.store_products.find((row) => row.store_code === store && row.sku === item.sku);
    if (storeProduct) {
      storeProduct.enabled = true;
      storeProduct.price_override_cents = null;
      storeProduct.updated_at = at;
    } else {
      state.store_products.push({
        store_code: store,
        sku: item.sku,
        enabled: true,
        price_override_cents: null,
        created_at: at,
        updated_at: at,
      });
    }

    const balance = state.balances.find((row) => (row.store_code ?? store) === store && row.sku === item.sku);
    if (balance) {
      balance.qty += 2;
      balance.updated_at = at;
    } else {
      state.balances.push({ sku: item.sku, qty: 2, store_code: store, created_at: at, updated_at: at });
    }

    state.incoming.push({
      kitchen_row_id: ids.incoming[item.sku],
      batch_id: ids.batch,
      store_code: store,
      sku: item.sku,
      qty_sent: 2,
      kind: "REFILL",
      kitchen_created_at: at,
      imported_at: at,
      status: "CONFIRMED",
      qty_received: 2,
      variance_reason: null,
      confirmed_shift_id: null,
      confirmed_at: at,
      linked_ledger_id: ids.ledger[item.sku],
      created_at: at,
    });
    state.ledger.push({
      id: ids.ledger[item.sku],
      sku: item.sku,
      qty_delta: 2,
      movement_type: "INCOMING_CONFIRM",
      ref_type: "incoming",
      ref_id: ids.incoming[item.sku],
      actor: "Randy",
      reason: "Catalog recovery for Randy refill",
      shift_id: null,
      created_at: at,
      store_code: store,
    });
  }

  const after = Object.fromEntries(GUMMY_CATALOG.map((item) => [item.sku, qty(state, store, item.sku)]));
  state.audit.push({
    id: ids.audit,
    action: "CATALOG_REFILL_RECOVERY",
    ref_type: "refill_batch",
    ref_id: ids.batch,
    actor: "Codex for Tri",
    detail: { requested_by: "Tri", refill_staff: "Randy", before, after, units: 4 },
    created_at: at,
  });
  return { changed: true, store, batch_id: ids.batch, before, after };
}
