/**
 * ============================================================
 *   Storefront — Email-to-Website Product Sync
 *   Google Apps Script (Code.gs)
 * ============================================================
 * 
 * Reads POS ONHAND emails from Gmail, parses stock data,
 * exposes it as a JSON API, and triggers Vercel rebuilds.
 * 
 * SETUP:
 *   1. Create new Apps Script project: script.google.com
 *   2. Paste this code
 *   3. Run setupConfig() once to set your config
 *   4. Deploy as Web App (Execute as: Me, Access: Anyone)
 *   5. Set daily trigger for dailySync()
 * ============================================================
 */


// ── Configuration ──

/**
 * Run this ONCE to set your configuration.
 * Edit the values below, then run this function.
 */
function setupConfig() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    // Vercel deploy hook URL
    'VERCEL_DEPLOY_HOOK': 'https://api.vercel.com/v1/integrations/deploy/YOUR_VERCEL_DEPLOY_HOOK_HERE',
    
    // AthenaWebsiteMaster Google Sheet ID
    'MASTER_SHEET_ID': '1ECyzLymF6-aZn30Lt_BTzvXvXZr6LlEPHVixiv3McbQ',
    
    // Store code
    'STORE_CODE': 'YOUR_STORE_CODE_HERE'
  });
  
  Logger.log('Config saved! Now deploy as Web App and set up daily trigger.');
}


// ── Email Parsing ──

/**
 * Search Gmail for the latest ONHAND email for a store.
 * Email format: "STORECODE - CURRENT STOCK"
 * Body lines: "318 3g=15 5g=18 14g=2" or "637 E=8"
 * 
 * @param {string} storeCode - e.g. "ALC01"
 * @returns {Object} { storeCode, date, stock: { sku: { "3g": qty, ... } } }
 */
function parseOnhandEmail(storeCode) {
  storeCode = storeCode || getConfig_('STORE_CODE');
  
  // Search for latest ONHAND email
  var query = 'subject:"' + storeCode + ' - CURRENT STOCK"';
  var threads = GmailApp.search(query, 0, 1);
  
  if (!threads.length) {
    Logger.log('No ONHAND email found for ' + storeCode);
    return null;
  }
  
  var messages = threads[0].getMessages();
  var msg = messages[messages.length - 1]; // Latest message in thread
  var body = msg.getPlainBody();
  var emailDate = msg.getDate();
  
  Logger.log('Found email: ' + msg.getSubject() + ' (' + emailDate + ')');
  
  // Parse stock lines
  var stock = {};
  var lines = body.split('\n');
  var dataStarted = false;
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    
    // Skip header lines
    if (!line) continue;
    if (line.indexOf('CURRENT STOCK') >= 0) { dataStarted = true; continue; }
    if (line.indexOf('DATE:') >= 0) continue;
    if (line.indexOf('****') >= 0) { dataStarted = true; continue; }
    if (line.indexOf('SEE ATTACHMENT') >= 0) break;
    if (!dataStarted) continue;
    
    // Parse: "318 3g=15 5g=18 14g=2" or "637 E=8"
    var parts = line.split(/\s+/);
    var sku = parts[0];
    
    // SKU must be numeric
    if (!/^\d+$/.test(sku)) continue;
    
    var weights = {};
    for (var j = 1; j < parts.length; j++) {
      var match = parts[j].match(/^(\w+)=(\d+)$/);
      if (match) {
        var weightKey = match[1].toLowerCase(); // "3g", "5g", "14g", "28g", "e"
        var qty = parseInt(match[2], 10);
        weights[weightKey] = qty;
      }
    }
    
    stock[sku] = weights;
  }
  
  var skuCount = Object.keys(stock).length;
  Logger.log('Parsed ' + skuCount + ' SKUs from email');
  
  return {
    storeCode: storeCode,
    date: emailDate.toISOString(),
    skuCount: skuCount,
    stock: stock
  };
}


// ── Master Catalog ──

/**
 * Fetch master catalog from Google Sheet.
 * Returns { flowers: [...], items: [...] }
 */
