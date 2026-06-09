const fs = require('fs');
const path = require('path');

/* ── Read CSV files ── */
const flowersPath = path.join(__dirname, '..', '..', 'SETB Anti v2.3 6G MENU - FLOWERS_LIVE.csv');
const itemsPath = path.join(__dirname, '..', '..', 'SETB Anti v2.3 6G MENU - ITEMS_LIVE.csv');

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  const headers = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    vals.push(current.trim());
    const obj = {};
    headers.forEach((h, idx) => { obj[h.trim()] = vals[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

function cleanPrice(p) {
  if (!p) return null;
  const cleaned = p.replace(/\$/g, '').trim();
  if (!cleaned) return null;
  if (cleaned.includes('|')) {
    const [reg, sale] = cleaned.split('|').map(v => parseFloat(v));
    return { regular: reg, sale: sale };
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : { regular: num, sale: null };
}

function makeSlug(name) {
  return name.toLowerCase()
    .replace(/[✨🔥💎⚡]/g, '')
    .replace(/\*+/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

function parseType(type) {
  const t = (type || '').toUpperCase().trim();
  let strain = 'hybrid';
  if (t.startsWith('SH') || t.includes('SATIVA') || t.includes('STV')) strain = 'sativa';
  else if (t.startsWith('IH') || t.includes('INDICA')) strain = 'indica';

  const isHot = t.includes('HOT');
  const isSale = t.includes('SALE');

  return { strain, isHot, isSale };
}

/* ── Process Flowers ── */
console.log('Reading flowers...');
const flowersRaw = fs.readFileSync(flowersPath, 'utf8');
const flowersCSV = parseCSV(flowersRaw);

const flowers = flowersCSV.map(row => {
  const typeInfo = parseType(row.Type);
  const name = (row.Strain || '').trim();
  return {
    sku: row.SKU,
    name: name,
    slug: makeSlug(name),
    tier: (row.Tier || '').trim().toUpperCase(),
    type: typeInfo.strain,
    isHot: typeInfo.isHot,
    isSale: typeInfo.isSale,
    thc: (row.THC || '').replace(/%%/g, '%'),
    price3g: cleanPrice(row.Price_3G),
    price5g: cleanPrice(row.Price_5G),
    price14g: cleanPrice(row.Price_14G),
    price28g: cleanPrice(row.Price_28G),
    image: (row.ImageURL || '').trim(),
    promoImage: (row.PPromo || '').trim() || null,
  };
}).filter(f => f.name && f.sku);

/* ── Process Items ── */
console.log('Reading items...');
const itemsRaw = fs.readFileSync(itemsPath, 'utf8');
const itemsCSV = parseCSV(itemsRaw);

const items = itemsCSV.map(row => {
  const name = (row.Name || '').trim();
  return {
    sku: (row.SKU || '').trim(),
    name: name,
    slug: makeSlug(name),
    category: (row.Category || '').trim().toUpperCase(),
    type: (row.Type || '').trim(),
    thc: (row.THC || '').trim(),
    mg: (row.MG || '').trim(),
    price: (row.Price_EACH || '').trim(),
    image: (row.ImageURL || '').trim(),
    promoImage: (row.PPromoimageurl || '').trim() || null,
  };
}).filter(i => i.name && i.sku);

/* ── Write output ── */
const outputDir = path.join(__dirname, '..', 'app', 'lib');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(path.join(outputDir, 'flowers.json'), JSON.stringify(flowers, null, 2));
fs.writeFileSync(path.join(outputDir, 'items.json'), JSON.stringify(items, null, 2));

/* ── Stats ── */
const tierCounts = {};
flowers.forEach(f => { tierCounts[f.tier] = (tierCounts[f.tier] || 0) + 1; });

const catCounts = {};
items.forEach(i => { catCounts[i.category] = (catCounts[i.category] || 0) + 1; });

console.log(`\n✅ Generated ${flowers.length} flowers:`);
Object.entries(tierCounts).sort().forEach(([t, c]) => console.log(`   ${t}: ${c}`));
console.log(`\n✅ Generated ${items.length} items:`);
Object.entries(catCounts).sort().forEach(([c, n]) => console.log(`   ${c}: ${n}`));
console.log('\nFiles written to app/lib/');
