/**
 * Per-store hiring ribbon config for the in-store TV boards.
 * Set this to null to hide the ribbon. No sheet or API lookup.
 */
export type TvHiringConfig = {
  store: string;
  headline: string;
  role: string;
  cta: string;
  url: string;
  displayUrl: string;
};

export const tvHiring: TvHiringConfig | null = {
  store: "PNY01",
  headline: "NOW HIRING",
  role: "BUDTENDERS / MANAGERS",
  cta: "APPLY ONLINE",
  url: "https://p60cannabis.com",
  displayUrl: "p60cannabis.com",
};
