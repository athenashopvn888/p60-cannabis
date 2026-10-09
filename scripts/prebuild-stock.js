/**
 * Prebuild script: Fetches live stock data from Apps Script
 * and writes flowers.json + items.json before Next.js builds.
 *
 * This runs automatically via "prebuild" in package.json.
 * If the fetch fails, the existing JSON files are kept as fallback.
 */

const fs = require('fs');
const path = require('path');
const { postprocessFlowers, postprocessItems } = require('../app/lib/tvStock.js');

// Shared fleet menu feed. Read ONLY from MENU_FEED_URL (legacy APPS_SCRIPT_URL is ignored on purpose).
const APPS_SCRIPT_URL = (process.env.MENU_FEED_URL || '').trim() ||
  'https://script.google.com/macros/s/AKfycbx09_sDal1eMVF1r-hUck4e7oq_XBHEWhGvA79JuhZNQ6P4CdhCas0xE3FfexWQ3hq4/exec';
const STOCK_META_PATH = require('path').join(__dirname, '..', 'app', 'lib', 'stock-meta.json');
const FLOWERS_PATH = path.join(__dirname, '..', 'app', 'lib', 'flowers.json');
const ITEMS_PATH = path.join(__dirname, '..', 'app', 'lib', 'items.json');

// Grok 2026-10-09: 3 attempts x 90 s (single 30 s attempt timed out on Apps Script cold starts).
async function fetchFeedWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      lastErr = err;
    }
    console.warn(`[prebuild] feed attempt ${i}/${attempts} failed: ${lastErr && lastErr.message}`);
    if (i < attempts) await new Promise((r) => setTimeout(r, 5000));
  }
  throw lastErr;
}

async function main() {
  if (!APPS_SCRIPT_URL) {
    console.log('[prebuild] No APPS_SCRIPT_URL set — using existing static JSON files');
    return;
  }

  console.log('[prebuild] Fetching live stock from Apps Script...');

  try {
    const url = `${APPS_SCRIPT_URL}?store=PNY01`;
    const res = await fetchFeedWithRetry(url);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    if (!data.flowers || !data.items) {
      throw new Error('Invalid response: missing flowers or items');
    }

    // ── Post-process flowers: derive sale flags + clean names ──
    const { saleFixed } = postprocessFlowers(data.flowers);
    if (saleFixed > 0) console.log(`[prebuild] Fixed ${saleFixed} sale flags from names`);

    // Write flowers.json
    fs.writeFileSync(FLOWERS_PATH, JSON.stringify(data.flowers, null, 2), 'utf-8');
    console.log(`[prebuild] flowers.json updated: ${data.flowers.length} products`);

    // Tier breakdown
    const tiers = {};
    data.flowers.forEach(f => { tiers[f.tier] = (tiers[f.tier] || 0) + 1; });
    Object.entries(tiers).forEach(([t, c]) => console.log(`  ${t}: ${c}`));

    // ── Post-process items: fix '$[object Object]' prices ──
    const { itemsFixed } = postprocessItems(data.items);
    if (itemsFixed > 0) console.log(`[prebuild] Fixed ${itemsFixed} mangled item prices`);

    // Write items.json
    fs.writeFileSync(ITEMS_PATH, JSON.stringify(data.items, null, 2), 'utf-8');
    console.log(`[prebuild] items.json updated: ${data.items.length} products`);

    // Category breakdown
    const cats = {};
    data.items.forEach(i => { cats[i.category] = (cats[i.category] || 0) + 1; });
    Object.entries(cats).sort().forEach(([c, n]) => console.log(`  ${c}: ${n}`));

    try {

      fs.writeFileSync(STOCK_META_PATH, JSON.stringify({ stockDate: data.stockDate || '', fetchedAt: new Date().toISOString() }, null, 2) + '\n', 'utf-8');

    } catch (metaErr) {

      console.warn(`[prebuild] stock-meta.json not written: ${metaErr.message}`);

    }

    console.log(`[prebuild] Stock date: ${data.stockDate || 'unknown'}`);
    console.log('[prebuild] Done!');

  } catch (err) {
    console.warn(`[prebuild] Live fetch failed: ${err.message}`);
    console.warn('[prebuild] Keeping existing JSON files as fallback');
  }
}

main();
