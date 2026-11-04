export const STORE_CODE = "PNY01";
export const STORE_TZ = "America/Toronto";
export const TICKET_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const PIN_TTL_MS = 14 * 60 * 60 * 1000;
export const TICKET_TTL_MS = 30 * 60 * 1000;
export const MENU_CACHE_MS = 45_000;
export const IMPORT_DEBOUNCE_MS = 30_000;
export const IMPORT_OVERLAP_ROWS = 50;
export const FULL_SCAN_MS = 20 * 60 * 60 * 1000;
export const SHEET_DELAY_MS = 10 * 60 * 1000;
export const SHEET_ALERT_MS = 30 * 60 * 1000;
export const SCCX_ACK_LATE_MS = 15 * 60 * 1000;
export const PIN_REPLAY_TTL_MS = 15 * 60 * 1000;
export const MAX_PENDING_TICKETS = 20;
export const MAX_ORDER_LINES = 10;
export const MAX_PIN_FAILURES = 5;
export const OUTBOX_ERROR_ATTEMPTS = 20;
export const SCHEMA_VERSION = "3";

export const OUTBOX_TAB_ORDER = [
  "S_Sales",
  "S_Deposits",
  "S_Shifts",
  "S_Receipts",
  "S_OpeningCounts",
  "S_ClosingCounts",
  "S_ShiftSummary",
  "S_Stock",
  "Products",
  "_Meta",
] as const;

export const DEMO_PIN = "6666";
export const KITCHEN_PIN = "9999";
/** Second login on the open shift. View-only. Does not start the staff verify window. */
export const MASTER_PIN = "1988";
/** Bump to restart the staff verify window on the next staff PIN login. */
export const VERIFY_RELEASE = "staff-verify-2026-11-04";
export const PIN_LENGTH = 4;
/** Used only when demo mode is on and SESSION_SECRET is unset. Not a production secret. */
export const DEMO_SESSION_SECRET = "pny-pos-demo-session-v1-not-for-production";
export const DEMO_LABEL = "DEMO DATA — real SETB products, sample stock, not live on-hand";
