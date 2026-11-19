import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const [baseUrl, outputDirectory] = process.argv.slice(2);
const oidcToken = process.env.VERCEL_OIDC_TOKEN;
const playwrightModule = process.env.PLAYWRIGHT_MODULE_PATH || "playwright";

if (!baseUrl || !outputDirectory) {
  throw new Error("Usage: capture-v2-preview.mjs <preview-url> <output-directory>");
}

if (!oidcToken) {
  throw new Error("VERCEL_OIDC_TOKEN is required for the protected preview");
}

const require = createRequire(import.meta.url);
const { chromium } = require(playwrightModule);
const pages = [
  ["close", "/v2/close"],
  ["email", "/v2/email"],
  ["admin", "/v2/admin"],
  ["carryover", "/v2/carryover"],
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    extraHTTPHeaders: {
      "x-vercel-trusted-oidc-idp-token": oidcToken,
    },
  });

  for (const [name, pathname] of pages) {
    const page = await context.newPage();
    const response = await page.goto(new URL(pathname, baseUrl).href, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    if (!response?.ok()) {
      throw new Error(`${pathname} returned ${response?.status() ?? "no response"}`);
    }
    await page.screenshot({
      path: path.join(outputDirectory, `pnys-v2-${name}-390.png`),
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

process.stdout.write(JSON.stringify({ pages: pages.map(([, pathname]) => pathname), width: 390 }));
