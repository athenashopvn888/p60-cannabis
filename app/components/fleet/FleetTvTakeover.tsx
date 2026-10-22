"use client";

import type { TvFullscreenPromo } from "../../lib/fleet/types";
import TvPromoTakeover from "./TvPromoTakeover";

export default function FleetTvTakeover({ promos }: { promos: readonly TvFullscreenPromo[] }) {
  if (promos.length === 0) return null;
  return <TvPromoTakeover promos={promos} />;
}
