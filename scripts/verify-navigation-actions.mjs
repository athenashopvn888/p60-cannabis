import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const navbar = readFileSync("app/components/Navbar.tsx", "utf8");
const styles = readFileSync("app/components/Navbar.module.css", "utf8");

assert.match(navbar, /href="\/exotic"[\s\S]*?Store Menu/i, "Store Menu must target the existing /exotic menu");
assert.match(navbar, /href="\/delivery"[\s\S]*?Delivery Menu/i, "Delivery Menu must target /delivery");
assert.match(navbar, /aria-label="Choose a menu"/, "Menu choices need an accessible label");
assert.match(navbar, /aria-current=/, "Active menu choices must expose aria-current");
assert.match(styles, /\.deliveryMenuChoice\s*\{[\s\S]*?background:/, "Delivery Menu needs a distinct style");
assert.match(styles, /\.menuChoice:focus-visible\s*\{/, "Menu choices need a visible keyboard focus state");
assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.menuChoice\s*\{[\s\S]*?min-height:\s*44px/, "Mobile menu choices need 44px touch targets");
assert.match(styles, /\.menuChoices\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "Menu choices must use a non-overflowing two-column grid");

console.log("Navigation action check passed: Store and Delivery menu controls are prominent, accessible, and mobile-safe.");
