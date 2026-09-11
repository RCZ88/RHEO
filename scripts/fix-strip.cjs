#!/usr/bin/env node
// Fix remaining type annotation remnants in /tmp/main-stripped.ts
const fs = require('fs');
let s = fs.readFileSync('/tmp/main-stripped.ts', 'utf8');

// Fix union type annotations on variable declarations: let x | null = null -> let x = null
s = s.replace(/let (\w+) \| null = null;/g, 'let $1 = null;');
s = s.replace(/let (\w+): '[^']*' \| '[^']*' \| null = null;/g, 'let $1 = null;');
s = s.replace(/let (\w+) \| null = null;/g, 'let $1 = null;');
s = s.replace(/function (\w+)\([^)]*\) \| null \{/g, 'function $1($2) {');

// Fix : type annotations that were missed (function params and returns)
// e.g., detectSleepGap(gapStart, gapEnd) { isSleep; suggestedStart; suggestedEnd; durationMinutes } | null {
// Fix the broken function signature pattern from stripping
s = s.replace(/function detectSleepGap\(gapStart, gapEnd\) \{[^}]*\} \| null \{/s, 'function detectSleepGap(gapStart, gapEnd) {');

// Fix remaining | null patterns
s = s.replace(/let (\w+) \| null;/g, 'let $1;');

// Fix trailing type annotations like `; isSleep; suggestedStart; suggestedEnd; durationMinutes } | null {`
// This is from broken function signature - need to handle specially
s = s.replace(/function (\w+)\([^)]*\) \{[^}]*\} \| null \{/g, 'function $1(');

// Fix remaining :type patterns
s = s.replace(/(\w+): (?:string|number|boolean|void|any|Promise|NodeJS|Electron|ReturnType|unknown)/g, '$1');
s = s.replace(/(\w+): <[^>]+>/g, '$1');
s = s.replace(/\): (?:Promise<[^>]+>|\w+) \{/g, ') {');

// Fix function return types: function name(...): Type { -> function name(...) {
s = s.replace(/function (\w+)\(([^)]*)\): (?:[A-Z]\w*|Promise<[^>]+>|void) \{/g, 'function $1($2) {');

// Fix :type on function params: param: Type -> param
s = s.replace(/(\w+): (?:string|number|boolean|void|any|unknown)/g, '$1');

fs.writeFileSync('/tmp/main-stripped.ts', s);
console.log('Fixed. Length:', s.length);

// Count remaining type annotation artifacts
const issues = s.match(/\| null|:\s*(string|number|boolean|void|any|Promise|NodeJS|Electron|ReturnType|unknown)/g);
console.log('Remaining type artifacts:', issues ? issues.length : 0);
if (issues) issues.forEach(i => console.log('  ', i));
