// Strip TypeScript type annotations from main.ts to produce compilable JS
const fs = require('fs');

const content = fs.readFileSync('src/main.ts', 'utf8');
const lines = content.split('\n');

// Find first import/export line (real TS source start)
let tsStart = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('import ') || lines[i].startsWith('export ')) {
    tsStart = i;
    break;
  }
}

// Find last non-empty non-comment line
let tsEnd = lines.length;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim() && !lines[i].trim().startsWith('//')) {
    tsEnd = i + 1;
    break;
  }
}

let tsSource = lines.slice(tsStart, tsEnd).join('\n');

// Remove import type statements
tsSource = tsSource.replace(/import type \{[^}]*\} from ['"][^'"]+['"];?\n?/g, '');

// Remove interface declarations (single-line)
tsSource = tsSource.replace(/interface \w+\s*\{[^}]*\}/g, '');

// Remove type annotations on variables/params
tsSource = tsSource.replace(/:\s*(?:string|number|boolean|void|any|Promise|NodeJS|Electron|ReturnType|unknown)\b/g, '');
tsSource = tsSource.replace(/:\s*<[^>]+>/g, '');

// Remove :type after closing parens before {
tsSource = tsSource.replace(/\):\s*(?:Promise<[^>]+>|\w+)\s*\{/g, '): {');

// Remove type-only import lines
tsSource = tsSource.replace(/import\s+\{[^}]*\}\s+from\s+["'][^"']+["']\s*;?\n?/g, '');

// Remove export type
tsSource = tsSource.replace(/export type \{[^}]*\}/g, '');

// Remove :type from function params
tsSource = tsSource.replace(/(\w+):\s*\w+/g, '$1');

// Remove empty type annotation remnants
tsSource = tsSource.replace(/,\s*:}/g, '}');
tsSource = tsSource.replace(/\):\s*\{/g, ') {');

fs.writeFileSync('/tmp/main-stripped.ts', tsSource);
console.log('Stripped TS source: ' + tsSource.length + ' chars, ' + tsSource.split('\n').length + ' lines');
console.log('Written to /tmp/main-stripped.ts');
