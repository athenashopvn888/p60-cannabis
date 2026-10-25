import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { FULL_NAME_NAP } from "../app/lib/fullNameNap.ts";
import { hideMobileBottomBar } from "../app/lib/mobileBottomBar.ts";
import { pickStoreDirectionsUrl, STORE_DIRECTIONS_URL } from "../app/lib/storeDirections.ts";
import { storeHoursStatus, STORE_OPENING_HOURS, type OpeningHoursSpec } from "../app/lib/storeHoursStatus.ts";

const layout = fs.readFileSync("app/layout.tsx", "utf8");
const globals = fs.readFileSync("app/globals.css", "utf8");
const bar = fs.readFileSync("app/components/MobileBottomBar.tsx", "utf8");
const css = fs.readFileSync("app/components/MobileBottomBar.module.css", "utf8");
const footer = fs.readFileSync("app/components/Footer.tsx", "utf8");
const hoursPage = fs.readFileSync("app/hours/page.tsx", "utf8");
const products = fs.readFileSync("app/lib/products.ts", "utf8");
const nextConfig = fs.readFileSync("next.config.ts", "utf8");
const tvStore = fs.readFileSync("app/lib/tvStore.ts", "utf8");

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function daily(opens: string, closes: string, days: readonly string[] = WEEK): OpeningHoursSpec[] {
  return [{ dayOfWeek: days, opens, closes }];
}

test("this store's hours read as open 24 hours in Toronto", () => {
  assert.deepEqual(
    STORE_OPENING_HOURS.map((spec) => ({ ...spec, dayOfWeek: [...spec.dayOfWeek] })),
    [{ dayOfWeek: [...WEEK], opens: "00:00", closes: "23:59" }],
  );
  assert.match(layout, /"opens": "00:00"/);
  assert.match(layout, /"closes": "23:59"/);
  assert.match(tvStore, /opens: "00:00"/);
  assert.match(tvStore, /closes: "23:59"/);

  for (const iso of ["2026-01-15T15:00:00.000Z", "2026-07-15T04:30:00.000Z", "2026-10-26T03:59:00.000Z"]) {
    const status = storeHoursStatus(new Date(iso));
    assert.equal(status.kind, "always");
    assert.equal(status.label, "Open 24 hours");
  }
});

test("limited hours say open until the close, or the next open, in Toronto", () => {
  const hours = daily("09:00", "21:00");
  const sundayEvening = storeHoursStatus(new Date("2026-10-25T22:00:00.000Z"), hours);
  assert.deepEqual(sundayEvening, { kind: "open", label: "Open now · until 9 p.m." });

  const beforeOpen = storeHoursStatus(new Date("2026-10-26T12:00:00.000Z"), hours);
  assert.deepEqual(beforeOpen, { kind: "closed", label: "Closed · opens 9 a.m." });

  const afterClose = storeHoursStatus(new Date("2026-10-26T02:30:00.000Z"), hours);
  assert.equal(afterClose.kind, "closed");
  assert.equal(afterClose.label, "Closed · opens Mon 9 a.m.");

  const winterAfternoon = storeHoursStatus(new Date("2026-01-15T20:00:00.000Z"), hours);
  assert.deepEqual(winterAfternoon, { kind: "open", label: "Open now · until 9 p.m." });
});

test("overnight windows stay open past midnight and name the next open day", () => {
  const hours = daily("10:00", "02:00", ["Friday"]);
  const fridayNight = storeHoursStatus(new Date("2026-10-24T03:00:00.000Z"), hours);
  assert.deepEqual(fridayNight, { kind: "open", label: "Open now · until 2 a.m." });

  const saturdayEarly = storeHoursStatus(new Date("2026-10-24T05:00:00.000Z"), hours);
  assert.deepEqual(saturdayEarly, { kind: "open", label: "Open now · until 2 a.m." });

  const saturdayLater = storeHoursStatus(new Date("2026-10-24T07:00:00.000Z"), hours);
  assert.deepEqual(saturdayLater, { kind: "closed", label: "Closed · opens Fri 10 a.m." });
});

