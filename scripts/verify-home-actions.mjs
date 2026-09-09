import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("app/page.tsx", "utf8");
const homeCss = readFileSync("app/page.module.css", "utf8");
const landing = readFileSync("app/components/GBPLandingPage.tsx", "utf8");
const landingCss = readFileSync("app/components/GBPLandingPage.module.css", "utf8");

assert.match(home, /href="\/weed-dispensary-york"[\s\S]*?Visit Our York Store/, "Home must link to the York store owner");
assert.match(home, /href="\/weed-delivery-york"[\s\S]*?Delivery Information/, "Home must link to the delivery owner");
for (const route of ["exotic-weed", "premium-weed", "aaa-weed", "aa-weed", "budget-weed"]) {
  assert(home.includes(`slug: "${route}"`), `Home must preserve /${route}`);
  assert(landing.includes(`href: "/${route}"`), `York owner must link to /${route}`);
}
assert.doesNotMatch(home, /York, North York, Vaughan, and Brampton/, "Delivery-area claims belong only on the delivery owner");
assert.doesNotMatch(landing, /York, North York, Vaughan, and Brampton/, "Delivery-area claims belong only on the delivery owner");
assert.doesNotMatch(landing, /CALL STORE|Call Store/i, "Landing Call Store CTA must be removed");
assert.doesNotMatch(landing, /href=\{`tel:[\s\S]{0,120}className=\{`\$\{styles\.btn\}/, "Landing page cannot contain a tel button");
assert.match(homeCss, /\.heroPrimary,[\s\S]*?\.heroSecondary\s*\{[\s\S]*?min-height:\s*46px/, "Home CTAs need touch-safe targets");
assert.match(homeCss, /\.heroActions\s*\{[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "Home CTAs need a non-overflowing pair");
assert.match(landingCss, /\.btn\s*\{[\s\S]*?min-height:\s*44px/, "Landing CTAs need 44px touch targets");

console.log("P60 home and landing action check passed.");
