type SalesFeedPayload = {
  store: string;
  sales: Array<Record<string, unknown> & { store?: string }>;
  [key: string]: unknown;
};

/** Keep the retained PNY01 SCCx contract while the replacement till uses PNYS internally. */
export function forPny01Sccx(payload: SalesFeedPayload): SalesFeedPayload {
  if (payload.store !== "PNYS") return payload;
  return {
    ...payload,
    store: "PNY01",
    sales: payload.sales.map((sale) => ({ ...sale, store: "PNY01" })),
  };
}
