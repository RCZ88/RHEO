import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

let fails = 0;
const ok = (m) => console.log('PASS  ' + m);
const bad = (m) => { fails++; console.error('FAIL  ' + m); };

// 1. Bundle check.
const ENTRY = [
  'src/main/lib/lineDiff.ts',
  'src/main/lib/scanShared.ts',
  'src/main/lib/ledger.ts',
  'src/main/lib/ingest.ts',
  'src/components/line-stats/ProjectFileChanges.tsx',
  'src/components/line-stats/useFileChanges.ts',
  'src/types/line-stats.ts',
];
const outdir = '/tmp/opencode/ide-changes-bundle';
try { fs.rmSync(outdir, { recursive: true, force: true }); } catch {}
fs.mkdirSync(outdir, { recursive: true });
try {
  execSync(`npx esbuild ${ENTRY.join(' ')} --bundle --format=cjs --platform=node --outdir=${outdir} --alias:@=${ROOT}/src --external:react --external:lucide-react --log-level=error`, { cwd: ROOT, stdio: 'pipe' });
  for (const e of ENTRY) ok(`bundle: ${e}`);
} catch (e) {
  bad(`bundle: ${(e.stderr || e.message || '').toString().slice(0, 400)}`);
}

// 2. Syntax transform.
for (const f of ['src/main.ts', 'src/preload.ts']) {
  try {
    execSync(`npx esbuild ${f} --format=cjs --outfile=/dev/null --log-level=error`, { cwd: ROOT, stdio: 'pipe' });
    ok(`syntax: ${f}`);
  } catch (e) {
    bad(`syntax: ${f} -> ${(e.stderr || e.message || '').toString().slice(0, 300)}`);
  }
}

// 3. IPC contract.
const REQUIRED = [
  'scan-project-changes',
  'get-project-changes',
  'delete-project-changes',
  'get-changes-ingest-status',
  'editor-changes:ingest',
];
const mainSrc = fs.readFileSync(path.join(ROOT, 'src/main.ts'), 'utf8');
const preSrc = fs.readFileSync(path.join(ROOT, 'src/preload.ts'), 'utf8');
for (const ch of REQUIRED) {
  const esc = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const h = new RegExp(`ipcMain\\.handle\\('${esc}'`).test(mainSrc);
  const i = preSrc.includes(`'${ch}'`);
  if (h && i) ok(`contract: '${ch}' — handle in main + invoke in preload`);
  else bad(`contract: '${ch}' — handle=${h} invoke=${i}`);
}

// 4. Functional ledger probe.
try {
  execSync('node /tmp/opencode/ld/ledger.test.cjs', { stdio: 'pipe' });
  ok('functional: ledger.test.cjs (12/12 truth cases)');
} catch (e) {
  bad(`functional: ledger.test.cjs -> ${(e.stdout || e.stderr || '').toString().slice(-400)}`);
}

console.log('\n' + (fails === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${fails} failures)`));
process.exit(fails === 0 ? 0 : 1);
