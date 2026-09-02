import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("app/page.tsx", "utf8");
const homeCss = readFileSync("app/page.module.css", "utf8");
const landing = readFileSync("app/components/GBPLandingPage.tsx", "utf8");
const landingCss = readFileSync("app/components/GBPLandingPage.module.css", "utf8");

for (const source of [home, landing]) {
  assert.match(source, /href="\/exotic-weed"[\s\S]*?STORE MENU/, "Store Menu must target /exotic-weed");
  assert.match(source, /href="\/weed-delivery-york"[\s\S]*?WEED DELIVERY/, "Weed Delivery must target /weed-delivery-york");
  assert.match(source, /WEED DELIVERY AVAILABLE/, "Weed Delivery announcement headline is required");
  assert.match(source, /York, North York, Vaughan, and Brampton/, "Published P60 delivery area is required");
  assert.match(source, /LIVE ORDER/, "Delivery announcement must explain dispatcher connection");
  assert.doesNotMatch(source, /CALL STORE|Call Store/i, "Landing/home Call Store CTA must be removed");
}
assert.doesNotMatch(landing, /href=\{`tel:[\s\S]{0,120}className=\{`\$\{styles\.btn\}/, "Landing page cannot contain a tel button");
assert.match(homeCss, /\.heroPrimary,[\s\S]*?\.heroSecondary\s*\{[\s\S]*?min-height:\s*46px/, "Home CTAs need touch-safe targets");
assert.match(homeCss, /\.heroActions\s*\{[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "Home CTAs need a non-overflowing pair");
assert.match(landingCss, /\.btn\s*\{[\s\S]*?min-height:\s*44px/, "Landing CTAs need 44px touch targets");

console.log("P60 home and landing action check passed.");
