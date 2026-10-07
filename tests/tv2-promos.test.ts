import test from "node:test";
import assert from "node:assert/strict";
import {
  getCigaretteOfferPromo,
  getTv2DaytimePromo,
  isCigaretteOfferVisible,
  isTv2Daytime,
} from "../app/tv2/tv2Promos.ts";

test("TV2 daytime is fixed to America/Toronto regardless of process timezone", () => {
  assert.equal(isTv2Daytime(new Date("2026-10-07T17:35:00.000Z")), true);
  assert.equal(isTv2Daytime(new Date("2026-10-07T13:59:00.000Z")), false);
  assert.equal(isTv2Daytime(new Date("2026-10-07T21:30:00.000Z")), false);
});

test("daytime Cigarettes promo rotates both approved assets every 10 seconds with fallback", () => {
  assert.deepEqual(getTv2DaytimePromo("CIGARETTES", true, 0), {
    src: "/banners/luxury_mix_match_600_web.webp",
    alt: "Mix and Match 2 Packs for $5 and $25 Carton Offer",
    fallbackSrc: "/banners/cig-poster-1.png",
  });
  assert.equal(getTv2DaytimePromo("CIGARETTES", true, 10_000)?.src, "/banners/marlboro_belmont_600x600.webp");
  assert.equal(getTv2DaytimePromo("CIGARETTES", true, 20_000)?.src, "/banners/luxury_mix_match_600_web.webp");
  assert.match(getTv2DaytimePromo("VAPES", true)?.alt || "", /Ultimate Cannabis Collection/);
  assert.equal(getTv2DaytimePromo("CIGARETTES", false), undefined);
});

test("5-second cigarette list overlay runs only outside Toronto daytime", () => {
  assert.equal(isCigaretteOfferVisible(true, 0), false);
  assert.equal(isCigaretteOfferVisible(false, 0), true);
  assert.equal(isCigaretteOfferVisible(false, 4_999), true);
  assert.equal(isCigaretteOfferVisible(false, 5_000), false);
  assert.equal(isCigaretteOfferVisible(false, 30_000), true);
  assert.equal(getCigaretteOfferPromo(true, 0), undefined);
  assert.equal(getCigaretteOfferPromo(false, 0)?.src, "/banners/luxury_mix_match_600_web.webp");
  assert.equal(getCigaretteOfferPromo(false, 30_000)?.src, "/banners/marlboro_belmont_600x600.webp");
});
