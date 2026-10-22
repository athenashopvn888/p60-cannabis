"use client";

import { createContext, useContext } from "react";
import { CIG_WORDING_FALLBACK, type CigaretteWording } from "../lib/cigDecision";

export type PublicCigaretteState = {
  web: boolean;
  tv: boolean;
  wording: CigaretteWording;
};

const OFF: PublicCigaretteState = {
  web: false,
  tv: false,
  wording: CIG_WORDING_FALLBACK,
};

const CigaretteStateContext = createContext<PublicCigaretteState>(OFF);

export default function CigaretteStateProvider({
  value,
  children,
}: {
  value: PublicCigaretteState;
  children: React.ReactNode;
}) {
  return <CigaretteStateContext.Provider value={value}>{children}</CigaretteStateContext.Provider>;
}

export function useCigaretteState(): PublicCigaretteState {
  return useContext(CigaretteStateContext);
}
