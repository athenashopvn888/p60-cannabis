export const PNYS_PROJECT_ID = "prj_YxPnreV6iBh3AZIrTKKUK1z9tnuJ";
export const PNYS_PROJECT_NAME = "pnys-pos";
export const PNYS_PRODUCTION_DOMAIN = "pnys-pos.vercel.app";

export const REQUIRED_SECRET_NAMES = [
  "POS_SUPABASE_DB_URL",
  "SESSION_SECRET",
  "SHIFT_SECRET",
  "ADMIN_SECRET",
  "CRON_SECRET",
  "ROSTER_SECRET",
  "SCCX_POLL_SECRET",
  "SALES_FEED_TOKEN",
  "PNY_MASTER_PIN_HASH",
  "PNY_KITCHEN_PIN_HASH",
  "PNY_DEMO_PIN_HASH",
];

const PIN_HASH = /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/;
const REDACTED = /^\[?sensitive\]?$/i;

function present(value) {
  return typeof value === "string" && value.trim() !== "" && !REDACTED.test(value.trim());
}

function validateDbUrl(value) {
  try {
    const url = new URL(value);
    if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) return false;
    if (!url.username || !url.password || !url.hostname || !url.pathname || url.pathname === "/") return false;
    return url.hostname.endsWith(".supabase.com") || url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export function pnysGateApplies(env) {
  return env.STORE_CODE?.trim().toUpperCase() === "PNYS"
    || env.VERCEL_PROJECT_PRODUCTION_URL?.trim().toLowerCase() === PNYS_PRODUCTION_DOMAIN;
}

export function validatePnysEnvironment(env) {
  const errors = [];
  for (const name of REQUIRED_SECRET_NAMES) {
    if (!present(env[name])) errors.push(`${name} is missing, blank, or redacted.`);
  }

  if (env.STORE_CODE?.trim().toUpperCase() !== "PNYS") errors.push("STORE_CODE must be PNYS.");
  if (env.POS_DB_SCHEMA?.trim() !== "pnys_pos") errors.push("POS_DB_SCHEMA must be pnys_pos.");
  if (env.POS_HUB_SCHEMA?.trim() !== "pos_hub") errors.push("POS_HUB_SCHEMA must be pos_hub.");

  const productionDomain = env.VERCEL_PROJECT_PRODUCTION_URL?.trim().toLowerCase();
  if (productionDomain && productionDomain !== PNYS_PRODUCTION_DOMAIN) {
    errors.push(`Vercel project identity must be ${PNYS_PROJECT_NAME}.`);
  }

  const projectId = env.VERCEL_PROJECT_ID?.trim();
  if (projectId && projectId !== PNYS_PROJECT_ID) {
    errors.push(`Vercel project ID must be ${PNYS_PROJECT_ID}.`);
  }

  if (present(env.POS_SUPABASE_DB_URL) && !validateDbUrl(env.POS_SUPABASE_DB_URL.trim())) {
    errors.push("POS_SUPABASE_DB_URL is malformed or is not a credentialed Supabase PostgreSQL URL.");
  }

  for (const name of ["SESSION_SECRET", "SHIFT_SECRET", "ADMIN_SECRET", "CRON_SECRET", "ROSTER_SECRET", "SCCX_POLL_SECRET", "SALES_FEED_TOKEN"]) {
    if (present(env[name]) && env[name].trim().length < 32) errors.push(`${name} must contain at least 32 characters.`);
  }

  for (const name of ["PNY_MASTER_PIN_HASH", "PNY_KITCHEN_PIN_HASH", "PNY_DEMO_PIN_HASH"]) {
    if (present(env[name]) && !PIN_HASH.test(env[name].trim())) errors.push(`${name} is not a valid scrypt PIN hash.`);
  }

  return errors;
}
