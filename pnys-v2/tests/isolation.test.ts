import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const migration = readFileSync(join(root, "migrations/0001_pos_v2_foundation.sql"), "utf8");

test("v2 migration creates only isolated v2 schemas", () => {
  assert.match(migration, /create schema if not exists pos_v2;/i);
  assert.match(migration, /create schema if not exists pos_v2_hub;/i);
  assert.doesNotMatch(migration, /\b(?:insert|update|delete|alter table)\s+(?:pny_pos|pnys_pos|pos_hub)\b/i);
});

test("all operational v2 tables are store scoped and forced RLS", () => {
  for (const table of ["staff", "catalog_items", "inventory_balances", "shifts", "sales", "refills", "close_versions", "corrections", "correction_audit", "report_outbox"]) {
    assert.match(migration, new RegExp(`create table pos_v2\\.${table} \\(`, "i"));
    assert.match(migration, new RegExp(`alter table pos_v2\\.%I force row level security`, "i"));
  }
  assert.match(migration, /FORBIDDEN_MASTER_SCOPE/);
  assert.match(migration, /AI_PREVIEW_ONLY/);
});
