import assert from "node:assert/strict";
import test from "node:test";
import {
  cigarettePublicHeaders,
  decideCigaretteSurface,
  publishedSurfaceShow,
  readCigaretteTvHeader,
  reconcileSurfaceItems,
} from "../app/lib/cigDecision.ts";
import { visibleTv2Cards } from "../app/lib/tvCigaretteBoard.ts";
import { SHOW_CIGARETTES, filterCigaretteItems, isCigaretteCategory } from "../app/lib/siteConfig.ts";

const cards = [
  { id: "VAPES" },
  { id: "CIGARETTES" },
  { id: "MAGIC" },
];

const carton = { category: "CIGARETTES", name: "BB FULL CARTON", slug: "bb-full-carton" };
const backwoods = { category: "CIGARETTES", name: "BACKWOODS ASSORTED", slug: "backwoods-assorted" };
const cigarillo = { category: "CIGARETTES", name: "CIGARILLO PACK", slug: "cigarillo-pack" };
const paper = { category: "CIGARETTES", name: "ROLLING PAPER", slug: "rolling-paper" };
const pouch = { category: "CIGARETTES", name: "ZYN POUCH", slug: "zyn-pouch" };
const velo = { category: "CIGARETTES", name: "VELO NICOTINE", slug: "velo-nicotine" };
const wrap = { category: "CIGARETTES", name: "HEMP WRAP", slug: "hemp-wrap" };
const vape = { category: "VAPE PENS", name: "Mango Ice", slug: "mango-ice" };

const shelf = [vape, carton, backwoods, cigarillo, paper, pouch, velo, wrap];

const scheduleOn = { on: false, webOn: false, tvOn: true, wording: { tickerLine1: "FEED TICKER" } };

test("tvOn shows the cigarettes card and keeps cigarette items", () => {
  const tv = decideCigaretteSurface({ cig: scheduleOn, items: shelf, surface: "tv" });
  const web = decideCigaretteSurface({ cig: scheduleOn, items: shelf, surface: "web" });
  assert.equal(tv.show, true);
  assert.equal(tv.reason, "on");
  assert.equal(web.show, false);
  assert.equal(web.reason, "off");

  assert.deepEqual(visibleTv2Cards(cards, tv.show).map((card) => card.id), ["VAPES", "CIGARETTES", "MAGIC"]);
  const shown = reconcileSurfaceItems(shelf, [carton], true);
  assert.ok(shown.some((item) => item.slug === carton.slug));
  assert.ok(shown.some((item) => item.slug === backwoods.slug));
  assert.ok(shown.some((item) => item.slug === wrap.slug));

  const headers = cigarettePublicHeaders({ web: web.show, tv: tv.show, wording: tv.wording });
  assert.equal(headers["x-tv-data-cig-tv"], "1");
  assert.equal(headers["x-tv-data-cig-web"], "0");
  const headerLike = { get: (name: string) => headers[name] ?? null };
  assert.equal(readCigaretteTvHeader(headerLike).show, true);
  assert.equal(readCigaretteTvHeader(headerLike).wording.tickerLine1, "FEED TICKER");
});

test("tv off hides the card and real cigarettes, and keeps wraps and pouches", () => {
  const tv = decideCigaretteSurface({ cig: { ...scheduleOn, tvOn: false }, items: shelf, surface: "tv" });
  assert.equal(tv.show, false);
  assert.deepEqual(visibleTv2Cards(cards, false).map((card) => card.id), ["VAPES", "MAGIC"]);

  const hidden = reconcileSurfaceItems(shelf, shelf, false);
  assert.deepEqual(hidden.map((item) => item.slug), [
    vape.slug,
    backwoods.slug,
    cigarillo.slug,
    paper.slug,
    pouch.slug,
    velo.slug,
    wrap.slug,
  ]);
  const headers = cigarettePublicHeaders({ web: false, tv: false, wording: tv.wording });
  assert.equal(headers["x-tv-data-cig-tv"], "0");
});

test("published web flag stays off unless webOn is explicitly on", () => {
  const missed = decideCigaretteSurface({ cig: null, items: [carton], surface: "web", errored: true });
  const tv = decideCigaretteSurface({ cig: scheduleOn, items: [carton], surface: "tv" });
  assert.equal(missed.show, true);
  assert.equal(publishedSurfaceShow(missed, "web"), false);
  assert.equal(publishedSurfaceShow(tv, "tv"), true);
  const explicit = decideCigaretteSurface({ cig: { webOn: true, tvOn: true }, items: [carton], surface: "web" });
  assert.equal(publishedSurfaceShow(explicit, "web"), true);
  const scheduledOff = decideCigaretteSurface({ cig: scheduleOn, items: [carton], surface: "web" });
  assert.equal(publishedSurfaceShow(scheduledOff, "web"), false);
});

test("website catalog stays on the static gate while the TV flag is on", () => {
  assert.equal(SHOW_CIGARETTES, false);
  assert.equal(decideCigaretteSurface({ cig: scheduleOn, items: [carton], surface: "web" }).show, false);
  assert.equal(decideCigaretteSurface({ cig: scheduleOn, items: [carton], surface: "tv" }).show, true);
  assert.equal(isCigaretteCategory("cigarettes") && !SHOW_CIGARETTES, true);
  assert.deepEqual(filterCigaretteItems(shelf).map((item) => item.slug), [vape.slug]);
});
