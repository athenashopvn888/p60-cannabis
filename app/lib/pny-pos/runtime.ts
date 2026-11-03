import { DEMO_LABEL, DEMO_PIN, DEMO_SESSION_SECRET } from "./constants.ts";
import { PosError } from "./errors.ts";
import { MemoryDb } from "./memory.ts";
import { applyDemoSeed } from "./seed.ts";
import { PosService, type PosDeps } from "./service.ts";
import { SheetDb } from "./sheetStore.ts";
import { sheetFromEnv } from "./sheets.ts";
import type { Secrets } from "./types.ts";

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
export function demoMode() {
  if (process.env.PNY_POS_DEMO === "0") return false;
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

/** Opens the one configured shift when PNY_OPEN_PIN is set. The value is never logged. */
async function openConfiguredShift(service: PosService) {
  const pin = process.env.PNY_OPEN_PIN?.trim() ?? "";
  if (!/^\d{4}$/.test(pin)) return;
  try {
    await service.openShiftWithPin({
      staff_uid: process.env.PNY_OPEN_STAFF_UID?.trim() || "staff-tri",
      display_name: process.env.PNY_OPEN_STAFF_NAME?.trim() || "Tri",
      pos_id: process.env.PNY_OPEN_POS_ID?.trim() || "TRI",
      shift_id: process.env.PNY_OPEN_SHIFT_ID?.trim() || undefined,
      pin,
    });
  } catch (error) {
    const code = error instanceof PosError ? error.code : "OPEN_FAILED";
    console.error(`PNY shift open failed (${code}).`);
  }
}

async function boot() {
  const sheet = sheetFromEnv();
  const secrets = loadSecrets();
  const deps: PosDeps = { sheet, secrets, demo: null };
  if (sheet.configured) {
    const service = new PosService(new SheetDb(sheet), deps);
    await openConfiguredShift(service);
    return service;
  }
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