test("a split day uses the window that is actually open", () => {
  const hours: OpeningHoursSpec[] = [
    { dayOfWeek: ["Monday"], opens: "09:00", closes: "12:00" },
    { dayOfWeek: ["Monday"], opens: "14:00", closes: "18:00" },
  ];
  assert.equal(storeHoursStatus(new Date("2026-10-26T15:00:00.000Z"), hours).label, "Open now · until 12 p.m.");
  assert.equal(storeHoursStatus(new Date("2026-10-26T17:00:00.000Z"), hours).label, "Closed · opens 2 p.m.");
  assert.equal(storeHoursStatus(new Date("2026-10-26T19:30:00.000Z"), hours).label, "Open now · until 6 p.m.");
});

test("directions prefers a short GBP pin, then a place link, then an address URL", () => {
  const address = "1938 Weston Rd, York, ON M9N 1W2";
  assert.equal(
    pickStoreDirectionsUrl(
      ["https://maps.app.goo.gl/p60pin", "https://www.google.com/maps/place/?q=place_id:abc"],
      address,
    ),
    "https://maps.app.goo.gl/p60pin",
  );
  assert.equal(
    pickStoreDirectionsUrl(["", FULL_NAME_NAP.mapsUrl], address),
    FULL_NAME_NAP.mapsUrl,
  );
  assert.equal(
    pickStoreDirectionsUrl(["", ""], address),
    "https://www.google.com/maps/dir/?api=1&destination=1938%20Weston%20Rd%2C%20York%2C%20ON%20M9N%201W2",
  );
  assert.equal(STORE_DIRECTIONS_URL, FULL_NAME_NAP.mapsUrl);
  assert.match(STORE_DIRECTIONS_URL, /place_id:ChIJZ_nYyQIxK4gRKOTKHwfk5bQ/);
  assert.equal(STORE_DIRECTIONS_URL.includes("google.com/maps"), true);
});

test("the bar is mounted on every page, hidden on the TV screens, and only pads small screens", () => {
  assert.match(layout, /import MobileBottomBar from "\.\/components\/MobileBottomBar"/);
  assert.match(layout, /<MobileBottomBar \/>/);
  assert.equal(hideMobileBottomBar("/tv"), true);
  assert.equal(hideMobileBottomBar("/tv2"), true);
  assert.equal(hideMobileBottomBar("/tv/"), true);
  assert.equal(hideMobileBottomBar("/hours"), false);
  assert.equal(hideMobileBottomBar("/"), false);
  assert.match(bar, /hideMobileBottomBar\(pathname\)/);
  assert.match(bar, /if \(hidden\) return null/);
  assert.match(globals, /--mobile-action-bar-height:\s*0px/);
  assert.match(
    globals,
    /@media \(max-width:\s*768px\)\s*\{[\s\S]*--mobile-action-bar-height:\s*calc\(68px \+ env\(safe-area-inset-bottom, 0px\)\)[\s\S]*body:has\(\[data-mobile-bottom-bar\]\)[\s\S]*padding-bottom:\s*var\(--mobile-action-bar-height\)/,
  );
});

test("directions, hours, menu, and delivery fit the bar and call is absent", () => {
  assert.match(bar, /href=\{STORE_DIRECTIONS_URL\}/);
  assert.match(bar, /href="\/hours"/);
  assert.ok(fs.existsSync("app/hours/page.tsx"));
  assert.match(bar, /href="\/exotic-weed"/);
  assert.match(products, /slug:\s*"exotic-weed"/);
  assert.match(bar, />\s*Menu\s*</);
  assert.match(bar, /href="\/delivery"/);
  assert.ok(fs.existsSync("app/delivery/page.tsx"));
  assert.ok(fs.existsSync("app/weed-delivery-york/page.tsx"));
  assert.match(nextConfig, /source:\s*"\/delivery",\s*destination:\s*"\/weed-delivery-york"/);
  assert.match(bar, />\s*Delivery\s*</);
  assert.match(bar, />\s*Directions\s*</);
  assert.doesNotMatch(bar, /Call|tel:/);
  assert.match(footer, /tel:\+12892172763/);
  assert.match(hoursPage, /tel:\$\{PHONE_INTL\}/);
  assert.match(css, /\.bar\s*\{[^}]*display:\s*none/s);
  assert.match(css, /@media \(max-width:\s*768px\)\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /bottom:\s*0/);
  assert.match(css, /minmax\(0,\s*1\.25fr\)\s+minmax\(0,\s*1\.5fr\)\s+minmax\(44px,\s*0\.72fr\)\s+minmax\(44px,\s*0\.9fr\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /var\(--green-dark/);
});
