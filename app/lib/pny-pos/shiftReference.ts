import type { State } from "./types.ts";

const SHIFT_REF = /^S(\d{5})$/;

function existingSequence(state: State, storeCode: string) {
  const assigned = state.closings.reduce((highest, closing) => {
    if (state.shifts.find((shift) => shift.id === closing.shift_id)?.store_code !== storeCode) return highest;
    const match = closing.shift_ref?.match(SHIFT_REF);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  const historical = new Set(
    state.closings
      .filter((closing) => state.shifts.find((shift) => shift.id === closing.shift_id)?.store_code === storeCode)
      .map((closing) => closing.shift_id),
  ).size;
  return Math.max(assigned, historical);
}

/** Six-character daily reference. The full SCCx shift id remains the audit key. */
export function issueShiftReference(state: State, storeCode: string) {
  const sequences = state.shift_ref_seq_by_store ?? (state.shift_ref_seq_by_store = {});
  const next = Math.max(sequences[storeCode] ?? 0, existingSequence(state, storeCode)) + 1;
  sequences[storeCode] = next;
  return `S${String(next).padStart(5, "0")}`;
}
