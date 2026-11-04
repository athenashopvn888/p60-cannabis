/** Next slip number. D0001, D0002, D0003. The counter moves only when a number is stored. */
export function nextDepositSeq(current: number | undefined, existing: Array<string | null | undefined>) {
  let max = Number.isInteger(current) && (current as number) > 0 ? (current as number) : 0;
  for (const code of existing) {
    const match = /^D(\d{4})$/.exec(code ?? "");
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  const next = max + 1;
  if (next > 9999) throw new Error("DEPOSIT_CODE");
  return next;
}

export function formatDepositCode(seq: number) {
  return `D${String(seq).padStart(4, "0")}`;
}

/** Past deposits with no stored number stay usable and display as n/a. */
export function depositCodeLabel(code: string | null | undefined) {
  return code && /^D\d{4}$/.test(code) ? code : "n/a";
}
