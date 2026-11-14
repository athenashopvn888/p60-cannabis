export const INTEGRATION_CHANNELS = [
  "SCCX_FEED",
  "SCCX_ACK",
  "SIGNAL",
  "SHEET_OUTBOX",
  "SHEET_IMPORT",
  "STOCK_SNAPSHOT",
  "SETB_SYNC",
] as const;

export type IntegrationChannel = (typeof INTEGRATION_CHANNELS)[number];
export type StoreWriteMode = "ACTIVE" | "FROZEN" | "ARCHIVE_READ_ONLY";

export type IntegrationLease = {
  channel: IntegrationChannel;
  owner_store_code: string;
  generation: number;
  cutover_id: string;
};

export function deploymentGeneration() {
  const parsed = Number(process.env.POS_DEPLOYMENT_GENERATION ?? "1");
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 0;
}
import { PosError } from "./errors.ts";


export function enforceStoreWriteGate(row: { write_mode?: string; generation?: unknown } | undefined, generation = deploymentGeneration()) {
  if (!row || row.write_mode !== "ACTIVE") {
    throw new PosError(423, "STORE_WRITE_BLOCKED", `Store writes are ${row?.write_mode ?? "UNCONFIGURED"}.`);
  }
  if (Number(row.generation) !== generation) {
    throw new PosError(423, "STALE_DEPLOYMENT", "This deployment generation cannot write.");
  }
}

export function enforceIntegrationOwner(
  channel: IntegrationChannel,
  store: string,
  row: { owner_store_code?: string; generation?: unknown; cutover_id?: string } | undefined,
  generation = deploymentGeneration(),
): IntegrationLease {
  if (!row || row.owner_store_code !== store || Number(row.generation) !== generation) {
    throw new PosError(423, "INTEGRATION_NOT_OWNER", `${channel} is owned by another deployment.`);
  }
  return { channel, owner_store_code: store, generation, cutover_id: String(row.cutover_id ?? "") };
}
