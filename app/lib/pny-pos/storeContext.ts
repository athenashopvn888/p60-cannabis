import { AsyncLocalStorage } from "node:async_hooks";
import { PNY01_STORE, type StoreProfile } from "./storeProfile.ts";

const current = new AsyncLocalStorage<StoreProfile>();

/** PNY01 when a request did not choose a store. */
export function currentStore(): StoreProfile {
  return current.getStore() ?? PNY01_STORE;
}

export function runStore<T>(store: StoreProfile, fn: () => T): T {
  return current.run(store, fn);
}
