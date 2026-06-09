const fs = require('fs');
const games = ['snake-munchies', 'brick-breaker', 'memory-match', '2048-strains'];
for (const g of games) {
  const p = 'app/games/' + g + '/page.tsx';
  let c = fs.readFileSync(p, 'utf8');
  
  // Add imports after existing imports
  if (!c.includes('import Navbar')) {
    c = c.replace(
      '"use client";',
      '"use client";\n\n// Nav/Footer/ScreenLock'
    );
    // Find the last import line and add after it
    const lines = c.split('\n');
    let lastImportIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImportIdx = i;
    }
    lines.splice(lastImportIdx + 1, 0,
      'import Navbar from "../../components/Navbar";',
      'import Footer from "../../components/Footer";',
      'import ScreenLock from "../../components/ScreenLock";'
    );
    c = lines.join('\n');
  }
  
  // Replace inline nav block
  c = c.replace(
    /\s*<nav style=\{\{[^]*?<\/nav>/,
    '\n      <Navbar />\n      <ScreenLock />'
  );
  
  // Add Footer before </main>
  if (!c.includes('<Footer />')) {
    c = c.replace('</main>', '      <Footer />\n    </main>');
  }
  
  // Remove the comment we added
  c = c.replace('\n\n// Nav/Footer/ScreenLock', '');
  
  fs.writeFileSync(p, c);
  console.log('Fixed: ' + g);
}
