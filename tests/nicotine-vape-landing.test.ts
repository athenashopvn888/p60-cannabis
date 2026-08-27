import assert from "node:assert/strict";
import test from "node:test";
import { SEO_PAGES } from "../app/lib/seoPages.ts";

const page = SEO_PAGES.find((entry) => entry.slug === "nicotine-vapes-york");
const slugs = ["geek-promax-5-30k-puffs","geek-universe-25k-puffs","nexa-pix-30k-puffs-many-flavors","ovns-10000-5-10k-puffs","ovns-disposable-5-8ml-many-flavors","ovns-pioneer-5-22k-puffs"];

test("P60 Cannabis nicotine page uses the six live-checked VAPE PENS products", () => {
  assert.ok(page?.heroPreview);
  assert.deepEqual(page.heroPreview.products.map((product) => product.sourceSlug), slugs);
  assert.equal(page.heroPreview.menuHref, "/items/vapes");
  assert.equal(page.heroPreview.secondaryHref, "#featured-vapes");
  assert.equal(page.heroPreview.warning, "Adults 19+. Nicotine is addictive.");
  assert.match(page.sections[2].body, /\/items\/vape-disposables/);
});
