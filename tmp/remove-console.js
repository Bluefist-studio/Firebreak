const fs = require('fs');
const path = require('path');
const dir = path.join('src','modes');
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const p = path.join(dir, file);
  const text = fs.readFileSync(p, 'utf8');
  const updated = text.replace(/^\s*console\.(?:log|warn|error|debug)\(.*\)\s*;?\s*$/gm, '');
  fs.writeFileSync(p, updated, 'utf8');
  console.log(`Cleaned: ${p}`);
}
