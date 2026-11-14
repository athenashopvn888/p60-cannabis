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
export type TransactionKind = "OPERATIONAL" | "AUTH_SESSION";
export type TransactionOptions = { kind?: TransactionKind };

/**
 * Authentication is the only mutation allowed by a frozen PNYS preview.
 * Keep this deliberately narrow: sessions, authentication audit rows and the
 * few shift fields used by PIN expiry/failure tracking may change. Stock,
 * sales, refills, counts, deposits, integrations and shift lifecycle may not.
 */
export function isAuthSessionOnlyChange(before: State, after: State) {
  const normalized = structuredClone(after) as State;
  normalized.sessions = structuredClone(before.sessions);
  normalized.admin_sessions = structuredClone(before.admin_sessions);
  normalized.audit = structuredClone(before.audit);
  if (normalized.shifts.length !== before.shifts.length) return false;
  const beforeShifts = new Map(before.shifts.map((shift) => [shift.id, shift]));
  for (const shift of normalized.shifts) {
    const original = beforeShifts.get(shift.id);
    if (!original) return false;
    shift.pin_failed_attempts = original.pin_failed_attempts;
    shift.pin_expires_at = original.pin_expires_at;
    shift.verify_opened_at = original.verify_opened_at;
    shift.verify_release = original.verify_release;
  }
  return JSON.stringify(normalized) === JSON.stringify(before);
}

export interface PosDb {
  transaction<T>(fn: (tx: Tx) => Promise<T>, options?: TransactionOptions): Promise<T>;
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
  allowFrozenPreviewAuth = false;
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

  transaction<T>(fn: (tx: Tx) => Promise<T>, options: TransactionOptions = {}): Promise<T> {
    const run = this.tail.then(async () => {
      const snapshot = structuredClone(this.state) as State;
      const result = await fn({ state: snapshot });
      const changed = JSON.stringify(snapshot) !== JSON.stringify(this.state);
      if (changed && this.writeMode !== "ACTIVE") {
        const frozenPreviewAuth = this.writeMode === "FROZEN"
          && this.allowFrozenPreviewAuth
          && options.kind === "AUTH_SESSION"
          && isAuthSessionOnlyChange(this.state, snapshot);
        if (!frozenPreviewAuth) throw new PosError(423, "STORE_WRITE_BLOCKED", "Store frozen");
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
