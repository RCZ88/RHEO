// Exercises the REAL patterns from src/main.ts against a REAL temp directory.
const fs = require('fs'), path = require('path'), os = require('os');
const BACKUP_RE = /(\.bak($|[-._\d])|\.backup($|[-._\d])|\.orig($|[-._])|\.rej$|\.old$|\.save$|\.sw[op]$|~$|^#.*#$|^\.#|\.(tmp|temp|copy|disabled)$)/i;
const DIGIT_RE = /^(.*?)(\d+)\.[A-Za-z0-9]+$/;

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-walk-'));
const mk = (rel, content) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, content); };
mk('src/main.ts', 'a\nb\nc\n');
mk('src/preload.ts', 'a\nb\n');
mk('src/preload2.ts', 'a\nb\n');           // digit copy of preload.ts
mk('src/lib/base64.ts', 'a\n');             // legitimately digit-suffixed, NOT a copy
mk('src/main.ts.bak', 'x\nx\nx\nx\nx\n');  // backup
mk('src/main.ts.bak-20261005', 'x\n');
mk('src/db.ts.backup', 'x\n');
mk('src/useX.ts.orig', 'x\n');
mk('src/a.ts.orig.txt', 'x\n');            // the case the old regex missed
mk('src/thing.ts~', 'x\n');
mk('node_modules/pkg/index.ts', 'x\n'.repeat(500));
mk('dist/bundle.js', 'x\n'.repeat(500));

let fails = 0;
const ok = (l,c,e) => { if(!c){fails++;console.log('FAIL  '+l+(e?'  '+e:''));} else console.log('ok    '+l); };

// replicate walkAndCount
const IGNORE = new Set(['node_modules','dist','.git']);
const seen = new Set(), stems = new Set();
const keyFor = p => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const rows = [];
const cands = [];
function walk(dir, depth=0) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!IGNORE.has(e.name)) walk(full, depth+1); }
    else {
      if (BACKUP_RE.test(e.name)) continue;
      if (!/\.(ts|tsx)$/i.test(e.name)) continue;
      const key = keyFor(full);
      if (seen.has(key)) continue;
      seen.add(key);
      cands.push({full, key, name: e.name});
    }
  }
}
walk(root);
// PASS 2 — mirrors main.ts exactly
for (const c of cands) {
  const dc = c.name.match(DIGIT_RE);
  if (dc && dc[1]) {
    const twinName = (dc[1] + c.name.slice(c.name.lastIndexOf('.'))).toLowerCase();
    const twinExists = cands.some(o => o !== c && o.name.toLowerCase() === twinName);
    if (twinExists) continue;
  }
  rows.push(path.relative(root, c.full));
}
console.log('kept: ' + JSON.stringify(rows.sort()) + '\n');

ok('real source kept', rows.includes('src/main.ts'));
ok('preload kept', rows.includes('src/preload.ts'));
ok('digit copy preload2.ts dropped', !rows.includes('src/preload2.ts'));
ok('legit base64.ts KEPT (not a copy)', rows.includes('src/lib/base64.ts'), rows.join(','));
for (const b of ['src/main.ts.bak','src/main.ts.bak-20261005','src/db.ts.backup','src/useX.ts.orig','src/a.ts.orig.txt','src/thing.ts~'])
  ok('backup excluded: ' + b, !rows.includes(b));
ok('node_modules excluded', !rows.some(r => r.startsWith('node_modules')));
ok('dist excluded', !rows.some(r => r.startsWith('dist')));
ok('each file exactly once', new Set(rows).size === rows.length);

// the old double-suffix regex, to prove the regression it caused
const OLD = /\.(?:bak|orig|backup)(?:[-._]\w+)+\.\w+$/i;
ok('OLD regex did NOT catch a.ts.orig.txt, i.e. it leaked', !OLD.test('a.ts.orig.txt'));
ok('NEW regex catches it', BACKUP_RE.test('a.ts.orig.txt'));

// dedupe across spellings
const alt = path.join(root, 'src/./lib/../main.ts');
ok('alternate spelling resolves to the same key', keyFor(alt) === keyFor(path.join(root,'src/main.ts')));
ok('and is seen as a dup', seen.has(keyFor(alt)));

fs.rmSync(root, {recursive:true, force:true});
console.log(''); console.log(fails === 0 ? 'ALL PASS' : fails + ' FAILURES');
process.exit(fails ? 1 : 0);
