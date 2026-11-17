function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(",")}}`;
}

type Pending = { fingerprint: string; key: string };

/** Keeps one idempotency key across network failures and user retries of the same command. */
export class DurableCommandKeys {
  private pending = new Map<string, Pending>();
  private readonly prefix = "pnys-command:";
  private readonly createKey: () => string;

  constructor(createKey: () => string = () => crypto.randomUUID()) {
    this.createKey = createKey;
  }

  private stored(slot: string) {
    if (typeof window === "undefined") return null;
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(`${this.prefix}${slot}`) ?? "null") as Pending | null;
      return parsed && typeof parsed.fingerprint === "string" && typeof parsed.key === "string" ? parsed : null;
    } catch {
      return null;
    }
  }

  private save(slot: string, value: Pending | null) {
    if (typeof window === "undefined") return;
    try {
      if (value) window.sessionStorage.setItem(`${this.prefix}${slot}`, JSON.stringify(value));
      else window.sessionStorage.removeItem(`${this.prefix}${slot}`);
    } catch {
      // In-memory retry safety still works when browser storage is unavailable.
    }
  }

  key(slot: string, body: unknown) {
    const fingerprint = canonical(body);
    const current = this.pending.get(slot) ?? this.stored(slot);
    if (current?.fingerprint === fingerprint) return current.key;
    const key = this.createKey();
    const next = { fingerprint, key };
    this.pending.set(slot, next);
    this.save(slot, next);
    return key;
  }

  complete(slot: string, key: string) {
    const current = this.pending.get(slot) ?? this.stored(slot);
    if (current?.key === key) {
      this.pending.delete(slot);
      this.save(slot, null);
    }
  }
}
