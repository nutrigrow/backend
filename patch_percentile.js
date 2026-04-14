const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'children.service.js');
let code = fs.readFileSync(filePath, 'utf8');

const oldLines = [
  '  // Walk from highest to lowest to find the highest bracket the value meets/exceeds',
  '  for (let i = cols.length - 1; i >= 0; i--) {',
  '    const ref = whoRow[cols[i]];',
  '    if (ref !== null && ref !== undefined && value >= ref) {',
  '      if (i === cols.length - 1) return `> ${PERCENTILE_LABELS[i]}`;',
  '      return `${PERCENTILE_LABELS[i]} - ${PERCENTILE_LABELS[i + 1]}`;',
  '    }',
  '  }',
  '  return `< ${PERCENTILE_LABELS[0]}`;',
].join('\n');

const newLines = [
  '  // Walk from highest to lowest to find the highest bracket the value meets/exceeds',
  '  // Returns only the highest percentile label reached (e.g. P50 if P50 <= value < P75)',
  '  for (let i = cols.length - 1; i >= 0; i--) {',
  '    const ref = whoRow[cols[i]];',
  '    if (ref !== null && ref !== undefined && value >= ref) {',
  '      return PERCENTILE_LABELS[i];',
  '    }',
  '  }',
  '  return `< ${PERCENTILE_LABELS[0]}`;',
].join('\n');

if (!code.includes(oldLines)) {
  console.error('Pattern not found — no changes made.');
  process.exit(1);
}

code = code.replace(oldLines, newLines);
fs.writeFileSync(filePath, code, 'utf8');
console.log('Done! findPercentileBracket updated successfully.');
