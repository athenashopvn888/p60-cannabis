import { randomInt } from "node:crypto";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** One uppercase letter and four digits, for example D4827. */
export function mintDepositCode(used: Set<string>) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = `${LETTERS[randomInt(LETTERS.length)]}${String(randomInt(10000)).padStart(4, "0")}`;
    if (used.has(code)) continue;
    used.add(code);
    return code;
  }
  throw new Error("DEPOSIT_CODE");
}

/** Past deposits with no stored number stay usable and display as n/a. */
export function depositCodeLabel(code: string | null | undefined) {
  return code && /^[A-Z]\d{4}$/.test(code) ? code : "n/a";
}
