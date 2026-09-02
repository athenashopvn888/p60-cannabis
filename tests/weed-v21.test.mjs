import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const tierPairs = [
  ["Exotic Weed", "/exotic-weed", "/exotic"],
  ["Premium Weed", "/premium-weed", "/premium"],
  ["AAA+ Weed", "/aaa-weed", "/aaa"],
  ["AA Weed", "/aa-weed", "/aa"],
  ["Budget Weed", "/budget-weed", "/budget"],
];

test("V2.1 tier owners use Tier Name + Weed and direct canonical links", async () => {
  const [products, tierPage, nav, footer, home, sitemap, redirects] = await Promise.all([
    read("app/lib/products.ts"),
    read("app/[tier]/page.tsx"),
    read("app/components/Navbar.tsx"),
    read("app/components/Footer.tsx"),
    read("app/page.tsx"),
    read("app/sitemap.ts"),
    read("next.config.ts"),
  ]);

  for (const [label, canonical, legacy] of tierPairs) {
    const slug = canonical.slice(1);
    assert(products.includes(`name: "${label}"`));
    assert(products.includes(`slug: "${slug}"`));
    assert(nav.includes(`href: "${canonical}", label: "${label}"`));
    assert(footer.includes(`href="${canonical}">${label}`));
    assert(home.includes(`name: "${label}"`));
    assert(home.includes(`slug: "${slug}"`));
    assert(redirects.includes(`source: "${legacy}", destination: "${canonical}", permanent: true`));
  }

  assert(tierPage.includes("&amp; Cannabis Flower in York"));
  assert(sitemap.includes("TIER_CONFIG"));
});

test("qualified Weed Delivery has one canonical owner and a direct legacy redirect", async () => {
  const [deliveryPage, deliveryCatalog, nav, footer, home, layout, sitemap, redirects, newRoute] = await Promise.all([
    read("app/delivery/page.tsx"),
    read("app/delivery/DeliveryCatalog.tsx"),
    read("app/components/Navbar.tsx"),
    read("app/components/Footer.tsx"),
    read("app/page.tsx"),
    read("app/layout.tsx"),
    read("app/sitemap.ts"),
    read("next.config.ts"),
    read("app/weed-delivery-york/page.tsx"),
  ]);

  assert(deliveryPage.includes('title: { absolute: "Weed Delivery York | P60 Cannabis" }'));
  assert(deliveryPage.includes('canonical: "https://www.p60cannabis.com/weed-delivery-york"'));
  assert(deliveryCatalog.includes('>Weed Delivery in York</h1>'));
  assert(nav.includes('{ href: "/weed-delivery-york", label: "Weed Delivery" }'));
  assert(footer.includes('<Link href="/weed-delivery-york">Weed Delivery</Link>'));
  assert(home.includes('href="/weed-delivery-york"'));
  assert(layout.includes('href="/weed-delivery-york"'));
  assert(sitemap.includes("`${BASE}/weed-delivery-york`"));
  assert(redirects.includes('source: "/delivery", destination: "/weed-delivery-york", permanent: true'));
  assert(newRoute.includes('from "../delivery/page"'));
});

test("Nicotine Vape and THC Vape remain separate without moving routes", async () => {
  const [products, nav, footer, home, nicotineGuide] = await Promise.all([
    read("app/lib/products.ts"),
    read("app/components/Navbar.tsx"),
    read("app/components/Footer.tsx"),
    read("app/page.tsx"),
    read("app/lib/seoPages.ts"),
  ]);

  assert(products.includes('name: "Nicotine Vape", slug: "vapes"'));
  assert(products.includes('name: "THC Vape", slug: "vape-disposables"'));
  assert(products.includes("Nicotine is addictive"));
  assert(nav.includes('{ href: "/items/vapes", label: "Nicotine Vape" }'));
  assert(nav.includes('{ href: "/items/vape-disposables", label: "THC Vape" }'));
  assert(footer.includes('href="/items/vapes">Nicotine Vape'));
  assert(footer.includes('href="/items/vape-disposables">THC Vape'));
  assert(home.includes('{ name: "Nicotine Vape", slug: "items/vapes"'));
  assert(home.includes('{ name: "THC Vape", slug: "items/vape-disposables"'));
  assert(nicotineGuide.includes('menuHref: "/items/vapes"'));
  assert(nicotineGuide.includes("THC and cannabis vape products remain separate in the THC Vape category"));
});

test("Weed resource family owns weed-bearing paths and legacy paths redirect once", async () => {
  const [resources, redirects] = await Promise.all([
    read("app/resources/resourceData.ts"),
    read("next.config.ts"),
  ]);

  const newPaths = [
    "/resources/weed-flower-guides",
    "/resources/weed-flower-guides/aa-vs-aaa-vs-premium-vs-exotic",
    "/resources/weed-flower-guides/budget-vs-premium-flower",
  ];
  for (const path of newPaths) assert(resources.includes(`"${path}"`));
  assert(!resources.includes('path: "/resources/flower-guides'));
  assert(redirects.includes('source: "/resources/flower-guides", destination: "/resources/weed-flower-guides", permanent: true'));
  assert(resources.includes('h1: "P60 Cannabis Weed & Flower Guides"'));
  assert(resources.includes('{ label: "Explore P60 Cannabis Weed in York", href: "/weed-dispensary-york" }'));
});

test("protected owner and volatile public-copy corrections remain bounded", async () => {
  const [owner, home, root] = await Promise.all([
    read("app/components/GBPLandingPage.tsx"),
    read("app/page.tsx"),
    read("app/layout.tsx"),
  ]);

  assert(owner.includes("York Weed and cannabis selection"));
  assert(!owner.includes("fully licensed"));
  assert(!owner.includes("complete line of weed products"));
  assert(!owner.includes("parkingNote"));
  assert(!home.includes("Free evening street parking"));
  assert(!home.includes("What is the cheapest weed"));
  assert(!root.includes('priceRange: "$3 - $12/g"'));
});

test("post-live cleanup normalizes the broad canonical and removes audited public mechanics language", async () => {
  const [ownerPage, seoPages, products] = await Promise.all([
    read("app/weed-dispensary-york/page.tsx"),
    read("app/lib/seoPages.ts"),
    read("app/lib/products.ts"),
  ]);

  assert(ownerPage.includes('title: "Weed Dispensary in York"'));
  assert(ownerPage.includes('canonical: `https://${gbpLocation.domain}/${gbpLocation.slug}`'));
  assert(!ownerPage.includes('${gbpLocation.slug}/`'));

  for (const phrase of ["this page", "live-checked", "/items/vape-disposables are excluded"]) {
    assert(!seoPages.toLowerCase().includes(phrase));
  }
  assert(!products.toLowerCase().includes("this page"));
  assert(products.includes('seoTitle: "Cannabis Concentrates in York"'));
  assert(products.includes('seoTitle: "Pre-Rolls in York"'));
  assert(seoPages.includes('title: "York Weed Dispensary"'));
  assert(seoPages.includes('title: "Cheap Weed York Value Guide"'));
  assert(seoPages.includes('title: "Native Cigarettes York"'));
  assert(seoPages.includes('title: "Weed Store Near Toronto"'));
  assert(seoPages.includes('title: "Cannabis Dispensary Near Me York"'));
});