function fetchMasterCatalog_() {
  var sheetId = getConfig_('MASTER_SHEET_ID');
  if (!sheetId) {
    Logger.log('WARNING: No MASTER_SHEET_ID configured');
    return { flowers: [], items: [] };
  }
  
  var ss = SpreadsheetApp.openById(sheetId);
  
  // FLOWERS_LIVE
  var flowersSheet = ss.getSheetByName('FLOWERS_LIVE');
  var flowers = [];
  if (flowersSheet) {
    var fData = flowersSheet.getDataRange().getValues();
    var fHeaders = fData[0];
    for (var i = 1; i < fData.length; i++) {
      var row = fData[i];
      if (!row[0]) continue; // Skip empty SKU
      var obj = {};
      for (var j = 0; j < fHeaders.length; j++) {
        if (fHeaders[j]) obj[fHeaders[j]] = row[j];
      }
      flowers.push(obj);
    }
  }
  
  // ITEMS_LIVE
  var itemsSheet = ss.getSheetByName('ITEMS_LIVE');
  var items = [];
  if (itemsSheet) {
    var iData = itemsSheet.getDataRange().getValues();
    var iHeaders = iData[0];
    for (var i = 1; i < iData.length; i++) {
      var row = iData[i];
      if (!row[0]) continue;
      var obj = {};
      for (var j = 0; j < iHeaders.length; j++) {
        if (iHeaders[j]) obj[iHeaders[j]] = row[j];
      }
      items.push(obj);
    }
  }
  
  Logger.log('Master catalog: ' + flowers.length + ' flowers, ' + items.length + ' items');
  return { flowers: flowers, items: items };
}


// ── JSON Builder ──

/**
 * Merge master catalog with stock data to produce website-ready JSON.
 */
function buildProductJSON_(catalog, stockData) {
  var stock = stockData ? stockData.stock : {};
  
  // Build flowers
  var flowers = [];
  for (var i = 0; i < catalog.flowers.length; i++) {
    var f = catalog.flowers[i];
    var sku = String(f['SKU']).replace('.0', '').trim();
    var skuStock = stock[sku];
    
    // If we have stock data but this SKU isn't in it, skip (out of stock)
    if (stockData && !skuStock) continue;
    
    var tier = String(f['Tier'] || '').trim().toUpperCase();
    if (['EXOTIC', 'PREMIUM', 'AAA+', 'AA', 'BUDGET'].indexOf(tier) < 0) continue;
    
    var name = String(f['Strain'] || '').trim();
    
    // Detect sale from strain name BEFORE stripping it
    var nameHasSale = /\bSALE\b/i.test(name) || /ON\s*SALE/i.test(name);
    
    // Strip sale emoji/text from strain name for clean display
    name = name.replace(/[\u{1F525}\u{2728}]?\s*SALE$/u, '').replace(/\?SALE$/, '').trim();
    // Also strip "(AAA+ ON SALE)" / "AAA+ SALE!" patterns
    name = name.replace(/\s*\(?\s*AAA\+?\s*ON\s*SALE\s*\)?\s*$/i, '').trim();
    name = name.replace(/\s*\(?\s*AAA\+?\s*SALE!?\s*\)?\s*$/i, '').trim();
    name = name.replace(/\s*\bON\s*SALE\s*$/i, '').trim();
    if (!name) continue;
    
    // Detect type + flags from Type column (e.g. "IH SALE", "SH HOT")
    var typeRaw = String(f['Type'] || 'hybrid').trim().toUpperCase();
    var typeInfo = detectType_(typeRaw);
    
    // Parse prices (supports pipe format: "40|30" = regular $40, sale $30)
    var p3g = parsePriceCell_(f['Price_3G']);
    var p5g = parsePriceCell_(f['Price_5G']);
    var p14g = parsePriceCell_(f['Price_14G']);
    var p28g = parsePriceCell_(f['Price_28G']);
    
    // Apply stock-based weight visibility
    if (skuStock) {
      if (!skuStock['3g'] || skuStock['3g'] <= 0) p3g = null;
      if (!skuStock['5g'] || skuStock['5g'] <= 0) p5g = null;
      if (!skuStock['14g'] || skuStock['14g'] <= 0) p14g = null;
      if (!skuStock['28g'] || skuStock['28g'] <= 0) p28g = null;
    }
    
    // Must have at least one weight available
    if (!p3g && !p5g && !p14g && !p28g) continue;
    
    // Determine sale/hot from Type column flags
    var isSale = typeInfo.isSale || nameHasSale;
    var isHot = typeInfo.isHot;
    
    // Also check explicit IsHot / IsSale columns if present
    var isHotRaw = String(f['IsHot'] || '').trim().toUpperCase();
    var isSaleRaw = String(f['IsSale'] || '').trim().toUpperCase();
    if (isHotRaw === 'TRUE' || isHotRaw === 'YES' || isHotRaw === '1') isHot = true;
    if (isSaleRaw === 'TRUE' || isSaleRaw === 'YES' || isSaleRaw === '1') isSale = true;
    
    // If any price has a sale value, mark as sale
    if ((p3g && p3g.sale !== null) || (p5g && p5g.sale !== null) ||
        (p14g && p14g.sale !== null) || (p28g && p28g.sale !== null)) {
      isSale = true;
    }
    
    flowers.push({
      sku: sku,
      name: name,
      slug: slugify_(name),
      tier: tier,
      type: typeInfo.type,
      isHot: isHot,
      isSale: isSale,
      thc: parseThc_(f['THC']),
      price3g: p3g,
      price5g: p5g,
      price14g: p14g,
      price28g: p28g,
      image: String(f['ImageURL'] || '').trim()
    });
  }
  
  // Build items
  var items = [];
  for (var i = 0; i < catalog.items.length; i++) {
    var it = catalog.items[i];
    var sku = String(it['SKU'] || '').trim();
    if (!sku) continue;
    
    // For items with multiple SKUs like "800, 801, 802"
    // Check if ANY of the SKUs are in stock
    var skus = sku.split(',');
    var inStock = false;
    
    if (!stockData) {
      inStock = true; // No stock data = show all
    } else {
      for (var s = 0; s < skus.length; s++) {
        var singleSku = skus[s].trim().replace('.0', '');
        if (stock[singleSku]) {
          inStock = true;
          break;
        }
      }
    }
    
    if (!inStock) continue;
    
    var name = String(it['Name'] || '').trim();
    if (!name) continue;
    
    var priceRaw = it['Price_EACH'];
    var priceStr = '';
    if (priceRaw !== null && priceRaw !== undefined && String(priceRaw).trim()) {
      var p = parsePriceCell_(priceRaw);
      if (p && typeof p === 'object') {
        // parsePriceCell_ returns {regular, sale} — show sale if available
        priceStr = p.sale !== null ? '$' + p.sale : '$' + p.regular;
      } else if (p) {
        priceStr = '$' + p;
      } else {
        priceStr = String(priceRaw).trim();
      }
    }
    
    items.push({
      sku: sku.replace(/\.0/g, '').trim(),
      name: name,
      slug: slugify_(name),
      category: String(it['Category'] || 'ADD ONS').trim().toUpperCase(),
      type: String(it['Type'] || '').trim(),
      thc: String(it['THC'] || '').trim(),
      mg: String(it['MG'] || '').trim(),
      price: priceStr,
      image: String(it['ImageURL'] || '').trim(),
      promoImage: String(it['PPromoimageurl'] || it['PPromo'] || '').trim() || null
    });
  }
  
  return { flowers: flowers, items: items };
}


