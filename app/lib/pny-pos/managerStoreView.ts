type ManagerStoreRoute = {
  internalStore: "PNY01" | "PNYS";
  externalStore: "PNY01" | "PNYS";
  useRetainedSnapshot: boolean;
  liveCutover: boolean;
};

export function resolveManagerStoreRoute(
  requested: string | null | undefined,
  environment: { vercelEnv?: string; testStore?: string },
): ManagerStoreRoute {
  const liveCutover = environment.vercelEnv === "production" && environment.testStore !== "1";
  if (liveCutover) {
    return {
      internalStore: "PNYS",
      externalStore: "PNY01",
      useRetainedSnapshot: false,
      liveCutover: true,
    };
  }

  const store = requested?.toUpperCase() === "PNY01" ? "PNY01" : "PNYS";
  return {
    internalStore: store,
    externalStore: store,
    useRetainedSnapshot: store === "PNY01",
    liveCutover: false,
  };
}

export function exposeManagerStore<T extends Record<string, unknown>>(view: T, route: ManagerStoreRoute) {
  if (!route.liveCutover) return view;
  return {
    ...view,
    store_code: "PNY01" as const,
    stores: [{ code: "PNY01" as const, name: "PNY01 · P60 Cannabis" }],
    read_only: false,
    data_source: "LIVE" as const,
  };
}

function combineRows<T extends Record<string, unknown>>(current: T[] | undefined, retained: T[] | undefined, key: keyof T) {
  const rows = [...(current ?? []), ...(retained ?? [])];
  return rows.filter((row, index) => rows.findIndex((candidate) => candidate[key] === row[key]) === index);
}

export function mergeRetainedManagerHistory<
  T extends Record<string, unknown> & {
    closings?: Record<string, unknown>[];
    stock_snapshots?: Record<string, unknown>[];
    refills?: Record<string, unknown>[];
    refill_batches?: Record<string, unknown>[];
    audit_log?: Record<string, unknown>[];
  },
>(current: T, retained: T) {
  const retainedSnapshots = retained.stock_snapshots?.filter((row) => row.id !== "CURRENT");
  return {
    ...current,
    closings: combineRows(current.closings, retained.closings, "shift_id"),
    stock_snapshots: combineRows(current.stock_snapshots, retainedSnapshots, "id"),
    refills: combineRows(current.refills, retained.refills, "kitchen_row_id"),
    refill_batches: combineRows(current.refill_batches, retained.refill_batches, "batch_id"),
    audit_log: combineRows(current.audit_log, retained.audit_log, "id"),
  };
}
