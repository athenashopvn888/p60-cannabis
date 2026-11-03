import { DEMO_PIN, STORE_CODE, STORE_TZ } from "./constants.ts";
import { hashPin } from "./crypto.ts";
import type { State } from "./types.ts";

const SHIFT_ID = "11111111-1111-4111-8111-111111111111";
const SALE_ID = "22222222-2222-4222-8222-222222222222";
const TICKET_A = "33333333-3333-4333-8333-333333333333";
const TICKET_B = "44444444-4444-4444-8444-444444444444";

type SeedProduct = {
  sku: string;
  name: string;
  category: string;
  price: number;
  qty: number;
  enabled?: boolean;
  active?: boolean;
};

const PRODUCTS: SeedProduct[] = [
  { sku: "1001", name: "DEMO Flower — Pad Thai", category: "Flower", price: 1200, qty: 9 },
  { sku: "1002", name: "DEMO Edible — Mango Gummies", category: "Edible", price: 1500, qty: 6 },
  { sku: "1003", name: "DEMO Pre-Roll — Citrus", category: "Pre-Roll", price: 800, qty: 10 },
  { sku: "1004", name: "DEMO Vape — Night Cart", category: "Vape", price: 4200, qty: 4 },
  { sku: "1005", name: "DEMO Concentrate — Hash Coin", category: "Concentrate", price: 2000, qty: 0 },
  { sku: "1006", name: "DEMO Disabled Tint", category: "Flower", price: 900, qty: 3, enabled: false },
  { sku: "1007", name: "DEMO Inactive SETB", category: "Flower", price: 900, qty: 3, active: false },
];

/** Sample PNY01 till. Every name is marked DEMO. Stock here is not the public store menu. */
export function applyDemoSeed(state: State, now: Date) {
  const at = now.toISOString();
  const store = state.stores.find((row) => row.code === STORE_CODE);
  if (store) store.ticket_letter_seq = 1;
  state.staff.push({
    staff_uid: "staff-demo-tri",
    sccx_id: "demo-sccx-tri",
    pos_id: "DEMO1",
    display_name: "Demo Budtender",
    active: true,
    updated_at: at,
    created_at: at,
  });
  for (const product of PRODUCTS) {
    state.products.push({
      sku: product.sku,
      sku_sort: Number(product.sku),
      name: product.name,
      category: product.category,
      default_price_cents: product.price,
      setb_active: product.active !== false,
      synced_at: at,
      created_at: at,
    });
    state.store_products.push({
      store_code: STORE_CODE,
      sku: product.sku,
      enabled: product.enabled !== false && product.active !== false,
      price_override_cents: null,
      created_at: at,
      updated_at: at,
    });
    state.balances.push({ sku: product.sku, qty: product.qty, updated_at: at, created_at: at });
    state.ledger.push({
      id: crypto.randomUUID(),
      sku: product.sku,
      qty_delta: product.qty,
      movement_type: "OPENING_BALANCE",
      ref_type: "seed",
      ref_id: "demo",
      actor: "seed",
      reason: "DEMO opening balance",
      shift_id: null,
      created_at: at,
    });
  }
  const flower = state.balances.find((row) => row.sku === "1001");
  if (flower) {
    flower.qty = 8;
    flower.updated_at = at;
  }
  state.ledger.push({
    id: crypto.randomUUID(),
    sku: "1001",
    qty_delta: -1,
    movement_type: "SALE",
    ref_type: "sale",
    ref_id: SALE_ID,
    actor: "staff-demo-tri",
    reason: null,
    shift_id: SHIFT_ID,
    created_at: at,
  });
  state.shifts.push({
    id: SHIFT_ID,
    sccx_shift_id: "demo-shift-1",
    staff_uid: "staff-demo-tri",
    store_code: STORE_CODE,
    ticket_letter: "A",
    ticket_seq: 102,
    pin_hash: hashPin(DEMO_PIN),
    pin_expires_at: new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString(),
    pin_failed_attempts: 0,
    status: "ACTIVE",
    started_at: at,
    ended_at: null,
    end_reason: null,
    opening_confirmed_at: at,
    refill_confirmed_at: at,
    created_at: at,
  });
  state.sales.push({
    id: SALE_ID,
    ref_no: "PNY01-00001",
    shift_id: SHIFT_ID,
    staff_uid: "staff-demo-tri",
    ticket_id: null,
    total_cents: 1200,
    prices_tax_included: true,
    payment_method: "CASH",
    status: "COMPLETED",
    void_reason: null,
    voided_by: null,
    created_at: at,
  });
  state.sale_lines.push({
    id: crypto.randomUUID(),
    sale_id: SALE_ID,
    sku: "1001",
    qty: 1,
    unit_price_cents: 1200,
    price_source: "SETB_DEFAULT",
    line_total_cents: 1200,
  });
  state.deposits.push({
    id: crypto.randomUUID(),
    shift_id: SHIFT_ID,
    staff_uid: "staff-demo-tri",
    amount_cents: 500,
    note: "DEMO drop",
    created_at: at,
  });
  state.tickets.push(
    {
      id: TICKET_A,
      shift_id: SHIFT_ID,
      code: "A101",
      status: "PENDING",
      source: "QR",
      expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      created_at: at,
    },
    {
      id: TICKET_B,
      shift_id: SHIFT_ID,
      code: "A102",
      status: "PENDING",
      source: "QR",
      expires_at: new Date(now.getTime() + 25 * 60 * 1000).toISOString(),
      created_at: at,
    },
  );
  state.ticket_lines.push(
    { id: crypto.randomUUID(), ticket_id: TICKET_A, sku: "1002", qty: 1, unit_price_cents_snapshot: 1500 },
    { id: crypto.randomUUID(), ticket_id: TICKET_B, sku: "1003", qty: 2, unit_price_cents_snapshot: 800 },
  );
  state.audit.push({
    id: crypto.randomUUID(),
    action: "DEMO_SEED",
    ref_type: "store",
    ref_id: STORE_CODE,
    actor: "seed",
    detail: { label: "DEMO DATA", timezone: STORE_TZ },
    created_at: at,
  });
}
