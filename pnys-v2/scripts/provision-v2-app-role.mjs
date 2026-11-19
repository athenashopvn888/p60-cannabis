import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import pg from "pg";

const { Client } = pg;
const adminUrl = process.env.PNYS_V2_DATABASE_URL?.trim();
if (!adminUrl) throw new Error("PNYS_V2_DATABASE_URL is required");

const parsed = new URL(adminUrl);
if (/eboqxdxwtilkwwqinfnj/i.test(parsed.hostname)) {
  throw new Error("Live PNYS database is forbidden");
}

const password = randomBytes(48).toString("base64url");
const client = new Client({ connectionString: adminUrl });
await client.connect();

try {
  const statement = await client.query(
    "select format('alter role pnys_v2_app login password %L', $1::text) as sql",
    [password],
  );
  await client.query(statement.rows[0].sql);
  const role = await client.query(`select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
      from pg_roles where rolname = 'pnys_v2_app'`);
  if (
    role.rowCount !== 1 ||
    role.rows[0].rolsuper ||
    role.rows[0].rolbypassrls ||
    role.rows[0].rolcreaterole ||
    role.rows[0].rolcreatedb
  ) {
    throw new Error("V2_APP_ROLE_NOT_LIMITED");
  }

  parsed.username = "pnys_v2_app";
  parsed.password = password;
  await writeFile(".env.v2-app", `PNYS_V2_DATABASE_URL=${parsed.toString()}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(JSON.stringify({
    role: role.rows[0].rolname,
    superuser: role.rows[0].rolsuper,
    bypassRls: role.rows[0].rolbypassrls,
    canCreateRole: role.rows[0].rolcreaterole,
    canCreateDb: role.rows[0].rolcreatedb,
  }));
} finally {
  await client.end();
}
