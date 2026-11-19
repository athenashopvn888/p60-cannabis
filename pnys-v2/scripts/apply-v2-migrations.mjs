import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.PNYS_V2_DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error("PNYS_V2_DATABASE_URL is required");
}

const parsed = new URL(connectionString);
if (/eboqxdxwtilkwwqinfnj/i.test(parsed.hostname)) {
  throw new Error("Live PNYS database is forbidden");
}

const migrationsDir = path.resolve("migrations");
const files = (await readdir(migrationsDir))
  .filter((name) => /^\d+_.+[.]sql$/.test(name))
  .sort();

const client = new Client({ connectionString });
await client.connect();

try {
  await client.query(`
    create schema if not exists pos_v2_hub;
    create table if not exists pos_v2_hub.schema_migrations (
      migration_name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  for (const file of files) {
    const alreadyApplied = await client.query(
      "select 1 from pos_v2_hub.schema_migrations where migration_name = $1",
      [file],
    );
    if (alreadyApplied.rowCount) {
      console.log(`already applied: ${file}`);
      continue;
    }

    const sql = (await readFile(path.join(migrationsDir, file), "utf8"))
      .replace(/^\s*begin\s*;\s*/i, "")
      .replace(/\s*commit\s*;\s*$/i, "");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into pos_v2_hub.schema_migrations(migration_name) values ($1)",
        [file],
      );
      await client.query("commit");
      console.log(`applied: ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  const verification = await client.query(`
    select
      (select system_id from pos_v2_hub.system_identity where singleton) as system_id,
      (select count(*)::int from pos_v2.stores where store_code = 'ACD01') as acd01_stores,
      (select count(*)::int from pos_v2.stores where store_code <> 'ACD01') as non_acd01_stores,
      (select count(*)::int from pos_v2_hub.schema_migrations) as migration_count
  `);
  console.log(JSON.stringify(verification.rows[0]));
} finally {
  await client.end();
}
