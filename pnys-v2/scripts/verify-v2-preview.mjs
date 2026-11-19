const required = [
  "PNYS_V2_DATABASE_URL",
  "PNYS_V2_SYSTEM_ID",
  "V2_HUMAN_MASTER_TOKEN_SHA256",
  "V2_AI_MASTER_TOKEN_SHA256",
];

const forbidden = [
  "POS_SUPABASE_DB_URL",
  "PNY_MASTER_PIN_HASH",
  "PNY_KITCHEN_PIN_HASH",
  "PNY_DEMO_PIN_HASH",
  "SHIFT_SECRET",
  "SCCX_POLL_SECRET",
  "SIGNAL_ENABLED",
];

function fail(message) {
  console.error(`V2_PREVIEW_GATE_FAILED: ${message}`);
  process.exit(1);
}

if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "preview") fail("preview target required");
if (process.env.VERCEL_PROJECT_ID && process.env.VERCEL_PROJECT_ID !== "prj_placeholder_until_linked") {
  const allowed = process.env.PNYS_V2_VERCEL_PROJECT_ID;
  if (!allowed || process.env.VERCEL_PROJECT_ID !== allowed) fail("wrong Vercel project identity");
}
for (const name of required) {
  const value = process.env[name]?.trim() ?? "";
  if (!value || value === "[SENSITIVE]") fail(`${name} missing or redacted`);
}
if (process.env.PNYS_V2_SYSTEM_ID !== "PNYS_V2_PREVIEW") fail("wrong system identity");
for (const name of forbidden) if (process.env[name]) fail(`legacy/live variable ${name} must not exist`);

const db = new URL(process.env.PNYS_V2_DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(db.protocol)) fail("database URL must be PostgreSQL");
if (/eboqxdxwtilkwwqinfnj/i.test(db.hostname)) fail("live PNYS database is forbidden");
for (const name of ["V2_HUMAN_MASTER_TOKEN_SHA256", "V2_AI_MASTER_TOKEN_SHA256"]) {
  if (!/^[0-9a-f]{64}$/.test(process.env[name])) fail(`${name} must be a SHA-256 hex digest`);
}
console.log("PNYS v2 preview identity gate passed.");
