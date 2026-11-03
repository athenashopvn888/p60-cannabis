import { DEMO_LABEL, DEMO_PIN, DEMO_SESSION_SECRET } from "./constants.ts";
import { MemoryDb } from "./memory.ts";
import { PgDb } from "./postgres.ts";
import { applyDemoSeed } from "./seed.ts";
import { PosService, type PosDeps } from "./service.ts";
import { sheetFromEnv } from "./sheets.ts";
import type { Secrets } from "./types.ts";

const DEMO_SECRETS: Secrets = {
  shift: "demo-shift-secret-placeholder",
  roster: "demo-roster-secret-placeholder",
  poll: "demo-sccx-poll-secret-placeholder",
  session: "demo-session-secret-placeholder-32",
  admin: "demo-admin-secret",
  cron: "demo-cron-secret-placeholder",
};

/**
 * Labeled demo till when there is no database.
 * Preview and local builds have no PNY env yet, and Vercel sets NODE_ENV=production for both
 * preview and production. A real database always wins, so production with DATABASE_URL is unchanged.
 * Set PNY_POS_DEMO=0 to force the empty unconfigured till.
 */
export function demoMode() {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.PNY_POS_DEMO === "0") return false;
  if (process.env.PNY_POS_DEMO === "1") return true;
  if (process.env.DATABASE_URL) return false;
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

async function boot() {
  const demo = demoMode();
  const sheet = sheetFromEnv();
  const secrets = loadSecrets();
  const deps: PosDeps = { sheet, secrets, demo: null };
  if (process.env.DATABASE_URL) {
    const db = new PgDb(process.env.DATABASE_URL);
    const service = new PosService(db, deps);
    if (demo) {
      const report = await service.reconciliation();
      if (report.skus.length === 0) {
        await db.transaction(async (tx) => applyDemoSeed(tx.state, new Date()));
        deps.demo = { pin: DEMO_PIN, label: DEMO_LABEL };
      }
    }
    return service;
  }
  const db = new MemoryDb();
  if (demo) {
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
