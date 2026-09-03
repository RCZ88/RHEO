import { readFileSync, writeFileSync } from 'fs';
const p = 'src/services/ai/aiAgentService.ts';
const b = readFileSync(p);
const marker = Buffer.from('***', 'utf8');
const idx = b.indexOf(marker);
console.log('idx', idx);
if (idx >= 0) {
  const prefix = b.slice(0, idx);
  const suffix = b.slice(idx + marker.length);
  const replacement = Buffer.from('(typeof ', 'utf8');
  writeFileSync(p, Buffer.concat([prefix, replacement, suffix]));
  console.log('patched marker');
} else {
  console.log('no marker');
}
