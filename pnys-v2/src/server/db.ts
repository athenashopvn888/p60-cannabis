import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | undefined;

function databaseUrl() {
  const value = process.env.PNYS_V2_DATABASE_URL?.trim() ?? "";
  if (!value || value.includes("[SENSITIVE]")) throw new Error("V2_DATABASE_DISABLED");
  const parsed = new URL(value);
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) throw new Error("V2_DATABASE_URL_INVALID");
  return value;
}

function getPool() {
  pool ??= new Pool({ connectionString: databaseUrl(), max: 4, application_name: "pnys-v2" });
  return pool;
}

export async function withV2Transaction<T>(input: { actorId: string; actorKind: string; storeCode: string }, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const identity = await client.query<{ system_id: string }>("select system_id from pos_v2_hub.system_identity where singleton = true");
    if (identity.rows[0]?.system_id !== "PNYS_V2_PREVIEW") throw new Error("V2_DATABASE_IDENTITY_MISMATCH");
    await client.query("select set_config('app.actor_id', $1, true), set_config('app.actor_kind', $2, true), set_config('app.store_code', $3, true)", [input.actorId, input.actorKind, input.storeCode]);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function queryOne<T extends QueryResultRow>(client: PoolClient, sql: string, values: unknown[]): Promise<T> {
  const result = await client.query<T>(sql, values);
  if (result.rows.length !== 1) throw new Error("V2_QUERY_EXPECTED_ONE_ROW");
  return result.rows[0];
}
