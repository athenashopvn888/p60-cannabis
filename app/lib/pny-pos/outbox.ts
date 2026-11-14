export const OUTBOX_LEASE_MS = 2 * 60 * 1000;
export const OUTBOX_BATCH_SIZE = 200;

const BACKOFF_MINUTES = [1, 2, 5, 10, 15, 30, 60] as const;

export function outboxBackoffMs(attempts: number) {
  const safe = Math.max(1, Math.trunc(attempts));
  return BACKOFF_MINUTES[Math.min(safe, BACKOFF_MINUTES.length) - 1] * 60 * 1000;
}

export function outboxErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Sheet write failed";
  return raw.replace(/\s+/g, " ").trim().slice(0, 500) || "Sheet write failed";
}
