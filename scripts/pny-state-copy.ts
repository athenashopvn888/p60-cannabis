/**
 * Dry-run copy plan for one store. Does not write the Google sheet.
 * Does not write Supabase unless PNY_STATE_COPY=after-close and --apply is passed.
 * Default is dry-run.
 *
 * PNY01: opening state, run only when that store is closed.
 * PNY02: closing stock plus staff, run only after PNY02 closes.
 */
import { lockedStore } from "../app/lib/pny-pos/singleStore.ts";

const store = (process.argv.find((arg) => arg.startsWith("--store="))?.split("=")[1] ?? "PNY01").toUpperCase();
const apply = process.argv.includes("--apply");
const allowed = process.env.PNY_STATE_COPY === "after-close";

const plan = [
  `Store ${store}.`,
  "Read the sheet state. Do not write the sheet.",
  store === "PNY02"
    ? "Copy closing stock and staff into Supabase after PNY02 is ENDED."
    : "Copy the opening POS state into Supabase after PNY01 is ENDED.",
  "Refuse if that store still has an ACTIVE, LOCKED, or CLOSING shift.",
  "The old /pos or /pos2 link stays up as the fallback.",
];

console.log(plan.map((line) => `- ${line}`).join("\n"));
console.log(apply ? "apply requested" : "dry-run");
if (!apply || !allowed) {
  console.log("No database write. Set PNY_STATE_COPY=after-close and pass --apply only after that store has closed.");
  process.exit(0);
}
if (lockedStore()) {
  console.log("This process is a one-store site. Run the copy from a machine that can read the sheet, not from the till.");
}
console.log("Apply is refused in this build until Tri confirms the store is closed and the sheet read is reviewed.");
process.exit(0);
