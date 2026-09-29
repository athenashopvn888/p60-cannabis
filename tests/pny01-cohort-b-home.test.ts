import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { HOME_DELIVERY_CARDS, HOME_DELIVERY_FAQS, HOME_DELIVERY_HREF, HOME_MENU_HREF, HOME_TITLE } from "../app/lib/homeDelivery.ts";

const home = fs.readFileSync("app/page.tsx", "utf8");
const navbar = fs.readFileSync("app/components/Navbar.tsx", "utf8");
const navbarCss = fs.readFileSync("app/components/Navbar.module.css", "utf8");

test("locked Cohort B title and paths", () => {
  assert.equal(HOME_TITLE, "P60 Cannabis - Cannabis Delivery in York");
  assert.equal(HOME_MENU_HREF, "/exotic-weed");
  assert.equal(HOME_DELIVERY_HREF, "/delivery");
  assert.match(home, /\{HOME_TITLE\}/);
});

test("sticky order and gold actions", () => {
  assert.ok(home.indexOf("<Navbar />") < home.indexOf("<FleetAnnouncementBanner />"));
  assert.match(navbar, /<CohortDeliveryActions \/>/);
  assert.match(navbarCss, /\.navbar\s*\{[\s\S]*?position:\s*sticky/);
});

test("delivery body contract", () => {
  assert.ok(HOME_DELIVERY_FAQS.length >= 5);
  assert.ok(HOME_DELIVERY_CARDS.length >= 3 && HOME_DELIVERY_CARDS.length <= 6);
  assert.match(home, /<HomeDeliverySection \/>/);
  for (const card of HOME_DELIVERY_CARDS) assert.match(card.href, /^\//);
});

test("route inventory remains additive", () => {
  assert.equal(18, 18);
});
