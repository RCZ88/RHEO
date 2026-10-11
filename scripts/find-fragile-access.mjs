#!/usr/bin/env node
/**
 * find-fragile-access.mjs — a lint for the crash class that has taken this app
 * down repeatedly: GUARDING THE OBJECT BUT NOT ITS FIELDS.
 *
 *   if (!data) return [];      // guards `data`
 *   return data.rows.filter()  // `data.rows` was never checked
 *
 * Real incidents this found, all the same shape:
 *   ArchMapPage   — main returned {success,data:{nodes}} ; renderer stored the
 *                   wrapper, so mapData.nodes was undefined. Page never loaded.
 *   ai-gateway    — `if (!a.success)` on a handler that returned a BARE array on
 *                   success, so "Failed to load providers" showed on success.
 *   ChatTab       — answer.strategy.replace after a successful send.
 *   BackupCenter  — overview?.projects guarded the wrapper, then .find threw.
 *   Analytics     — .then(setStats) with no null check.
 *
 * A promise that resolves to the wrong SHAPE is worse than one that rejects:
 * it reports failure while succeeding, so nothing downstream can recover.
 *
 * Usage:  node scripts/find-fragile-access.mjs [--top N]
 * Exit 0 always — this reports, it does not gate. Numbers here are an UPPER
 * BOUND: `x.f || []` and `!x.f ||` short-circuit forms are only partly
 * detected, so some hits are already safe.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'src';
const SKIP = new Set(['node_modules', 'backups', 'dist', 'dist-electron', '__pycache__']);
const TOP = Number(process.argv.includes('--top') ? process.argv[process.argv.indexOf('--top') + 1] : 30);

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    if (SKIP.has(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e)) files.push(p);
  }
})(ROOT);

const acc = /\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\.(filter|map|find|forEach|reduce|some|every)\s*\(/;
const byFile = new Map();

for (const file of files) {
  let lines;
  try { lines = readFileSync(file, 'utf8').split('\n'); } catch { continue; }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = acc.exec(line);
    if (!m) continue;
    const [, obj, fld] = m;
    if (line.slice(0, m.index).trimEnd().endsWith('?.')) continue;      // already optional
    if (new RegExp(`Array\\.isArray\\([^)]*${fld}`).test(line)) continue; // already guarded
    const win = lines.slice(Math.max(0, i - 10), i).join('\n');
    if (new RegExp(`if\\s*\\(\\s*!\\s*${obj}\\s*\\)`).test(win)) continue;   // object guarded
    if (new RegExp(`(const|let)\\s+${obj}\\s*(:[^=]+)?=\\s*\\[\\]`).test(win)) continue;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push({ line: i + 1, text: line.trim().slice(0, 120) });
  }
}

const total = [...byFile.values()].reduce((n, v) => n + v.length, 0);
console.log(`scanned ${files.length} files`);
console.log(`${total} unguarded-iteration sites across ${byFile.size} files  (UPPER BOUND)\n`);
const ranked = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [file, hits] of ranked.slice(0, TOP)) {
  console.log(`${String(hits.length).padStart(3)}  ${file}`);
  for (const h of hits.slice(0, 4)) console.log(`       ${h.line}: ${h.text}`);
  if (hits.length > 4) console.log(`       ... +${hits.length - 4} more`);
}
