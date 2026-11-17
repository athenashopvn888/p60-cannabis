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

export function maintenanceMode() {
  return process.env.PNYS_BUILD_MODE?.trim().toLowerCase() === "maintenance";
}