// ── Web App Endpoint ──

/**
 * GET endpoint: Returns merged product data (catalog + stock).
 * 
 * Usage:
 *   ?store=ALC01           → Full product JSON (default)
 *   ?store=ALC01&stock=1   → Stock data only
 *   ?store=ALC01&catalog=1 → Catalog only (no stock filter)
 */
function doGet(e) {
  var store = (e && e.parameter && e.parameter.store) || getConfig_('STORE_CODE');
  var stockOnly = e && e.parameter && e.parameter.stock === '1';
  var catalogOnly = e && e.parameter && e.parameter.catalog === '1';
  
  var result;
  
  if (stockOnly) {
    // Return just stock data from email
    result = parseOnhandEmail(store);
  } else if (catalogOnly) {
    // Return just catalog (no stock filtering)
    var catalog = fetchMasterCatalog_();
    result = buildProductJSON_(catalog, null);
  } else {
    // Full merge: catalog filtered by stock
    var stockData = parseOnhandEmail(store);
    var catalog = fetchMasterCatalog_();
    result = buildProductJSON_(catalog, stockData);
    result.storeCode = store;
    result.stockDate = stockData ? stockData.date : null;
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── Deploy Trigger ──

/**
 * Call the Vercel deploy hook to trigger a site rebuild.
 */
function triggerVercelDeploy_() {
  var hookUrl = getConfig_('VERCEL_DEPLOY_HOOK');
  if (!hookUrl) {
    Logger.log('No VERCEL_DEPLOY_HOOK configured. Skipping deploy.');
    return false;
  }
  
  try {
    var response = UrlFetchApp.fetch(hookUrl, { method: 'post', muteHttpExceptions: true });
    var code = response.getResponseCode();
    Logger.log('Deploy hook response: ' + code);
    return code >= 200 && code < 300;
  } catch (err) {
    Logger.log('Deploy hook error: ' + err);
    return false;
  }
}


/**
 * Daily sync: parse latest ONHAND email and trigger Vercel rebuild.
 * Set this as a daily time-based trigger.
 */
function dailySync() {
  var storeCode = getConfig_('STORE_CODE');
  Logger.log('=== Daily Sync: ' + storeCode + ' ===');
  
  // Parse email to verify it works
  var stockData = parseOnhandEmail(storeCode);
  if (!stockData) {
    Logger.log('No ONHAND email found. Skipping deploy.');
    return;
  }
  
  Logger.log('Stock date: ' + stockData.date);
  Logger.log('SKUs in stock: ' + stockData.skuCount);
  
  // Check if this is a new email (not already processed)
  var lastProcessed = getConfig_('LAST_PROCESSED_DATE');
  if (lastProcessed === stockData.date) {
    Logger.log('Already processed this email. Skipping deploy.');
    return;
  }
  
  // Trigger Vercel rebuild
  var deployed = triggerVercelDeploy_();
  if (deployed) {
    // Remember we processed this one
    PropertiesService.getScriptProperties().setProperty('LAST_PROCESSED_DATE', stockData.date);
    Logger.log('Deploy triggered successfully!');
  }
}


// ── Utility Functions ──

function getConfig_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function slugify_(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse price cell. Supports:
 *   "$40" or "40"  → { regular: 40, sale: null }
 *   "40|30"        → { regular: 40, sale: 30 }
 *   blank/N/A      → null
 */
function parsePriceCell_(val) {
  if (val === null || val === undefined) return null;
  var s = String(val).trim().replace(/\$/g, '').replace(/,/g, '');
  if (!s || s === '-' || s === 'N/A' || s === 'None') return null;
  
  // Pipe format: "40|30" = regular|sale
  if (s.indexOf('|') > -1) {
    var parts = s.split('|');
    var reg = parseFloat(parts[0].trim());
    var sal = parseFloat(parts[1].trim());
    if (isNaN(reg)) return null;
    return { regular: Math.round(reg), sale: isNaN(sal) ? null : Math.round(sal) };
  }
  
  var n = parseFloat(s);
  return isNaN(n) ? null : { regular: Math.round(n), sale: null };
}

function parseThc_(val) {
  if (val === null || val === undefined) return '';
  var s = String(val).trim().replace('%', '');
  if (!s || s === '-' || s === 'None') return '';
  var n = parseFloat(s);
  if (isNaN(n)) return s;
  if (n < 1) n = Math.round(n * 100);
  else n = Math.round(n);
  return n + '%';
}

/**
 * Parse Type column. Supports:
 *   "IH"       → { type: 'indica', isSale: false, isHot: false }
 *   "IH SALE"  → { type: 'indica', isSale: true,  isHot: false }
 *   "SH HOT"   → { type: 'sativa', isSale: false, isHot: true }
 *   "SAT SALE" → { type: 'sativa', isSale: true,  isHot: false }
 */
function detectType_(typeStr) {
  var t = typeStr.trim().toUpperCase();
  var isSale = t.indexOf('SALE') >= 0;
  var isHot = t.indexOf('HOT') >= 0;
  
  // Strip flags to get base type
  var base = t.replace('SALE', '').replace('HOT', '').trim();
  var type = 'hybrid';
  if (base.indexOf('I') === 0 || base.indexOf('INDICA') >= 0) type = 'indica';
  else if (base.indexOf('S') === 0 || base.indexOf('SATIVA') >= 0) type = 'sativa';
  
  return { type: type, isSale: isSale, isHot: isHot };
}


// ── Test Functions ──

/**
 * Quick test: parse email and log results.
 */
function testParseEmail() {
  var result = parseOnhandEmail('ALC01');
  if (result) {
    Logger.log('Date: ' + result.date);
    Logger.log('SKUs: ' + result.skuCount);
    
    // Show first 10
    var skus = Object.keys(result.stock);
    for (var i = 0; i < Math.min(10, skus.length); i++) {
      Logger.log('  SKU ' + skus[i] + ': ' + JSON.stringify(result.stock[skus[i]]));
    }
  }
}

/**
 * Quick test: build full product JSON and log stats.
 */
function testBuildJSON() {
  var stockData = parseOnhandEmail('ALC01');
  var catalog = fetchMasterCatalog_();
  var result = buildProductJSON_(catalog, stockData);
  
  Logger.log('Flowers: ' + result.flowers.length);
  Logger.log('Items: ' + result.items.length);
  
  // Tier breakdown
  var tiers = {};
  for (var i = 0; i < result.flowers.length; i++) {
    var t = result.flowers[i].tier;
    tiers[t] = (tiers[t] || 0) + 1;
  }
  Logger.log('Tiers: ' + JSON.stringify(tiers));
}
