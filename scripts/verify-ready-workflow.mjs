import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/delivery/P60WebChat.tsx", import.meta.url), "utf8");
const deliverySources = [
  source,
  readFileSync(new URL("../app/delivery/DeliveryCatalog.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("../app/delivery/page.tsx", import.meta.url), "utf8"),
].join("\n");

assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\("liveOrder"\) !== "1"/);
assert.match(source, /window\.setTimeout\(\(\) => setOpen\(true\), 0\)/);
assert.doesNotMatch(source, /useState\(\(\) => typeof window[^\n]+liveOrder/);
assert.match(source, /storeId: "P60"/);
assert.match(source, /workflowVersion: "READY_V1"/);
assert.match(source, /smsConsent/);
assert.match(source, /I agree to receive one READY delivery-link text for this order\./);
assert.match(source, /localStorage\.getItem\(SESSION_KEY\)/);
assert.doesNotMatch(deliverySources, /href=["'{`]sms:/i);
assert.doesNotMatch(deliverySources, /SOD_(?:OPERATOR_ALERT|DISPATCHER_MAIN)_PHONE|Dispatcher Main/i);
assert.doesNotMatch(deliverySources, /Reply YES|YES confirmation/i);

console.log("READY workflow storefront guard passed for P60.");
