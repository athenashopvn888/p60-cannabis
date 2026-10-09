import test from "node:test";
import assert from "node:assert/strict";
import {
  getCigaretteOfferPromo,
  getTv2DaytimePromo,
  isCigaretteOfferVisible,
  isTv2Daytime,
} from "../app/tv2/tv2Promos.ts";

test("TV2 daytime uses America/Toronto regardless of process timezone", () => {
  assert.equal(isTv2Daytime(new Date("2026-10-07T17:35:00.000Z")), true);
  assert.equal(isTv2Daytime(new Date("2026-10-07T13:59:00.000Z")), false);
  assert.equal(isTv2Daytime(new Date("2026-10-07T21:30:00.000Z")), false);
});

test("daytime cigarette promo uses the category collage and leaves VAPES unchanged", () => {
  const collage = {
    src: "/banners/tv2-category-collage.png",
    alt: "Edibles, concentrates, and pre-rolls collage",
  };
  assert.deepEqual(getTv2DaytimePromo("CIGARETTES", true, 0), collage);
  assert.deepEqual(getTv2DaytimePromo("CIGARETTES", true, 10_000), collage);
  assert.match(getTv2DaytimePromo("VAPES", true)?.alt || "", /Ultimate Cannabis Collection/);
  assert.equal(getTv2DaytimePromo("CIGARETTES", false), undefined);
});

test("cigarette promo overlay is hidden during daytime and keeps its night rotation", () => {
  assert.equal(isCigaretteOfferVisible(true, 0), false);
  assert.equal(isCigaretteOfferVisible(false, 0), true);
  assert.equal(isCigaretteOfferVisible(false, 4_999), true);
  assert.equal(isCigaretteOfferVisible(false, 5_000), false);
  assert.equal(isCigaretteOfferVisible(false, 30_000), true);
  assert.equal(getCigaretteOfferPromo(true, 0), undefined);
  assert.equal(getCigaretteOfferPromo(false, 0)?.src, "/banners/luxury_mix_match_600_web.webp");
  assert.equal(getCigaretteOfferPromo(false, 30_000)?.src, "/banners/marlboro_belmont_600x600.webp");
});
