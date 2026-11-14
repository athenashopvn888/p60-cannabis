import { STORE_CODE, STORE_TZ } from "./constants.ts";
import { deploymentGeneration, type IntegrationChannel, type IntegrationLease, type StoreWriteMode } from "./controls.ts";
import { PosError } from "./errors.ts";
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
        weed_in_store: true,
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
  assertIntegrationOwner?: (channel: IntegrationChannel) => Promise<IntegrationLease>;
  deliveredIntegrationEvents?: (channel: IntegrationChannel, cutoverId: string, eventIds: string[]) => Promise<Set<string>>;
  recordIntegrationDelivery?: (lease: IntegrationLease, eventId: string, receipt?: Record<string, unknown>) => Promise<boolean>;
}

export class MemoryDb implements PosDb {
  state: State;
  onCommit?: (state: State) => void;
  writeMode: StoreWriteMode = "ACTIVE";
  generation = deploymentGeneration() || 1;
  integrationOwners = new Map<IntegrationChannel, IntegrationLease>();
  integrationDeliveries = new Set<string>();
  private tail: Promise<void> = Promise.resolve();

  constructor(state?: State) {
    this.state = state ?? emptyState();
  }

  async peek() {
    return structuredClone(this.state) as State;
  }

  async assertIntegrationOwner(channel: IntegrationChannel) {
    const lease = this.integrationOwners.get(channel) ?? {
      channel,
      owner_store_code: STORE_CODE,
      generation: this.generation,
      cutover_id: "MEMORY",
    };
    if (lease.owner_store_code !== STORE_CODE || lease.generation !== this.generation) {
      throw new PosError(423, "INTEGRATION_NOT_OWNER", `${channel} is owned by another deployment.`);
    }
    return lease;
  }

  async deliveredIntegrationEvents(channel: IntegrationChannel, cutoverId: string, eventIds: string[]) {
    return new Set(eventIds.filter((eventId) => this.integrationDeliveries.has(`${channel}:${cutoverId}:${eventId}`)));
  }

  async recordIntegrationDelivery(lease: IntegrationLease, eventId: string) {
    const current = await this.assertIntegrationOwner(lease.channel);
    if (current.owner_store_code !== lease.owner_store_code || current.generation !== lease.generation || current.cutover_id !== lease.cutover_id) {
      throw new PosError(423, "INTEGRATION_STALE_LEASE", `${lease.channel} ownership changed before delivery was recorded.`);
    }
    const key = `${lease.channel}:${lease.cutover_id}:${eventId}`;
    if (this.integrationDeliveries.has(key)) return false;
    this.integrationDeliveries.add(key);
    return true;
  }

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const snapshot = structuredClone(this.state) as State;
      const result = await fn({ state: snapshot });
      if (JSON.stringify(snapshot) !== JSON.stringify(this.state) && this.writeMode !== "ACTIVE") {
        throw new PosError(423, "STORE_WRITE_BLOCKED", `Store writes are ${this.writeMode}.`);
      }
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
