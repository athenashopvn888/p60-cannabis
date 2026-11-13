import { Pool, type PoolClient } from "pg";
import { emptyState, type PosDb, type Tx } from "./memory.ts";
import type { State } from "./types.ts";
import type { StoreCode } from "./storeProfile.ts";

export class StaleRevision extends Error {
  constructor() {
    super("stale revision");
    this.name = "StaleRevision";
  }
}

type StateSchema = "pny_pos" | "pnys_pos";

function asState(doc: unknown): State {
  if (!doc || typeof doc !== "object" || !Array.isArray((doc as State).shifts)) return emptyState();
  return doc as State;
}

function rows(client: PoolClient, sql: string, params: unknown[]) {
  return client.query(sql, params);
}

async function project(client: PoolClient, store: StoreCode, state: State, schema: StateSchema) {
  const shifts = state.shifts.filter((row) => row.store_code === store);
  const shiftIds = new Set(shifts.map((row) => row.id));
  const sales = state.sales.filter((row) => shiftIds.has(row.shift_id));
  const deposits = state.deposits.filter((row) => shiftIds.has(row.shift_id));
  const counts = state.counts.filter((row) => shiftIds.has(row.shift_id));
  const refills = state.incoming.filter((row) => row.store_code === store);
  const closings = state.closings.filter((row) => shiftIds.has(row.shift_id));
  for (const table of ["shift", "sale", "deposit", "stock_count", "refill", "closing"]) {
    await rows(client, `delete from ${schema}.${table} where store_code = $1`, [store]);
  }
  for (const row of shifts) {
    await rows(client, `insert into ${schema}.shift (id, store_code, staff_uid, status, started_at, ended_at, doc) values ($1,$2,$3,$4,$5,$6,$7)`, [row.id, store, row.staff_uid, row.status, row.started_at, row.ended_at, JSON.stringify(row)]);
  }
  for (const row of sales) {
    await rows(client, `insert into ${schema}.sale (id, store_code, shift_id, payment_method, status, total_cents, created_at, doc) values ($1,$2,$3,$4,$5,$6,$7,$8)`, [row.id, store, row.shift_id, row.payment_method, row.status, row.total_cents, row.created_at, JSON.stringify(row)]);
  }
  for (const row of deposits) {
    await rows(client, `insert into ${schema}.deposit (id, store_code, shift_id, amount_cents, deposit_code, created_at, doc) values ($1,$2,$3,$4,$5,$6,$7)`, [row.id, store, row.shift_id, row.amount_cents, row.deposit_code ?? null, row.created_at, JSON.stringify(row)]);
  }
  for (const row of counts) {
    await rows(client, `insert into ${schema}.stock_count (id, store_code, shift_id, kind, doc) values ($1,$2,$3,$4,$5)`, [row.id, store, row.shift_id, row.kind, JSON.stringify(row)]);
  }
  for (const row of refills) {
    await rows(client, `insert into ${schema}.refill (kitchen_row_id, store_code, sku, qty_sent, status, doc) values ($1,$2,$3,$4,$5,$6)`, [row.kitchen_row_id, store, row.sku, row.qty_sent, row.status, JSON.stringify(row)]);
  }
  for (const row of closings) {
    await rows(client, `insert into ${schema}.closing (shift_id, store_code, float_cents, deposited_cents, cash_sales_cents, doc) values ($1,$2,$3,$4,$5,$6)`, [row.shift_id, store, row.float_cents ?? 0, row.deposited_cents, row.cash_sales_cents ?? row.sales_total_cents, JSON.stringify(row)]);
  }
}

export function createSupabaseStateDb(connectionString: string, store: StoreCode, schema: StateSchema = "pny_pos"): PosDb {
  const pool = new Pool({
    connectionString,
    max: 3,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  let tail: Promise<void> = Promise.resolve();
  const db: PosDb & { peek(): Promise<State> } = {
    async peek() {
      const client = await pool.connect();
      try {
        const loaded = await client.query(`select doc from ${schema}.live_state where store_code = $1`, [store]);
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
        const loaded = await client.query(`select version, doc from ${schema}.live_state where store_code = $1`, [store]);
        const version = Number(loaded.rows[0]?.version ?? 0);
        const snapshot = structuredClone(asState(loaded.rows[0]?.doc)) as State;
        const result = await fn({ state: snapshot });
        const saved = await client.query(
          `update ${schema}.live_state set doc = $1::jsonb, version = version + 1, updated_at = now() where store_code = $2 and version = $3 returning version`,
          [JSON.stringify(snapshot), store, version],
        );
        if (saved.rowCount !== 1) throw new StaleRevision();
        await project(client, store, snapshot, schema);
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
