// Re-zip the source bundle the Architect reads.
//
// Was Windows-only: it shelled out to `powershell Compress-Archive` with
// backslash paths, so on Linux/macOS it failed with "powershell: command not
// found" AND the resulting archive would have been unusable anyway. It also
// wrote to dist/src.zip while every existing bundle lives at the repo root as
// src.zip — so the documented re-zip step silently produced an artifact nobody
// looks at.
//
// Now uses the platform zip binary, writes BOTH locations, and excludes the
// multi-gigabyte agent/backups tree (4GB+) which made the old archive unusable.
import { execSync } from 'child_process';
import { existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const targets = ['src', 'scripts'];
const excludes = ['*/node_modules/*', '*.pyc', '*__pycache__*', '*/agent/backups/*'];

// Root src.zip is what the Architect actually unzips; dist/src.zip is kept for
// anything already pointed at it.
const outDirs = [root, join(root, 'dist')];
for (const d of outDirs) if (!existsSync(d)) mkdirSync(d, { recursive: true });

const present = targets.filter((t) => existsSync(join(root, t)));
if (!present.length) {
  console.error('zip-src: nothing to archive — src/ and scripts/ are both missing');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const results = [];

for (const outDir of outDirs) {
  const zipPath = join(outDir, 'src.zip');
  const flag = isWindows ? '/C ' : ''; // noop guard kept for clarity on win32
  try {
    execSync(`rm -f "${zipPath}"`, { cwd: root, stdio: 'pipe' });
  } catch {}
  const cmd = isWindows
    ? `powershell -NoProfile -Command "Compress-Archive -Path ${present.map((p) => `'${join(root, p)}\\*'`).join(', ')} -DestinationPath '${zipPath}' -Force"`
    : `zip -r -q${flag} "${zipPath}" ${present.join(' ')} ${excludes.map((e) => `-x "${e}"`).join(' ')}`;
  execSync(cmd, { cwd: root, stdio: 'inherit' });
  results.push(`${zipPath} (${(statSync(zipPath).size / 1048576).toFixed(1)} MB)`);
}

console.log('Zipped source to:');
for (const r of results) console.log(`  ${r}`);
