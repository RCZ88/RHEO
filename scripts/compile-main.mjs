import { execSync } from 'child_process';
import { statSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'dist-electron');
const mainCjs = resolve(OUT, 'main.cjs');
const tsFile = resolve(ROOT, 'src', 'main.ts');

const externals = [
  'electron', 'better-sqlite3', 'active-win', 'node-pty',
  'dotenv', 'ws', 'crypto', 'os', 'path', 'fs', 'child_process',
  'util', 'url', 'stream', 'events', 'net', 'http', 'https',
  'tls', 'zlib', 'assert', 'querystring', 'buffer',
];

const cmd = 'npx esbuild "' + tsFile + '" --outfile="' + mainCjs + '" --format=cjs --platform=node --target=node22 --bundle --external:electron --external:better-sqlite3 --external:active-win --external:node-pty --external:dotenv --external:ws --external:crypto --external:os --external:path --external:fs --external:child_process --external:util --external:url --external:stream --external:events --external:net --external:http --external:https --external:tls --external:zlib --external:assert --external:querystring --external:buffer';

console.log('Compiling main.ts → main.cjs...');
try {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', timeout: 180_000, shell: true });
} catch (e) {
  console.error('esbuild failed with exit code:', e.status);
  process.exit(e.status || 1);
}

if (!existsSync(mainCjs)) {
  console.error('main.cjs was not created!');
  process.exit(1);
}
const stat = statSync(mainCjs);
console.log('main.cjs:', (stat.size / 1024).toFixed(0), 'KB');

// Also create main.js shim and package.json
import { writeFileSync } from 'fs';
writeFileSync(resolve(OUT, 'main.js'), 'module.exports = require("./main.cjs");\n');
writeFileSync(resolve(OUT, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');

// Verify patches landed
const content = readFileSync(mainCjs, 'utf-8');
console.log('isQuitting in main.cjs:', content.includes('app.isQuitting = true'));
console.log('tray.destroy in main.cjs:', content.includes('tray.destroy()'));
console.log('DONE');
