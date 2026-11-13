import { Pool } from "pg";
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
        if (schema === "pnys_pos") await client.query("set role pnys_app");
        const loaded = await client.query(`select doc from ${schema}.live_state where store_code = $1`, [store]);
        return asState(loaded.rows[0]?.doc);
      } finally {
        if (schema === "pnys_pos") await client.query("reset role").catch(() => undefined);
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
        if (schema === "pnys_pos") await client.query("set local role pnys_app");
        const loaded = await client.query(`select version, doc from ${schema}.live_state where store_code = $1`, [store]);
        const version = Number(loaded.rows[0]?.version ?? 0);
        const snapshot = structuredClone(asState(loaded.rows[0]?.doc)) as State;
        const before = JSON.stringify(snapshot);
        const result = await fn({ state: snapshot });
        const after = JSON.stringify(snapshot);
        if (after === before) {
          await client.query("commit");
          return result;
        }
        const saved = await client.query(
          `update ${schema}.live_state set doc = $1::jsonb, version = version + 1, updated_at = now() where store_code = $2 and version = $3 returning version`,
          [after, store, version],
        );
        if (saved.rowCount !== 1) throw new StaleRevision();
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
