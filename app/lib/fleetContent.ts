import { cache } from "react";
import { readFleetContent } from "./fleet/read";

export const getFleetContent = cache(readFleetContent);

export { FLEET_MANIFEST_ENV, FLEET_REVALIDATE_ENV, EDGE_CONFIG_ENV, manifestEtag, resetFleetContentCache, tvManifestBody, tvManifestDecision } from "./fleet/read";
export { FLEET_AFFECTED_PATHS, FLEET_DYNAMIC_PATHS } from "./fleet/routes";
export { FLEET_CONTENT_TAG, FLEET_STORE_CODE } from "./fleet/types";
