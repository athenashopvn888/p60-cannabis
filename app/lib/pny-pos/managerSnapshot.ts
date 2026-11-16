import "server-only";

import { Pool } from "pg";
import { emptyState } from "./memory.ts";
import type { State } from "./types.ts";

type ManagerStoreCode = "PNY01" | "PNYS";

const globalPool = globalThis as typeof globalThis & { __managerSnapshotPool?: Pool };

function pool() {
  if (!globalPool.__managerSnapshotPool) {
    const connectionString = process.env.POS_SUPABASE_DB_URL?.trim() ?? "";
    if (!connectionString) throw new Error("POS_SUPABASE_DB_URL is required for Manager store snapshots.");
    globalPool.__managerSnapshotPool = new Pool({
      connectionString,
      max: 2,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalPool.__managerSnapshotPool;
}

/**
 * Reads the curated, PIN-free operational snapshot exposed by pos_hub.
 * The database function is SELECT-only and grants pnys_app no direct access
 * to pny_pos.live_state.
 */
export async function readManagerStoreSnapshot(storeCode: ManagerStoreCode): Promise<State> {
  const client = await pool().connect();
  try {
    await client.query("begin read only");
    await client.query("set local role pnys_app");
    const result = await client.query(
      "select pos_hub.manager_store_snapshot($1) as snapshot",
      [storeCode],
    );
    await client.query("commit");
    const snapshot = result.rows[0]?.snapshot;
    if (!snapshot || typeof snapshot !== "object") throw new Error(`${storeCode} Manager snapshot is unavailable.`);
    return { ...emptyState(), ...(snapshot as Partial<State>) } as State;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

