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
  assert.match(component, /customerName: intent === "NEW_CUSTOMER" \? name : ""/);
  assert.match(component, /const \[firstMessage, setFirstMessage\] = useState\(""\)/);
  assert.doesNotMatch(component, /Hi, I need help with ID verification|Use the customer|separate P60 customer account|<label>Message/);
});

test("customer paths label only the fields each intent needs", () => {
  for (const text of ["I&apos;m new", "I&apos;m returning", "Canadian mobile number", "Must be able to receive verification texts. This becomes your account number.", "Order details (optional)", "Start order chat"]) assert.ok(component.includes(text));
  assert.match(component, /intent === "NEW_CUSTOMER" && <><div className="sod-chat-welcome"/);
  assert.match(component, /intent && <><label>Canadian mobile number/);
  assert.match(component, /placeholder="What would you like to order today\?"/);
  assert.doesNotMatch(component, /<div className="sod-chat-welcome"><h2>Ready to order\?/);
  assert.doesNotMatch(component, /carrier|mobile type|validated mobile/i);
  assert.match(component, /activeIntent === "NEW_CUSTOMER"/);
});

test("mobile controls have large targets and explicit focus checked and error states", () => {
  assert.match(styles, /\.sod-intent-options \{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.sod-intent-options label \{[^}]*min-height:76px/);
  assert.match(styles, /\.sod-intent-options label\.checked/);
  assert.match(styles, /button:focus-visible \{ outline:3px solid #2563eb/);
  assert.match(styles, /\.sod-chat-start > button\[type="submit"\] \{ min-height:50px/);
  assert.match(styles, /input:invalid:not\(:placeholder-shown\)/);
});

test("authenticated chat exposes confirmed phone correction and explicit additional intake cycles", () => {
  assert.match(component, /customerNumberMasked/);
  assert.match(component, />Change number</);
  assert.match(component, /New Canadian mobile number/);
  assert.match(component, /Enter the new number again/);
  assert.match(component, /phoneConfirmation: replacementPhoneConfirmation/);
  assert.match(component, /phoneVersion: conversation\.phoneVersion/);
  assert.match(component, /\/api\/web-chat\/phone/);
  assert.match(component, /START ANOTHER ORDER/);
  assert.match(component, /\/api\/web-chat\/order-cycle/);
  assert.match(component, /requestId: crypto\.randomUUID\(\)/);
  assert.match(styles, /\.sod-chat-account/);
});

test("approved selfie consent copy explains secure retained use without exposing storage details", () => {
  assert.match(component, /securely retained for future identity and address verification until replaced, manually removed, or your profile is deleted/);
  assert.match(component, /Unapproved photos expire after 24 hours/);
  assert.doesNotMatch(component, /BLOB_READ_WRITE_TOKEN|approvedImageKey|sod-id\//);
});
