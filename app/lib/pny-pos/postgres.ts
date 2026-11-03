import { Pool, type PoolClient } from "pg";
import { emptyState, type PosDb, type Tx } from "./memory.ts";
import { SCHEMA_SQL } from "./schema.ts";
import type { State } from "./types.ts";

const JSON_COLUMNS = new Set(["closing_lines", "response_json", "public_json", "payload", "detail"]);

function statements() {
  return SCHEMA_SQL.split(";").map((statement) => statement.trim()).filter(Boolean);
}

async function insertRows(client: PoolClient, table: string, rows: Record<string, unknown>[]) {
  for (const row of rows) {
    const keys = Object.keys(row);
    const values = keys.map((key) => {
      const value = row[key];
      if (JSON_COLUMNS.has(key) && value != null) return JSON.stringify(value);
      return value;
    });
    const placeholders = keys.map((key, index) => (JSON_COLUMNS.has(key) && row[key] != null ? `$${index + 1}::jsonb` : `$${index + 1}`));
    await client.query(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`, values);
  }
}

async function projectState(client: PoolClient, state: State) {
  const tables = [
    "sale_lines",
    "ticket_lines",
    "stock_count_lines",
    "sales",
    "tickets",
    "deposits",
    "sessions",
    "stock_counts",
    "incoming_batches",
    "inventory_ledger",
    "shift_closings",
    "idempotency_keys",
    "sheet_outbox",
    "audit_log",
    "admin_sessions",
    "store_balance",
    "store_products",
    "products",
    "shifts",
    "staff",
    "sheet_import_cursor",
    "stores",
  ];
  for (const table of tables) await client.query(`DELETE FROM ${table}`);
  await insertRows(client, "stores", state.stores);
  await insertRows(client, "products", state.products);
  await insertRows(client, "store_products", state.store_products);
  await insertRows(client, "inventory_ledger", state.ledger);
  await insertRows(client, "store_balance", state.balances);
  await insertRows(client, "staff", state.staff);
  await insertRows(client, "shifts", state.shifts);
  await insertRows(client, "sessions", state.sessions);
  await insertRows(client, "incoming_batches", state.incoming);
  await insertRows(client, "stock_counts", state.counts);
  await insertRows(client, "stock_count_lines", state.count_lines);
  await insertRows(client, "tickets", state.tickets);
  await insertRows(client, "ticket_lines", state.ticket_lines);
  await insertRows(client, "sales", state.sales);
  await insertRows(client, "sale_lines", state.sale_lines);
  await insertRows(client, "deposits", state.deposits);
  await insertRows(client, "shift_closings", state.closings);
  await insertRows(client, "idempotency_keys", state.idempotency);
  await insertRows(client, "sheet_outbox", state.outbox);
  await insertRows(client, "sheet_import_cursor", state.cursors);
  await insertRows(client, "audit_log", state.audit);
  await insertRows(client, "admin_sessions", state.admin_sessions);
}

/** Postgres adapter. The transactional document and the spec tables commit together. */
export class PgDb implements PosDb {
  private pool: Pool;
  private ready: Promise<void> | null = null;

  constructor(url: string) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    this.pool = new Pool({ connectionString: url, max: 4, ssl: local ? undefined : { rejectUnauthorized: false } });
  }

  private ensureSchema() {
    if (!this.ready) {
      this.ready = (async () => {
        const client = await this.pool.connect();
        try {
          for (const statement of statements()) await client.query(statement);
        } finally {
          client.release();
        }
      })().catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    return this.ready;
  }

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT doc FROM pny_state WHERE id = 'main' FOR UPDATE");
      const state = (existing.rows[0]?.doc as State | undefined) ?? emptyState();
      const tx = { state };
      const result = await fn(tx);
      await client.query(
        "INSERT INTO pny_state (id, doc, updated_at) VALUES ('main', $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()",
        [JSON.stringify(tx.state)],
      );
      await projectState(client, tx.state);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
