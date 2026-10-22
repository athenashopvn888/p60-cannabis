export { CODED_BANNERS, CODED_NAP, CODED_PAGES, FLEET_STORE_CODE } from "./config.ts";
import { FLEET_STORE_CODE } from "./config.ts";

export function fleetVersion(contentVersion: number | null): string {
  return contentVersion == null ? `${FLEET_STORE_CODE}:coded` : `${FLEET_STORE_CODE}:${contentVersion}`;
}
