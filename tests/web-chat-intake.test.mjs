import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const component = fs.readFileSync(new URL("../app/delivery/P60WebChat.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/delivery/delivery.css", import.meta.url), "utf8");

test("ordering intake requires an explicit trusted intent and starts blank", () => {
  assert.match(component, /useState<CustomerIntent \| "">\(""\)/);
  assert.match(component, /value="NEW_CUSTOMER"/);
  assert.match(component, /value="RETURNING_CUSTOMER"/);
  assert.match(component, /if \(!intent\)/);
  assert.match(component, /JSON\.stringify\(\{ storeId: "P60", customerName: name, phone, intent, message: firstMessage \}\)/);
  assert.match(component, /const \[firstMessage, setFirstMessage\] = useState\(""\)/);
  assert.doesNotMatch(component, /Hi, I need help with ID verification|Use the customer|separate P60 customer account|<label>Message/);
});

test("customer copy labels ordering fields without claiming carrier validation", () => {
  for (const text of ["Ready to order?", "I&apos;m new", "I&apos;m returning", "Canadian mobile number", "Must be able to receive verification texts. This becomes your account number.", "Order details (optional)", "Start order chat"]) assert.ok(component.includes(text));
  assert.match(component, /placeholder="List the products and quantities you want, or leave this blank and a dispatcher will help\."/);
  assert.doesNotMatch(component, /carrier|mobile type|validated mobile/i);
  assert.match(component, /activeIntent === "NEW_CUSTOMER"/);
});

test("mobile controls have large targets and explicit focus checked and error states", () => {
  assert.match(styles, /\.sod-intent-options label \{[^}]*min-height:72px/);
  assert.match(styles, /\.sod-intent-options label\.checked/);
  assert.match(styles, /button:focus-visible \{ outline:3px solid #2563eb/);
  assert.match(styles, /\.sod-chat-start > button\[type="submit"\] \{ min-height:50px/);
  assert.match(styles, /input:invalid:not\(:placeholder-shown\)/);
});
