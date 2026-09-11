import { build } from 'vite';
import { mkdirSync, renameSync, rmSync, statSync, writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'dist-electron');
const mainTemp = resolve(OUT, 'main-temp');
mkdirSync(mainTemp, { recursive: true });

console.log('Building main.cjs (Step 4 only)...');

await build({
  root: ROOT,
  configFile: false,
  build: {
    outDir: mainTemp,
    lib: {
      entry: resolve(ROOT, 'src', 'main.ts'),
      formats: ['cjs'],
      fileName: () => 'main.cjs',
    },
    rollupOptions: {
      external: [
        'electron', 'better-sqlite3', 'active-win', 'node-pty',
        'dotenv', 'ws', 'crypto', 'os', 'path', 'fs', 'child_process',
        'util', 'url', 'stream', 'events', 'net', 'http', 'https',
        'tls', 'zlib', 'assert', 'querystring', 'buffer',
      ],
    },
    minify: false,
    sourcemap: false,
  },
});

const mainCjs = resolve(mainTemp, 'main.cjs');
if (statSync(mainCjs).size > 0) {
  renameSync(mainCjs, resolve(OUT, 'main.cjs'));
  console.log('main.cjs:', (statSync(resolve(OUT, 'main.cjs')).size / 1024).toFixed(0), 'KB');
} else {
  console.error('main.cjs is empty!');
  process.exit(1);
}
rmSync(mainTemp, { recursive: true, force: true });

writeFileSync(resolve(OUT, 'main.js'), 'module.exports = require("./main.cjs");\n');
writeFileSync(resolve(OUT, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');

// Verify patches
const content = readFileSync(resolve(OUT, 'main.cjs'), 'utf-8');
const hasIsQuitting = content.includes('app.isQuitting = true');
const hasTrayDestroy = content.includes('tray.destroy()');
console.log('has isQuitting in Quit menu:', hasIsQuitting);
console.log('has tray.destroy():', hasTrayDestroy);
if (!hasIsQuitting || !hasTrayDestroy) {
  console.error('PATCH MISSING from built main.cjs');
  process.exit(1);
}
console.log('OK patches present');
