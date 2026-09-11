import { execSync } from 'child_process';
import { statSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd();
const OUT = resolve(ROOT, 'dist-electron');
const mainCjs = resolve(OUT, 'main.cjs');

// Remove stale main.cjs if it exists
if (existsSync(mainCjs)) {
  try { require('fs').unlinkSync(mainCjs); } catch {}
}

const externals = [
  '--external:electron', '--external:better-sqlite3', '--external:active-win',
  '--external:node-pty', '--external:dotenv', '--external:ws', '--external:crypto',
  '--external:os', '--external:path', '--external:fs', '--external:child_process',
  '--external:util', '--external:url', '--external:stream', '--external:events',
  '--external:net', '--external:http', '--external:https', '--external:tls',
  '--external:zlib', '--external:assert', '--external:querystring', '--external:buffer',
];

const cmd = `npx esbuild src/main.ts --outfile=dist-electron/main.cjs --format=cjs --platform=node --target=node22 --bundle ${externals.join(' ')}`;

console.log('Compiling main.cjs...');
try {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', timeout: 300000, shell: true });
} catch (e) {
  console.error('esbuild failed, exit code:', e.status);
  process.exit(e.status || 1);
}

if (!existsSync(mainCjs)) {
  console.error('main.cjs was not created!');
  process.exit(1);
}
const stat = statSync(mainCjs);
console.log('main.cjs:', (stat.size / 1024).toFixed(0), 'KB');

// Create shims
writeFileSync(resolve(OUT, 'main.js'), 'module.exports = require("./main.cjs");\n');
writeFileSync(resolve(OUT, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');

// Verify patches
const content = require('fs').readFileSync(mainCjs, 'utf8');
const hasIsQuitting = content.includes('app.isQuitting = true');
const hasTrayDestroy = content.includes('tray.destroy()');
console.log('isQuitting in main.cjs:', hasIsQuitting);
console.log('tray.destroy in main.cjs:', hasTrayDestroy);
if (!hasIsQuitting || !hasTrayDestroy) {
  console.error('PATCH MISSING');
  process.exit(1);
}
console.log('BUILD OK - patches verified');
