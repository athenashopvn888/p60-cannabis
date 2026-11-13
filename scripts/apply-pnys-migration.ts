import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const url = process.env.POS_SUPABASE_DB_URL?.trim();
if (!url) throw new Error("POS_SUPABASE_DB_URL is required");
const sql = await readFile(new URL("../supabase/migrations/20261113090000_pnys_foundation.sql", import.meta.url), "utf8");
if (/\b(insert|update|delete|alter|drop)\s+(into\s+|table\s+)?pny_pos\b/i.test(sql)) {
  throw new Error("Safety check refused a migration that writes to pny_pos");
}
const pool = new Pool({ connectionString: url, max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
try {
  await pool.query(sql);
  const checked = await pool.query("select to_regclass('pnys_pos.live_state') as live_state, to_regclass('pos_hub.store') as hub_store");
  console.log(JSON.stringify({ applied: true, ...checked.rows[0] }));
} finally {
  await pool.end();
}
