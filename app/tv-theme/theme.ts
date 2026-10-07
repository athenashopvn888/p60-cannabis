import type { CSSProperties } from "react";

export type TvTheme = {
  headerImage: string;
  backgroundImage: string;
  cornerLeft?: string;
  cornerRight?: string;
  primary: string;
  accent: string;
  glow: string;
  cardBorder: string;
  headerText: string;
  sloganLeft: string;
  sloganRight: string;
  footerLeft: string;
  footerRight: string;
};

export const TV_THEMES: Readonly<Record<string, TvTheme>> = {
  PNY01: {
    headerImage: "/tv-theme/pny01/header.webp",
    backgroundImage: "/tv-theme/pny01/background.webp",
    cornerLeft: "/tv-theme/pny01/corner-left.png",
    cornerRight: "/tv-theme/pny01/corner-right.png",
    primary: "#0A0D0A",
    accent: "#76E600",
    glow: "rgba(118,230,0,.44)",
    cardBorder: "rgba(203,255,155,.92)",
    headerText: "#FFFFFF",
    sloganLeft: "POWERED BY QUALITY",
    sloganRight: "P60 CANNABIS",
    footerLeft: "P60 CANNABIS",
    footerRight: "FRESH SELECTION · FULL POWER",
  },
};

export function getTvTheme(storeCode?: string | null): TvTheme | undefined {
  return storeCode ? TV_THEMES[storeCode] : undefined;
}

type TvThemeVariables = CSSProperties & {
  "--tv-theme-header-image": string;
  "--tv-theme-background-image": string;
  "--tv-theme-primary": string;
  "--tv-theme-accent": string;
  "--tv-theme-glow": string;
  "--tv-theme-card-border": string;
  "--tv-theme-header-text": string;
};

export function getTvThemeVariables(theme: TvTheme): TvThemeVariables {
  return {
    "--tv-theme-header-image": `url("${theme.headerImage}")`,
    "--tv-theme-background-image": `url("${theme.backgroundImage}")`,
    "--tv-theme-primary": theme.primary,
    "--tv-theme-accent": theme.accent,
    "--tv-theme-glow": theme.glow,
    "--tv-theme-card-border": theme.cardBorder,
    "--tv-theme-header-text": theme.headerText,
  };
}