import { STORE_CODE, STORE_TZ } from "./constants.ts";
import { skuSortKey } from "./flowerSku.ts";
import { catalogFromFeed, readCommittedPnyCatalog, type SetbProduct } from "./setbFeed.ts";
import type { State } from "./types.ts";

const SHIFT_ID = "11111111-1111-4111-8111-111111111111";
const SALE_ID = "22222222-2222-4222-8222-222222222222";
const TICKET_A = "33333333-3333-4333-8333-333333333333";
const TICKET_B = "44444444-4444-4444-8444-444444444444";

/** Demo quantities only. They are not SETB on-hand. */
const DEMO_QTY = [8, 6, 10, 4, 0, 3, 5, 2, 7, 1];

function demoCatalog(): SetbProduct[] {
  return catalogFromFeed(readCommittedPnyCatalog()).sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
}

/** Sample PNY01 till. Every name is marked DEMO. Stock here is not the public store menu. */
export function applyDemoSeed(state: State, now: Date, demoPinHash: string | null = null) {
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
  const catalog = demoCatalog();
  const priced = catalog.filter((product) => product.price_cents > 0);
  const inactiveSku = priced[priced.length - 1]?.sku ?? "";
  const disabledSku = priced[priced.length - 2]?.sku ?? "";
  const openingFor = (sku: string) => DEMO_QTY[Math.max(0, catalog.findIndex((product) => product.sku === sku)) % DEMO_QTY.length];
  const sale = priced.find((product) => product.sku !== inactiveSku && product.sku !== disabledSku && openingFor(product.sku) >= 2) ?? priced[0];
  if (!sale) return;
  for (const [index, product] of catalog.entries()) {
    const opening = DEMO_QTY[index % DEMO_QTY.length];
    const active = product.sku !== inactiveSku && product.price_cents > 0;
    const enabled = active && product.sku !== disabledSku;
    state.products.push({
      sku: product.sku,
      sku_sort: skuSortKey(product.sku),
      name: product.name,
      category: product.category,
      default_price_cents: product.price_cents,
      image_url: product.image_url,
      setb_active: active,
      synced_at: at,
      created_at: at,
    });
    state.store_products.push({
      store_code: STORE_CODE,
      sku: product.sku,
      enabled,
      price_override_cents: null,
      created_at: at,
      updated_at: at,
    });
    const qty = product.sku === sale.sku ? opening - 1 : opening;
    state.balances.push({ sku: product.sku, qty, updated_at: at, created_at: at });
    state.ledger.push({
      id: crypto.randomUUID(),
      sku: product.sku,
      qty_delta: opening,
      movement_type: "OPENING_BALANCE",
      ref_type: "seed",
      ref_id: "demo",
      actor: "seed",
      reason: "DEMO stock, not SETB on-hand",
      shift_id: null,
      created_at: at,
    });
  }
  state.ledger.push({
    id: crypto.randomUUID(),
    sku: sale.sku,
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
    pin_hash: demoPinHash,
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
    total_cents: sale.price_cents,
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
    sku: sale.sku,
    qty: 1,
    unit_price_cents: sale.price_cents,
    price_source: "SETB_DEFAULT",
    line_total_cents: sale.price_cents,
  });
  state.deposits.push({
    id: crypto.randomUUID(),
    shift_id: SHIFT_ID,
    staff_uid: "staff-demo-tri",
    amount_cents: Math.min(500, sale.price_cents),
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
  const ticketProducts = priced.filter((product) => product.sku !== sale.sku && product.sku !== inactiveSku && product.sku !== disabledSku).slice(0, 2);
  const ticketA = ticketProducts[0] ?? sale;
  const ticketB = ticketProducts[1] ?? sale;
  state.ticket_lines.push(
    { id: crypto.randomUUID(), ticket_id: TICKET_A, sku: ticketA.sku, qty: 1, unit_price_cents_snapshot: ticketA.price_cents },
    { id: crypto.randomUUID(), ticket_id: TICKET_B, sku: ticketB.sku, qty: 2, unit_price_cents_snapshot: ticketB.price_cents },
  );
  const pendingSkus = ["504-3g", "507-3g"].filter((sku) => catalog.some((product) => product.sku === sku));
  for (const [index, sku] of pendingSkus.entries()) {
    state.incoming.push({
      kitchen_row_id: `55555555-5555-4555-8555-55555555555${index}`,
      batch_id: "demo-pending",
      store_code: STORE_CODE,
      sku,
      qty_sent: index === 0 ? 2 : 1,
      kind: "REFILL",
      kitchen_created_at: at,
      imported_at: at,
      status: "PENDING_CONFIRM",
      qty_received: null,
      variance_reason: null,
      confirmed_shift_id: null,
      confirmed_at: null,
      linked_ledger_id: null,
      created_at: at,
    });
  }
  const issueSku = catalog.some((product) => product.sku === "490-3g") ? "490-3g" : "";
  if (issueSku) {
    const balance = state.balances.find((row) => row.sku === issueSku);
    if (balance) balance.qty += 2;
    state.ledger.push({
      id: crypto.randomUUID(),
      sku: issueSku,
      qty_delta: 2,
      movement_type: "INCOMING_CONFIRM",
      ref_type: "incoming",
      ref_id: "demo-refill-issue",
      actor: "staff-demo-tri",
      reason: null,
      shift_id: SHIFT_ID,
      created_at: at,
    });
    state.incoming.push({
      kitchen_row_id: "66666666-6666-4666-8666-666666666666",
      batch_id: "demo-issue",
      store_code: STORE_CODE,
      sku: issueSku,
      qty_sent: 4,
      kind: "REFILL",
      kitchen_created_at: at,
      imported_at: at,
      status: "PARTIAL",
      qty_received: 2,
      variance_reason: null,
      confirmed_shift_id: SHIFT_ID,
      confirmed_at: at,
      linked_ledger_id: null,
      created_at: at,
    });
  }
  state.closing_drafts.push({
    shift_id: SHIFT_ID,
    counts: state.balances.filter((row) => row.qty > 0).map((row) => ({ sku: row.sku, counted_qty: row.qty })),
    opening_counts: [],
    final_deposit_cents: null,
    updated_at: at,
  });
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
