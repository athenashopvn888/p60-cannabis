import { FLEET_STORE_CODE, type FleetState } from "./types.ts";

export type CigaretteFlags = { web: boolean; tv: boolean; guides: boolean };

export function contentStatusPayload(fleet: FleetState, cig: CigaretteFlags) {
  return {
    storeCode: FLEET_STORE_CODE,
    contentVersion: fleet.contentVersion,
    version: fleet.version,
    renderedAt: fleet.renderedAt,
    cig: { web: cig.web, tv: cig.tv, guides: cig.guides },
  };
}
