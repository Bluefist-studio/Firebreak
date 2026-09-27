const fs = require('fs');
const file = 'src/ui/TopStatusHUD.js';
let src = fs.readFileSync(file, 'utf8');
const NL = '\r\n';

// Update the STARVING block
const oldStarving = [
  '        ctx.font = `bold ${Math.max(12, Math.round(16 * scale))}px Arial`;',
  '        ctx.textAlign = "center";',
  '        ctx.fillText(`\\u26a0 CREW STARVING \\u2014 Cooldowns +${fedPenalty}s (Feed: ${eco.crewFedStatus}%)`, centerX, warningY + Math.round(10 * scale));',
].join(NL);

const newStarving = [
  '        ctx.font = `bold ${Math.max(11, Math.round(13 * scale))}px Arial`;',
  '        ctx.textAlign = "left";',
  '        ctx.fillText(`\\u26a0 STARVING +${fedPenalty}s`, resPanelX, warningY + Math.round(8 * scale));',
].join(NL);

if (src.includes(oldStarving)) {
  src = src.replace(oldStarving, newStarving);
  console.log('STARVING block replaced OK');
} else {
  console.log('STARVING block NOT found!');
  const i = src.indexOf('CREW STARVING');
  if (i >= 0) console.log(JSON.stringify(src.slice(i - 130, i + 50)));
}

// Update the Underfed block
const oldUnderfed = [
  '        ctx.font = `bold ${Math.max(11, Math.round(14 * scale))}px Arial`;',
  '        ctx.textAlign = "center";',
  '        ctx.fillText(`\\u26a0 Crew Underfed \\u2014 Cooldowns +${fedPenalty}s (Feed: ${eco.crewFedStatus}%)`, centerX, warningY + Math.round(10 * scale));',
].join(NL);

const newUnderfed = [
  '        ctx.font = `bold ${Math.max(10, Math.round(12 * scale))}px Arial`;',
  '        ctx.textAlign = "left";',
  '        ctx.fillText(`\\u26a0 Underfed +${fedPenalty}s`, resPanelX, warningY + Math.round(8 * scale));',
].join(NL);

if (src.includes(oldUnderfed)) {
  src = src.replace(oldUnderfed, newUnderfed);
  console.log('Underfed block replaced OK');
} else {
  console.log('Underfed block NOT found!');
  const i = src.indexOf('Crew Underfed');
  if (i >= 0) console.log(JSON.stringify(src.slice(i - 130, i + 50)));
}

fs.writeFileSync(file, src, 'utf8');
console.log('Done.');
