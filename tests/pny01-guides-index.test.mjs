import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PNY01 guides index is registry-driven and indexable", async () => {
  const [page, registry] = await Promise.all([read("app/guides/page.tsx"), read("app/lib/guideRegistry.ts")]);
  assert.equal((registry.match(/\{ slug: "[^"]+", lane: "(?:strain|native_cig|nic_vape|thc_vape)"/g) ?? []).length, 29);
  assert.match(registry, /export function getGuidesByLane\(\)/);
  assert.match(page, /title: \{ absolute: "Guides \| P60 Cannabis" \}/);
  assert.match(page, /robots: \{ index: true, follow: true \}/);
  assert.match(page, /"@type": "WebPage"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.doesNotMatch(page, /"@type": "(?:Product|Offer)"|price/i);
});

test("PNY01 Resources, navigation, footer and sitemap expose Guides", async () => {
  const [nav, footer, resources, sitemap] = await Promise.all([read("app/components/Navbar.tsx"), read("app/components/Footer.tsx"), read("app/resources/[[...slug]]/page.tsx"), read("app/sitemap.ts")]);
  assert.ok(nav.indexOf('{ href: "/resources", label: "Resources" }') < nav.indexOf('{ href: "/guides", label: "Guides" }'));
  assert.match(footer, /<Link href="\/guides">Guides<\/Link>/);
  assert.match(resources, /page\.kind === "root"/);
  assert.match(resources, /href="\/guides"/);
  assert.match(resources, /Name Guides/);
  assert.match(sitemap, /`\$\{BASE\}\/guides`/);
  assert.match(sitemap, /GUIDE_REGISTRY\.map/);
});
