"use client";

import { createContext, useContext } from "react";
import { CODED_NAP, fleetVersion } from "../../lib/fleet/coded";
import type { Nap, ResolvedBanner } from "../../lib/fleet/types";

export type PublicFleet = {
  active: boolean;
  version: string;
  nap: Nap;
  /** Set only when a sheet row differs from the coded banner object. */
  contentBanners?: ResolvedBanner[];
};

const CODED: PublicFleet = {
  active: false,
  version: fleetVersion(null),
  nap: CODED_NAP,
};

const FleetContentContext = createContext<PublicFleet>(CODED);

export default function FleetContentProvider({
  value,
  children,
}: {
  value: PublicFleet;
  children: React.ReactNode;
}) {
  return <FleetContentContext.Provider value={value}>{children}</FleetContentContext.Provider>;
}

export function useFleetContent(): PublicFleet {
  return useContext(FleetContentContext);
}
