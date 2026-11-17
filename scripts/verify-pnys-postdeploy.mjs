import pg from "pg";

const { Pool } = pg;
const baseUrl = process.argv[2]?.replace(/\/$/, "");
if (!baseUrl || !/^https:\/\//i.test(baseUrl)) throw new Error("Usage: node scripts/verify-pnys-postdeploy.mjs https://deployment-url");

const rawConnectionString = process.env.POS_SUPABASE_DB_URL?.trim();
if (!rawConnectionString) throw new Error("POS_SUPABASE_DB_URL must be supplied through the process environment.");

function normalizeConnectionString(value) {
  const url = new URL(value);
  if (url.hostname.endsWith(".pooler.supabase.com") && (!url.port || url.port === "5432")) url.port = "6543";
  return url.toString();
}

const pool = new Pool({ connectionString: normalizeConnectionString(rawConnectionString), max: 1, connectionTimeoutMillis: 8_000, allowExitOnIdle: true });
const client = await pool.connect();
try {
  await client.query("begin read only");
  const readOnly = await client.query("show transaction_read_only");
  if (readOnly.rows[0]?.transaction_read_only !== "on") throw new Error("Database verification transaction is not read-only.");

  const oldSchemaPrivileges = await client.query(`
    select privilege_type
    from information_schema.role_table_grants
    where grantee = current_user
      and table_schema = 'pny_pos'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER')
    limit 1
  `);
  if (oldSchemaPrivileges.rowCount) {
    throw new Error("PNYS database role has a write privilege in pny_pos.");
  }

  const pnys = await client.query("select version, doc from pnys_pos.live_state where store_code='PNYS'");
  if (pnys.rowCount !== 1) throw new Error("PNYS live state is not readable.");
  const shifts = Array.isArray(pnys.rows[0].doc?.shifts) ? pnys.rows[0].doc.shifts : [];
  const active = shifts.find((row) => !row.ended_at && String(row.status ?? "").toUpperCase() !== "CLOSED");
  if (!active) throw new Error("No active PNYS shift is readable.");

  for (const route of ["/pos", "/pos/manager", "/pos/kitchen"]) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    if (response.status !== 200) throw new Error(`${route} returned ${response.status}, expected 200.`);
  }

  await client.query("commit");
  console.log(JSON.stringify({
    ok: true,
    store_code: "PNYS",
    active_shift_readable: true,
    routes: { pos: 200, manager: 200, kitchen: 200 },
    pny_pos_write_privileges: false,
  }, null, 2));
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
