import { STORE_CODE, STORE_TZ } from "./constants.ts";
import type { State } from "./types.ts";

export function emptyState(now = new Date().toISOString()): State {
  return {
    stores: [
      {
        code: STORE_CODE,
        name: "PNY",
        active: true,
        timezone: STORE_TZ,
        prices_tax_included: true,
        ticket_letter_seq: 0,
        created_at: now,
      },
    ],
    products: [],
    store_products: [],
    ledger: [],
    balances: [],
    staff: [],
    shifts: [],
    sessions: [],
    incoming: [],
    counts: [],
    count_lines: [],
    tickets: [],
    ticket_lines: [],
    sales: [],
    sale_lines: [],
    deposits: [],
    closings: [],
    closing_drafts: [],
    idempotency: [],
    outbox: [],
    cursors: [],
    audit: [],
    admin_sessions: [],
    customers: [],
    customer_consents: [],
    customer_visits: [],
    coupons: [],
    coupon_redemptions: [],
    deposit_seq: 0,
  };
}

export type Tx = { state: State };

export interface PosDb {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Read a detached snapshot without committing or projecting it. */
  peek?: () => Promise<State>;
  /** Read-only deployment readiness signal, independent of mutable till state. */
  isReady?: () => Promise<boolean>;
  /** Best-effort hook after a commit. Must not throw into the sale. */
  onCommit?: (state: State) => void;
}

export class MemoryDb implements PosDb {
  state: State;
  onCommit?: (state: State) => void;
  private tail: Promise<void> = Promise.resolve();

  constructor(state?: State) {
    this.state = state ?? emptyState();
  }

  async peek() {
    return structuredClone(this.state) as State;
  }

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const snapshot = structuredClone(this.state) as State;
      const result = await fn({ state: snapshot });
      this.state = snapshot;
      try {
        this.onCommit?.(snapshot);
      } catch {
        // Stock history must not undo a committed sale.
      }
      return result;
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
