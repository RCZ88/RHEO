import { execSync } from 'child_process';
import { statSync } from 'fs';
import { resolve } from 'path';

const tsFile = resolve(import.meta.dirname, '..', 'src', 'main.ts');
const outFile = resolve(import.meta.dirname, '..', 'dist-electron', 'main.cjs');

console.log('Compiling main.ts → main.cjs via esbuild ...');

const cmd = [
  'npx esbuild',
  `"${tsFile}"`,
  '--outfile=' + `"${outFile}"`,
  '--format=cjs',
  '--platform=node',
  '--target=node22',
  '--bundle',            // required when using --external
  '--external:electron',
  '--external:better-sqlite3',
  '--external:active-win',
  '--external:node-pty',
  '--external:dotenv',
  '--external:ws',
  '--external:crypto',
  '--external:os',
  '--external:path',
  '--external:fs',
  '--external:child_process',
  '--external:util',
  '--external:url',
  '--external:stream',
  '--external:events',
  '--external:net',
  '--external:http',
  '--external:https',
  '--external:tls',
  '--external:zlib',
  '--external:assert',
  '--external:querystring',
  '--external:buffer',
].join(' ');

try {
  execSync(cmd, {
    cwd: resolve(import.meta.dirname, '..'),
    stdio: 'inherit',
    timeout: 120_000,
    shell: true,
  });
} catch (e) {
  console.error('esbuild failed:', e.status || e.message);
  process.exit(e.status || 1);
}

const stat = statSync(outFile);
console.log(`main.cjs: ${(stat.size / 1024).toFixed(0)} KB, modified ${new Date(stat.mtime).toISOString()}`);

// Quick verification that the file is valid JS
const content = outFile;  // placeholder
console.log('Compiled OK');
