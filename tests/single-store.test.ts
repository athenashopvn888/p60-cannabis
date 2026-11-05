import assert from "node:assert/strict";
import test from "node:test";
import { currentStore } from "../app/lib/pny-pos/storeContext.ts";
import { demoMode, stateBackend } from "../app/lib/pny-pos/runtime.ts";
import { lockedStore } from "../app/lib/pny-pos/singleStore.ts";

test("STORE_CODE unset keeps the shared site on PNY01 and the sheet", () => {
  const previousStore = process.env.STORE_CODE;
  const previousBackend = process.env.POS_STATE_BACKEND;
  delete process.env.STORE_CODE;
  delete process.env.POS_STATE_BACKEND;
  try {
    assert.equal(lockedStore(), null);
    assert.equal(currentStore().code, "PNY01");
    assert.equal(stateBackend(), "sheet");
  } finally {
    if (previousStore == null) delete process.env.STORE_CODE;
    else process.env.STORE_CODE = previousStore;
    if (previousBackend == null) delete process.env.POS_STATE_BACKEND;
    else process.env.POS_STATE_BACKEND = previousBackend;
  }
});

test("STORE_CODE=PNY02 locks the site to that store and does not use the demo till", () => {
  const previousStore = process.env.STORE_CODE;
  const previousBackend = process.env.POS_STATE_BACKEND;
  const previousDemo = process.env.PNY_POS_DEMO;
  const previousSheet = process.env.GSHEET_ID;
  process.env.STORE_CODE = "PNY02";
  process.env.POS_STATE_BACKEND = "supabase";
  delete process.env.PNY_POS_DEMO;
  delete process.env.GSHEET_ID;
  try {
    assert.equal(lockedStore()?.code, "PNY02");
    assert.equal(currentStore().code, "PNY02");
    assert.equal(currentStore().label, "PNY2");
    assert.equal(demoMode(), false);
  } finally {
    if (previousStore == null) delete process.env.STORE_CODE;
    else process.env.STORE_CODE = previousStore;
    if (previousBackend == null) delete process.env.POS_STATE_BACKEND;
    else process.env.POS_STATE_BACKEND = previousBackend;
    if (previousDemo == null) delete process.env.PNY_POS_DEMO;
    else process.env.PNY_POS_DEMO = previousDemo;
    if (previousSheet == null) delete process.env.GSHEET_ID;
    else process.env.GSHEET_ID = previousSheet;
  }
});
