import { DEMO_LABEL, DEMO_PIN, DEMO_SESSION_SECRET } from "./constants.ts";
import { MemoryDb } from "./memory.ts";
import { applyDemoSeed } from "./seed.ts";
import { PosService, type PosDeps } from "./service.ts";
import { SheetDb } from "./sheetStore.ts";
import { lockedStore } from "./singleStore.ts";
import { sheetFromEnv } from "./sheets.ts";
import { createSupabaseStateDb } from "./supabaseState.ts";
import type { State, Secrets } from "./types.ts";

const DEMO_SECRETS: Secrets = {
  shift: "demo-shift-secret-placeholder",
  roster: "demo-roster-secret-placeholder",
  poll: "demo-sccx-poll-secret-placeholder",
  session: "demo-session-secret-placeholder-32",
  admin: "demo-admin-secret",
  cron: "demo-cron-secret",
};

/** The till is live when the PNY sheet credentials are set. Postgres is not used. */
export function sheetConfigured() {
  return Boolean(
    process.env.GSHEET_ID?.trim()
    && process.env.GOOGLE_SA_PNY_CLIENT_EMAIL?.trim()
    && process.env.GOOGLE_SA_PNY_PRIVATE_KEY,
  );
}

/**
 * Labeled demo till when the sheet is not configured.
 * Preview builds have no PNY sheet env. A Neon connection string is not read.
 * Set PNY_POS_DEMO=0 to force the empty unconfigured till.
 */
export function stateBackend(): "sheet" | "supabase" {
  const value = process.env.POS_STATE_BACKEND?.trim().toLowerCase() || "sheet";
  if (value === "sheet" || value === "supabase") return value;
  throw new Error("POS_STATE_BACKEND must be sheet or supabase");
}

export function demoMode() {
  if (process.env.PNY_POS_DEMO === "0") return false;
  if (stateBackend() === "supabase") return !sheetConfigured();
  if (sheetConfigured()) return false;
  return true;
}

export function loadSecrets(): Secrets {
  const demo = demoMode();
  const pick = (name: string, fallback: string) => {
    const value = process.env[name]?.trim();
    if (value) return value;
    return demo ? fallback : "";
  };
  return {
    shift: pick("SHIFT_SECRET", DEMO_SECRETS.shift),
    roster: pick("ROSTER_SECRET", DEMO_SECRETS.roster),
    poll: pick("SCCX_POLL_SECRET", DEMO_SECRETS.poll),
    session: pick("SESSION_SECRET", DEMO_SESSION_SECRET),
    admin: pick("ADMIN_SECRET", DEMO_SECRETS.admin),
    cron: pick("CRON_SECRET", DEMO_SECRETS.cron),
  };
}

function tagDemoStore(state: State, code: "PNY01" | "PNY02") {
  for (const row of state.shifts) row.store_code = code;
  for (const row of state.balances) row.store_code = code;
  for (const row of state.incoming) row.store_code = code;
  for (const row of state.store_products) row.store_code = code;
  for (const row of state.stores) row.code = code;
  for (const row of state.ledger) row.store_code = code;
  for (const sale of state.sales) {
    if (code === "PNY02") sale.ref_no = sale.ref_no.replace(/^PNY01-/, "PNY02-");
  }
}

async function boot() {
  const sheet = sheetFromEnv();
  const secrets = loadSecrets();
  const deps: PosDeps = { sheet, secrets, demo: null };
  const locked = lockedStore();
  if (locked || stateBackend() === "supabase") {
    const url = process.env.POS_SUPABASE_DB_URL?.trim() ?? "";
    if (!url) throw new Error("POS_SUPABASE_DB_URL is required when STORE_CODE or POS_STATE_BACKEND=supabase is set");
    const code = locked?.code ?? "PNY01";
    const db = createSupabaseStateDb(url, code);
    if (demoMode()) {
      await db.transaction(async (tx) => {
        if (tx.state.shifts.length === 0 && tx.state.products.length === 0) {
          applyDemoSeed(tx.state, new Date());
          tagDemoStore(tx.state, code);
        }
      });
      deps.demo = { pin: DEMO_PIN, label: DEMO_LABEL };
    }
    return new PosService(db, deps);
  }
  if (sheet.configured) return new PosService(new SheetDb(sheet), deps);
  const db = new MemoryDb();
  if (demoMode()) {
    applyDemoSeed(db.state, new Date());
    deps.demo = { pin: DEMO_PIN, label: DEMO_LABEL };
  }
  return new PosService(db, deps);
}

const globalState = globalThis as typeof globalThis & { __pnyPos?: Promise<PosService> };

export function getService() {
  if (!globalState.__pnyPos) globalState.__pnyPos = boot();
  return globalState.__pnyPos;
}
