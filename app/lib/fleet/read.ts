import { resetFleetArticleCache } from "./articles.ts";
import { CODED_NAP, CODED_PAGES, fleetVersion } from "./coded.ts";
import { defaultManifestUrl } from "./config.ts";
import { resolveBanners, resolveNap, resolvePages } from "./resolve.ts";
import { resolveFullscreenPromos, resolveTvCards } from "./tv.ts";
import { FLEET_STORE_CODE, type ContentBundle, type ContentManifest, type FleetState, type TvFullscreenPromo, type TvCardSlot } from "./types.ts";
import { parseBundle, parseManifest, rejectHttp } from "./validate.ts";

export const FLEET_MANIFEST_ENV = "FLEET_CONTENT_MANIFEST_URL";
export const FLEET_REVALIDATE_ENV = "FLEET_REVALIDATE_SECRET";
export { EDGE_CONFIG_ENV, readEmergencyCoded } from "./emergency.ts";
import { readEmergencyCoded } from "./emergency.ts";

type Accepted = {
  manifest: ContentManifest;
  bundle: ContentBundle;
  etag: string;
};

let accepted: Accepted | null = null;

export function resetFleetContentCache(): void {
  accepted = null;
  resetFleetArticleCache();
}

export function codedFleetState(renderedAt = new Date().toISOString()): FleetState {
  return {
    active: false,
    version: fleetVersion(null),
    contentVersion: null,
    bundleUrl: "",
    renderedAt,
    nap: CODED_NAP,
    banners: [],
    pages: CODED_PAGES,
    tvCards: {},
    fullscreenPromos: [],
  };
}

function stateFrom(bundle: ContentBundle, manifest: ContentManifest, renderedAt: string): FleetState {
  return {
    active: true,
    version: fleetVersion(manifest.contentVersion),
    contentVersion: manifest.contentVersion,
    bundleUrl: manifest.bundleUrl,
    renderedAt,
    nap: resolveNap(bundle),
    banners: resolveBanners(bundle),
    pages: resolvePages(bundle),
    tvCards: resolveTvCards(bundle, new Date(renderedAt)),
    fullscreenPromos: resolveFullscreenPromos(bundle, new Date(renderedAt)),
  };
}

function manifestUrlFrom(explicit: string | null | undefined): string {
  if (explicit !== undefined) return explicit || "";
  const fromEnv = process.env[FLEET_MANIFEST_ENV]?.trim();
  if (fromEnv) return fromEnv;
  return defaultManifestUrl();
}

export async function readFleetContent(options: {
  manifestUrl?: string | null;
  fetchImpl?: typeof fetch;
  emergencyCoded?: boolean;
  renderedAt?: string;
} = {}): Promise<FleetState> {
  const renderedAt = options.renderedAt ?? new Date().toISOString();
  const emergency = options.emergencyCoded ?? await readEmergencyCoded(options.fetchImpl);
  if (emergency) return codedFleetState(renderedAt);
  const manifestUrl = manifestUrlFrom(options.manifestUrl);
  if (!manifestUrl) return codedFleetState(renderedAt);

  const fetchImpl = options.fetchImpl ?? fetch;
  const manifestHeaders: Record<string, string> = {};
  if (accepted?.etag) manifestHeaders["if-none-match"] = accepted.etag;
  let manifestResponse: Response;
  try {
    manifestResponse = await fetchImpl(manifestUrl, { cache: "no-store", headers: manifestHeaders });
  } catch {
    return accepted ? stateFrom(accepted.bundle, accepted.manifest, renderedAt) : codedFleetState(renderedAt);
  }
  const httpProblem = rejectHttp(manifestResponse.status);
  if (manifestResponse.status === 304 && accepted) return stateFrom(accepted.bundle, accepted.manifest, renderedAt);
  if (httpProblem || manifestResponse.status === 304) {
    return accepted ? stateFrom(accepted.bundle, accepted.manifest, renderedAt) : codedFleetState(renderedAt);
  }
  const manifestRaw = await manifestResponse.text();
  const manifest = parseManifest(manifestRaw);
  if (!manifest.ok) return accepted ? stateFrom(accepted.bundle, accepted.manifest, renderedAt) : codedFleetState(renderedAt);

  let bundleResponse: Response;
  try {
    bundleResponse = await fetchImpl(manifest.value.bundleUrl, { cache: "no-store" });
  } catch {
    return accepted ? stateFrom(accepted.bundle, accepted.manifest, renderedAt) : codedFleetState(renderedAt);
  }
  const bundleHttp = rejectHttp(bundleResponse.status);
  if (bundleHttp) return accepted ? stateFrom(accepted.bundle, accepted.manifest, renderedAt) : codedFleetState(renderedAt);
  const bundleRaw = await bundleResponse.text();
  const bundle = parseBundle(bundleRaw, accepted?.bundle ?? null);
  if (!bundle.ok) return accepted ? stateFrom(accepted.bundle, accepted.manifest, renderedAt) : codedFleetState(renderedAt);

  const etag = manifestResponse.headers.get("etag") || `"${FLEET_STORE_CODE}-${manifest.value.contentVersion}"`;
  accepted = { manifest: manifest.value, bundle: bundle.value, etag };
  return stateFrom(bundle.value, manifest.value, renderedAt);
}

export function tvManifestDecision(state: FleetState, ifNoneMatch: string | null) {
  const etag = manifestEtag(state.contentVersion);
  if (ifNoneMatch === etag) return { status: 304 as const, etag, body: null };
  return { status: 200 as const, etag, body: tvManifestBody(state) };
}

export function manifestEtag(version: number | null): string {
  return version == null ? `"${FLEET_STORE_CODE}-coded"` : `"${FLEET_STORE_CODE}-${version}"`;
}

export type TvManifestPayload = ContentManifest & {
  tvCards: Record<string, TvCardSlot>;
  fullscreenPromos: TvFullscreenPromo[];
};

export function tvManifestBody(state: FleetState): TvManifestPayload {
  return {
    storeCode: FLEET_STORE_CODE,
    contentVersion: state.contentVersion ?? 0,
    bundleUrl: state.bundleUrl,
    publishedAt: state.renderedAt,
    jobId: state.active ? "published" : "coded",
    tvCards: state.tvCards,
    fullscreenPromos: state.fullscreenPromos,
  };
}
