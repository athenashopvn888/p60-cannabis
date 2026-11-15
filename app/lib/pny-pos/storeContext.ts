import { AsyncLocalStorage } from "node:async_hooks";
import { lockedStore } from "./singleStore.ts";
import { PNY01_STORE, type StoreProfile } from "./storeProfile.ts";

const current = new AsyncLocalStorage<StoreProfile>();

/** A one-store site ignores the other store. p60cannabis.com is unchanged when STORE_CODE is unset. */
export function currentStore(): StoreProfile {
  return lockedStore() ?? current.getStore() ?? PNY01_STORE;
}

export function runStore<T>(store: StoreProfile, fn: () => T): T {
  return current.run(store, fn);
}
