import { Pool, type PoolClient } from "pg";
import { emptyState, type PosDb, type Tx } from "./memory.ts";
import { enforceIntegrationOwner, enforceStoreWriteGate } from "./controls.ts";
import { PosError } from "./errors.ts";
import type { State } from "./types.ts";

export class StaleRevision extends Error {
  constructor() {
    super("stale revision");
    this.name = "StaleRevision";
  }
}

type StoreCode = "PNY01" | "PNY02";

function asState(doc: unknown): State {
  if (!doc || typeof doc !== "object" || !Array.isArray((doc as State).shifts)) return emptyState();
  return doc as State;
}

function rows(client: PoolClient, sql: string, params: unknown[]) {
  return client.query(sql, params);
}

async function project(client: PoolClient, store: StoreCode, state: State) {
  const shifts = state.shifts.filter((row) => row.store_code === store);
  const shiftIds = new Set(shifts.map((row) => row.id));
  const sales = state.sales.filter((row) => shiftIds.has(row.shift_id));
  const deposits = state.deposits.filter((row) => shiftIds.has(row.shift_id));
  const counts = state.counts.filter((row) => shiftIds.has(row.shift_id));
  const refills = state.incoming.filter((row) => row.store_code === store);
  const closings = state.closings.filter((row) => shiftIds.has(row.shift_id));
  for (const table of ["shift", "sale", "deposit", "stock_count", "refill", "closing"]) {
    await rows(client, `delete from pny_pos.${table} where store_code = $1`, [store]);
  }
  for (const row of shifts) {
    await rows(client, `insert into pny_pos.shift (id, store_code, staff_uid, status, started_at, ended_at, doc) values ($1,$2,$3,$4,$5,$6,$7)`, [row.id, store, row.staff_uid, row.status, row.started_at, row.ended_at, JSON.stringify(row)]);
  }
  for (const row of sales) {
    await rows(client, `insert into pny_pos.sale (id, store_code, shift_id, payment_method, status, total_cents, created_at, doc) values ($1,$2,$3,$4,$5,$6,$7,$8)`, [row.id, store, row.shift_id, row.payment_method, row.status, row.total_cents, row.created_at, JSON.stringify(row)]);
  }
  for (const row of deposits) {
    await rows(client, `insert into pny_pos.deposit (id, store_code, shift_id, amount_cents, deposit_code, created_at, doc) values ($1,$2,$3,$4,$5,$6,$7)`, [row.id, store, row.shift_id, row.amount_cents, row.deposit_code ?? null, row.created_at, JSON.stringify(row)]);
  }
  for (const row of counts) {
    await rows(client, `insert into pny_pos.stock_count (id, store_code, shift_id, kind, doc) values ($1,$2,$3,$4,$5)`, [row.id, store, row.shift_id, row.kind, JSON.stringify(row)]);
  }
  for (const row of refills) {
    await rows(client, `insert into pny_pos.refill (kitchen_row_id, store_code, sku, qty_sent, status, doc) values ($1,$2,$3,$4,$5,$6)`, [row.kitchen_row_id, store, row.sku, row.qty_sent, row.status, JSON.stringify(row)]);
  }
  for (const row of closings) {
    await rows(client, `insert into pny_pos.closing (shift_id, store_code, float_cents, deposited_cents, cash_sales_cents, doc) values ($1,$2,$3,$4,$5,$6)`, [row.shift_id, store, row.float_cents ?? 0, row.deposited_cents, row.cash_sales_cents ?? row.sales_total_cents, JSON.stringify(row)]);
  }
}

export function createSupabaseStateDb(connectionString: string, store: StoreCode): PosDb {
  const pool = new Pool({
    connectionString,
    max: 3,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  let tail: Promise<void> = Promise.resolve();
  const db: PosDb & { peek(): Promise<State> } = {
    async assertIntegrationOwner(channel) {
      const client = await pool.connect();
      try {
        const result = await client.query(
          "select channel,owner_store_code,generation,cutover_id from pos_hub.integration_owner where channel=$1 and enabled=true",
          [channel],
        );
        return enforceIntegrationOwner(channel, store, result.rows[0]);
      } finally {
        client.release();
      }
    },
    async deliveredIntegrationEvents(channel, cutoverId, eventIds) {
      if (eventIds.length === 0) return new Set<string>();
      const client = await pool.connect();
      try {
        const result = await client.query(
          "select event_id from pos_hub.integration_delivery where channel=$1 and cutover_id=$2 and event_id=any($3::text[])",
          [channel, cutoverId, eventIds],
        );
        return new Set(result.rows.map((row) => String(row.event_id)));
      } finally {
        client.release();
      }
    },
    async recordIntegrationDelivery(lease, eventId, receipt = {}) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const owner = await client.query(
          "select 1 from pos_hub.integration_owner where channel=$1 and owner_store_code=$2 and generation=$3 and cutover_id=$4 and enabled=true for update",
          [lease.channel, store, lease.generation, lease.cutover_id],
        );
        if (owner.rowCount !== 1) throw new PosError(423, "INTEGRATION_NOT_OWNER", `${lease.channel} ownership changed before delivery acknowledgement.`);
        const saved = await client.query(
          "insert into pos_hub.integration_delivery(channel,cutover_id,event_id,owner_store_code,generation,receipt) values($1,$2,$3,$4,$5,$6::jsonb) on conflict(channel,cutover_id,event_id) do nothing returning id",
          [lease.channel, lease.cutover_id, eventId, store, lease.generation, JSON.stringify(receipt)],
        );
        await client.query("commit");
        return saved.rowCount === 1;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async peek() {
      const client = await pool.connect();
      try {
        const loaded = await client.query(`select doc from pny_pos.live_state where store_code = $1`, [store]);
        return asState(loaded.rows[0]?.doc);
      } finally {
        client.release();
      }
    },
    transaction(fn) {
      const run = tail.then(() => runOnce(fn));
      tail = run.then(() => undefined, () => undefined);
      return run;
    },
  };

  async function runOnce<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const loaded = await client.query(`select version, doc from pny_pos.live_state where store_code = $1 for update`, [store]);
        const version = Number(loaded.rows[0]?.version ?? 0);
        const snapshot = structuredClone(asState(loaded.rows[0]?.doc)) as State;
        const before = JSON.stringify(snapshot);
        const result = await fn({ state: snapshot });
        const after = JSON.stringify(snapshot);
        if (after === before) {
          await client.query("commit");
          return result;
        }
        const runtime = await client.query("select write_mode,generation from pos_hub.store_runtime where store_code=$1", [store]);
        enforceStoreWriteGate(runtime.rows[0]);
        const saved = await client.query(
          `update pny_pos.live_state set doc = $1::jsonb, version = version + 1, updated_at = now() where store_code = $2 and version = $3 returning version`,
          [after, store, version],
        );
        if (saved.rowCount !== 1) throw new StaleRevision();
        await project(client, store, snapshot);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        if (!(error instanceof StaleRevision) || attempt === 2) throw error;
      } finally {
        client.release();
      }
    }
    throw new StaleRevision();
  }

  return db;
}
