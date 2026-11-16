/** Till identity. Client components can import this. Server request scope lives in storeContext.ts. */

export type StoreCode = "PNY01" | "PNY02" | "PNYS";

export type StoreProfile = {
  code: StoreCode;
  /** Shown on the till. PNY01 stays "PNY01". The second store is labelled PNY2. */
  label: string;
  orderPrefix: string;
  depositPrefix: string;
  /** On-hand tab in the PNY Mobile Inventory sheet. PNY01 stock stays in the POS state, not this tab. */
  stockTab: string | null;
  posPath: string;
  tillPath: string;
  menuPath: string;
  apiBase: string;
  menuApi: string;
  sessionCookie: string;
  menuUrl: string;
};

export const PNY01_STORE: StoreProfile = {
  code: "PNY01",
  label: "PNY01",
  orderPrefix: "PNY01",
  depositPrefix: "PNY-D",
  stockTab: null,
  posPath: "/pos",
  tillPath: "/pos/till",
  menuPath: "/menu",
  apiBase: "/api/pos",
  menuApi: "/api/menu",
  sessionCookie: "pny_pos_session",
  menuUrl: "https://www.p60cannabis.com/menu",
};

export const PNY02_STORE: StoreProfile = {
  code: "PNY02",
  label: "PNY2",
  orderPrefix: "PNY02",
  depositPrefix: "PNY2-D",
  stockTab: "PNY2",
  posPath: "/pos2",
  tillPath: "/pos2/till",
  menuPath: "/menu2",
  apiBase: "/api/pos2",
  menuApi: "/api/menu2",
  sessionCookie: "pny2_pos_session",
  menuUrl: "https://www.p60cannabis.com/menu2",
};

export const PNYS_STORE: StoreProfile = {
  code: "PNYS",
  label: "PNYS",
  orderPrefix: "PNYS",
  depositPrefix: "PNYS-D",
  stockTab: null,
  posPath: "/pos",
  tillPath: "/pos/till",
  menuPath: "/menu",
  apiBase: "/api/pos",
  menuApi: "/api/menu",
  sessionCookie: "pnys_pos_session",
  menuUrl: "/menu",
};

/** Columns Tri should put on the PNY2 tab. The code reads sku and on_hand by header name. */
export const PNY2_STOCK_HEADERS = ["sku", "name", "category", "price_cents", "on_hand", "updated_at"] as const;

export function storeProfile(code: string | null | undefined): StoreProfile {
  if (code === "PNYS") return PNYS_STORE;
  return code === "PNY02" ? PNY02_STORE : PNY01_STORE;
}
