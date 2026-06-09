const fs = require('fs');
const path = require('path');
const glob = require('path');

// Find all CSS files recursively
function findCss(dir) {
  let results = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory() && f.name !== 'node_modules' && f.name !== '.next') {
      results = results.concat(findCss(full));
    } else if (f.name.endsWith('.css') && f.name !== 'globals.css') {
      results.push(full);
    }
  }
  return results;
}

const replacements = [
  // CSS variable renames
  ['var(--neon-cyan)', 'var(--green-mid)'],
  ['var(--neon-blue)', 'var(--green-light)'],
  ['var(--neon-purple)', 'var(--green-pale)'],
  ['var(--fire-orange)', 'var(--hot-orange)'],
  ['var(--fire-amber)', 'var(--green-light)'],
  ['var(--fire-red)', 'var(--sale-red)'],
  ['var(--fire-gradient)', 'var(--green-gradient)'],
  ['var(--neon-gradient)', 'var(--green-gradient)'],
  ['var(--shadow-glow-cyan)', 'var(--shadow-glow-green)'],
  ['var(--shadow-glow-fire)', 'var(--shadow-glow-green)'],
  
  // Hardcoded dark bg colors → light
  ['#0a0f1e', '#f8faf9'],
  ['#030712', '#ffffff'],
  
  // Hardcoded neon/fire rgba → green rgba
  ['rgba(34, 211, 238', 'rgba(45, 106, 79'],
  ['rgba(249, 115, 22', 'rgba(45, 106, 79'],
  ['rgba(167, 139, 250', 'rgba(82, 183, 136'],
  ['rgba(139, 92, 246', 'rgba(124, 58, 237'],
  
  // Hardcoded hex colors
  ['#22d3ee', '#40916C'],
  ['#38bdf8', '#52B788'],
  ['#a78bfa', '#95D5B2'],
  ['#f97316', '#2D6A4F'],
  ['#fbbf24', '#40916C'],
  ['#f43f5e', '#DC2626'],
  
  // Dark card/surface rgba → light
  ['rgba(15, 23, 42', 'rgba(248, 250, 249'],
  ['rgba(22, 33, 62', 'rgba(240, 245, 242'],
  ['rgba(51, 65, 85', 'rgba(0, 0, 0'],
  
  // Text: white → dark (but be careful, only in color: context)
  ['color: white', 'color: var(--text-primary)'],
  ['color: #f0f9ff', 'color: var(--text-primary)'],
  ['color: #c4b5fd', 'color: #7C3AED'],
  ['color: #fde68a', 'color: #B45309'],
  ['color: #67e8f9', 'color: #2D6A4F'],
];

const appDir = path.join(__dirname, '..', 'app');
const files = findCss(appDir);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;
  
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Updated:', path.relative(appDir, file));
  }
}

console.log('Done! Updated', files.length, 'CSS files checked');
