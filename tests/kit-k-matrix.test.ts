/* eslint-disable @typescript-eslint/no-explicit-any -- kit cases build partial bundles on purpose */
import test from "node:test";
import assert from "node:assert/strict";
import { readFleetContent, codedFleetState, readEmergencyCoded, resetFleetContentCache } from "../app/lib/fleet/read.ts";
import { resolveTvCards, resolveFullscreenPromos, pickTv2Sheet } from "../app/lib/fleet/tv.ts";
import { CODED_BANNERS, CODED_NAP, CODED_PAGES } from "../app/lib/fleet/config.ts";

const now = new Date("2026-10-22T12:00:00Z");
const base = { schemaVersion: 1, storeCode: "PNY01", domain: "www.p60cannabis.com", contentVersion: 9, publishedAt: "2026-10-22T10:00:00Z", sourceHash: "x", jobId: "j" };
function fake(map: Record<string, { status: number; body: string }>): typeof fetch {
  return (async (url: string) => { const r = map[String(url)]; if (!r) throw new Error("net"); return new Response(r.status === 304 ? null : r.body, { status: r.status }); }) as unknown as typeof fetch;
}
const M = "https://x/PNY01/manifest.json", B = "https://x/PNY01/content-v9.json";
const man = (o = {}) => JSON.stringify({ storeCode: "PNY01", contentVersion: 9, bundleUrl: B, publishedAt: base.publishedAt, jobId: "j", ...o });

test("K1 empty bundle (no rows) == coded state", async () => {
  resetFleetContentCache();
  const s = await readFleetContent({ manifestUrl: M, emergencyCoded: false, renderedAt: now.toISOString(), fetchImpl: fake({ [M]: { status: 200, body: man() }, [B]: { status: 200, body: JSON.stringify({ ...base, slots: [] }) } }) });
  const c = codedFleetState(now.toISOString());
  assert.equal(s.active, true);
  assert.deepEqual(s.nap, c.nap); assert.deepEqual(s.pages, c.pages);
  assert.deepEqual(s.tvCards, {}); assert.deepEqual(s.fullscreenPromos, []);
  const { resolveBanners } = await import("../app/lib/fleet/resolve.ts");
  assert.deepEqual(resolveBanners({ ...base, slots: [] } as any), CODED_BANNERS);
});
test("K1 Coded-mode rows also == coded", () => {
  const b: any = { ...base, slots: ["VAPES", "CIGARETTES"].map((spot) => ({ page: "TV2", spot, mode: "Coded", image: "/a.webp", offImage: "/b.webp", promoStart: "2026-01-01", promoEnd: "2027-01-01" })).concat([{ page: "TV", spot: "Fullscreen promo 1", mode: "Coded", image: "/a.webp", promoStart: "2026-01-01", promoEnd: "2027-01-01" } as any]) };
  assert.deepEqual(resolveTvCards(b, now), {}); assert.deepEqual(resolveFullscreenPromos(b, now), []);
});
test("K4 broken promo/off image -> normal card", () => {
  const slot = { card: "VAPES", promoImage: "/p.webp", promoAlt: "a", offImage: "/o.webp", offAlt: "a" };
  assert.equal(pickTv2Sheet(slot, { categoryOff: false, noItems: false, promoBroken: true, offBroken: false }), null);
  assert.equal(pickTv2Sheet(slot, { categoryOff: true, noItems: false, promoBroken: false, offBroken: true }), null);
  assert.equal(pickTv2Sheet(slot, { categoryOff: false, noItems: false, promoBroken: false, offBroken: false })?.kind, "promo");
  assert.equal(pickTv2Sheet(slot, { categoryOff: true, noItems: false, promoBroken: false, offBroken: false })?.kind, "off");
});
test("K9 kill switch coded -> coded state, bundle not fetched", async () => {
  resetFleetContentCache(); let hits = 0;
  const f = (async () => { hits++; throw new Error("x"); }) as unknown as typeof fetch;
  const s = await readFleetContent({ manifestUrl: M, emergencyCoded: true, fetchImpl: f });
  assert.equal(s.active, false); assert.equal(hits, 0); assert.deepEqual(s.tvCards, {}); assert.deepEqual(s.fullscreenPromos, []);
});
test("K9 readEmergencyCoded parses Edge Config item", async () => {
  const prev = process.env.EDGE_CONFIG; process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_test?token=dummy";
  for (const [body, want] of [["\"coded\"", true], ["{\"value\":\"coded\"}", true], ["\"sheet\"", false]] as const) {
    const r = await readEmergencyCoded((async () => new Response(body, { status: 200 })) as any); assert.equal(r, want);
  }
  assert.equal(await readEmergencyCoded((async () => new Response("", { status: 404 })) as any), false);
  if (prev === undefined) delete process.env.EDGE_CONFIG; else process.env.EDGE_CONFIG = prev;
});
const bad: [string, string, string][] = [
  ["invalid json manifest", "{nope", JSON.stringify({ ...base })],
  ["wrong store manifest", man({ storeCode: "STC01" }), JSON.stringify(base)],
  ["invalid json bundle", man(), "{bad"],
  ["wrong store bundle", man(), JSON.stringify({ ...base, storeCode: "STC01" })],
  ["wrong domain bundle", man(), JSON.stringify({ ...base, domain: "evil.com" })],
  ["bad schema bundle", man(), JSON.stringify({ ...base, schemaVersion: 99 })],
  ["missing identity", man(), JSON.stringify({ storeCode: "PNY01" })],
];
for (const [name, m, b] of bad) {
  test(`K10 cold ${name} -> coded`, async () => {
    resetFleetContentCache();
    const s = await readFleetContent({ manifestUrl: M, emergencyCoded: false, fetchImpl: fake({ [M]: { status: 200, body: m }, [B]: { status: 200, body: b } }) });
    assert.equal(s.active, false); assert.deepEqual(s.nap, CODED_NAP); assert.deepEqual(s.pages, CODED_PAGES);
  });
  test(`K10 warm ${name} -> last good kept`, async () => {
    resetFleetContentCache();
    const good = JSON.stringify({ ...base, contentVersion: 8, slots: [{ page: "Contact", spot: "Page meta", mode: "Custom", metaTitle: "GOOD" }] });
    await readFleetContent({ manifestUrl: M, emergencyCoded: false, fetchImpl: fake({ [M]: { status: 200, body: man({ contentVersion: 8 }) }, [B]: { status: 200, body: good } }) });
    const s = await readFleetContent({ manifestUrl: M, emergencyCoded: false, fetchImpl: fake({ [M]: { status: 200, body: m }, [B]: { status: 200, body: b } }) });
    assert.equal(s.contentVersion, 8); assert.equal(s.pages.Contact.metaTitle, "GOOD");
  });
}
test("K10 manifest 500 / network fail -> coded", async () => {
  resetFleetContentCache();
  assert.equal((await readFleetContent({ manifestUrl: M, emergencyCoded: false, fetchImpl: fake({ [M]: { status: 500, body: "" } }) })).active, false);
  assert.equal((await readFleetContent({ manifestUrl: M, emergencyCoded: false, fetchImpl: fake({}) })).active, false);
});
test("K9 fix: kill switch also hides fleet articles", async () => {
  const { loadFleetArticles } = await import("../app/lib/fleet/articles.ts");
  let hits = 0;
  const r = await loadFleetArticles({ emergencyCoded: true, fetchImpl: (async () => { hits++; return new Response("[]"); }) as any });
  assert.equal(r.ok, false); assert.equal(hits, 0);
});
