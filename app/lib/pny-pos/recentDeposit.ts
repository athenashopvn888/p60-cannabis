export type RecentDeposit = {
  deposit_code?: string | null;
  amount_cents: number;
  created_at: string;
};

export const DUPLICATE_DEPOSIT_WINDOW_MS = 2 * 60 * 1000;

/** Finds a same-shift deposit with the same amount in the confirmation window. */
export function recentMatchingDeposit(
  deposits: RecentDeposit[],
  amountCents: number,
  nowMs = Date.now(),
  windowMs = DUPLICATE_DEPOSIT_WINDOW_MS,
) {
  let latest: RecentDeposit | null = null;
  let latestMs = -Infinity;
  for (const deposit of deposits) {
    if (deposit.amount_cents !== amountCents) continue;
    const createdMs = Date.parse(deposit.created_at);
    const ageMs = nowMs - createdMs;
    if (!Number.isFinite(createdMs) || ageMs < 0 || ageMs > windowMs || createdMs <= latestMs) continue;
    latest = deposit;
    latestMs = createdMs;
  }
  return latest;
}
