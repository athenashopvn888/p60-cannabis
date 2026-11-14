import { STORE_CODE, STORE_TZ } from "./constants.ts";
import type { IntegrationChannel, IntegrationLease } from "./controls.ts";
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
    deposit_seq: 0,
  };
}

export type Tx = { state: State };

export interface PosDb {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  peek?: () => Promise<State>;
  assertIntegrationOwner?: (channel: IntegrationChannel) => Promise<IntegrationLease>;
  deliveredIntegrationEvents?: (channel: IntegrationChannel, cutoverId: string, eventIds: string[]) => Promise<Set<string>>;
  recordIntegrationDelivery?: (lease: IntegrationLease, eventId: string, receipt?: Record<string, unknown>) => Promise<boolean>;
  /** Best-effort hook after a commit. Must not throw into the sale. */
  onCommit?: (state: State) => void;
}

export class MemoryDb implements PosDb {
  state: State;
  onCommit?: (state: State) => void;
  private integrationDeliveries = new Set<string>();
  private tail: Promise<void> = Promise.resolve();

  constructor(state?: State) {
    this.state = state ?? emptyState();
  }

  async assertIntegrationOwner(channel: IntegrationChannel) {
    return { channel, owner_store_code: STORE_CODE, generation: 1, cutover_id: "MEMORY" };
  }

  async deliveredIntegrationEvents(channel: IntegrationChannel, cutoverId: string, eventIds: string[]) {
    return new Set(eventIds.filter((eventId) => this.integrationDeliveries.has(`${channel}:${cutoverId}:${eventId}`)));
  }

  async recordIntegrationDelivery(lease: IntegrationLease, eventId: string) {
    const key = `${lease.channel}:${lease.cutover_id}:${eventId}`;
    if (this.integrationDeliveries.has(key)) return false;
    this.integrationDeliveries.add(key);
    return true;
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
