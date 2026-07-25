export function mutationRetryDelay(attempt: number, random = Math.random()) {
  const boundedAttempt = Math.max(0, Math.min(9, Math.trunc(attempt)));
  const base = Math.min(1_000, 35 * (2 ** boundedAttempt));
  return Math.round(base + Math.max(0, Math.min(1, random)) * Math.min(250, base));
}

export function normalizeBlobEtag(value: string) {
  let etag = value.trim();
  if (etag.startsWith("W/")) etag = etag.slice(2).trim();
  if (etag.startsWith('"') && etag.endsWith('"')) etag = etag.slice(1, -1);
  if (!etag) throw new Error("Staff photo state ETag is missing.");
  return etag;
}
