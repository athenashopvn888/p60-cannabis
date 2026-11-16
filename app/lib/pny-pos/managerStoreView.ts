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
