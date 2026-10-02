import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");
const guides = JSON.parse(read("app/lib/guideCopy.json"));

test("rich guide pack is complete and offer-free", () => {
  assert.equal(guides.length, 44);
  assert.equal(new Set(guides.map((guide) => guide.slug)).size, 44);
  assert.deepEqual(Object.fromEntries(["strain", "native_cig", "nic_vape", "thc_vape"].map((lane) => [lane, guides.filter((guide) => guide.lane === lane).length])), { strain: 18, native_cig: 13, nic_vape: 7, thc_vape: 6 });
  for (const guide of guides) {
    assert.ok(guide.body_md.length > 500, guide.slug);
    assert.equal(guide.seo.schema.omit_offers, true, guide.slug);
    assert.ok(Array.isArray(guide.seo.schema.faq_items), guide.slug);
  }
  assert.ok(guides.some((guide) => guide.slug === "belmont-king-size"));
  assert.ok(guides.some((guide) => guide.slug === "packwoods-thc-vape"));
});

test("guide renderer uses pack prose and supported schema without offers", () => {
  const registry = read("app/lib/guideRegistry.ts");
  const page = read("app/guides/[slug]/page.tsx");
  assert.match(registry, /bodyMd: entry\.body_md/);
  assert.match(page, /<GuideBody markdown=\{guide\.bodyMd\}/);
  assert.match(page, /guide\.schema\.types\.includes\("FAQPage"\)/);
  assert.match(page, /guide\.schema\.types\.includes\("Product"\)/);
  assert.doesNotMatch(page, /offers\s*:/);
});

test("homepage deal strip follows BB Belmont and links to cigarettes", () => {
  const banner = read("app/components/FleetAnnouncementBanner.tsx");
  const premiumImage = Math.max(banner.indexOf("data-bb-premium-banner"), banner.indexOf("data-belmont-premium-banner"));
  assert.ok(premiumImage > -1 && banner.indexOf("data-belmont-mix-match-banner") > premiumImage);
  assert.match(banner, /aria-label="BELMONT KING SIZE \$10 - 2PACK BB \$5 MIX & MATCH"/);
  assert.match(banner, /href="\/items\/cigarettes" data-belmont-mix-match-banner/);
});

test("sitemap emits every registry guide", () => {
  const sitemap = read("app/sitemap.ts");
  assert.match(sitemap, /GUIDE_REGISTRY\.map/);
  assert.match(sitemap, /`\$\{BASE\}\/guides\/\$\{guide\.slug\}`/);
});
