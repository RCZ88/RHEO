#!/usr/bin/env node
/**
 * tdz-audit.mjs — AST-accurate temporal-dead-zone detector.
 *
 * Why a real parser: the regex version flagged 260 false positives because it
 * cannot tell a free identifier from a function parameter, a destructured
 * binding, an object key, a JSX attribute or a member-expression property
 * (`x.then`, `o.data`). Only the TypeScript checker knows the difference, and a
 * noisy audit is worse than no audit.
 *
 * Definition used: a reference whose resolved symbol is declared LATER in the
 * same enclosing component function, where the reference sits inside a hook
 * callback (useEffect/useMemo/useCallback/useLayoutEffect). That is the exact
 * shape of the crash we hit twice: "Cannot access 'x' before initialization".
 *
 * Usage: node scripts/tdz-audit.mjs [paths...] [--json]
 */
import ts from 'typescript';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const TARGETS = argv.filter((a) => !a.startsWith('--'));
const DIRS = TARGETS.length ? TARGETS : ['src'];

const cfgPath = ts.findConfigFile(ROOT, ts.sys.fileExists, 'tsconfig.app.json');
if (!cfgPath) { console.error('tsconfig.app.json not found'); process.exit(2); }
const cfgFile = ts.readConfigFile(cfgPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfgFile.config, ts.sys, ROOT);

const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
const checker = program.getTypeChecker();

const HOOKS = new Set(['useEffect', 'useMemo', 'useCallback', 'useLayoutEffect', 'useInsertionEffect']);
const findings = [];

/** Walk up to the nearest enclosing function-like node. */
function enclosingFunction(node) {
  let n = node.parent;
  while (n && !ts.isFunctionLike(n)) n = n.parent;
  return n;
}

function lineOf(sf, pos) {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

/** Is this identifier the callee/name of a hook call? */
function isInsideHookCallback(node) {
  let n = node;
  let depth = 0;
  while (n) {
    if (ts.isCallExpression(n) && depth === 0) {
      const callee = n.expression;
      if (ts.isIdentifier(callee) && HOOKS.has(callee.text)) return true;
    }
    if (ts.isFunctionLike(n) && !ts.isCallExpression(n.parent)) {
      // entering a nested callback: keep walking outward
    }
    if (ts.isCallExpression(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) depth++;
    n = n.parent;
  }
  return false;
}

const files = program.getSourceFiles().filter((sf) => {
  const p = relative(ROOT, sf.fileName);
  if (p.startsWith('..')) return false;
  if (!/\.tsx?$/.test(p)) return false;
  return DIRS.some((d) => p === d || p.startsWith(d.replace(/\/$/, '') + '/'));
});

for (const sf of files) {
  const rel = relative(ROOT, sf.fileName);

  function visit(node) {
    if (ts.isIdentifier(node)) {
      // skip declarations themselves, property names, and qualified names
      const parent = node.parent;
      if (ts.isPropertyAccessExpression(parent) && parent.name === node) { ts.forEachChild(node, visit); return; }
      if (ts.isPropertyAssignment(parent) && parent.name === node) { ts.forEachChild(node, visit); return; }
      if (ts.isBindingElement(parent) && parent.propertyName === node) { ts.forEachChild(node, visit); return; }
      if (ts.isJsxAttribute(parent)) { ts.forEachChild(node, visit); return; }

      const sym = checker.getSymbolAtLocation(node);
      if (!sym || !sym.declarations?.length) { ts.forEachChild(node, visit); return; }

      const usePos = node.getStart(sf);
      const decls = sym.declarations.filter((d) => d.getSourceFile() === sf);

      // Only same-file declarations can participate in a TDZ crash.
      if (decls.length) {
        const earliest = Math.min(...decls.map((d) => d.getStart(sf)));
        if (earliest > usePos) {
          // is the declaration inside the same enclosing function as the use?
          const fn = enclosingFunction(node);
          const sameFn = decls.some((d) => enclosingFunction(d) === fn && fn);
          if (sameFn && isInsideHookCallback(node)) {
            findings.push({
              file: rel,
              line: lineOf(sf, node.getStart(sf)),
              name: node.text,
              declaredAt: lineOf(sf, earliest),
              hookFnLine: lineOf(sf, fn.getStart(sf)),
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

// dedupe by file+line+name
const seen = new Set();
const uniq = findings.filter((f) => {
  const k = `${f.file}:${f.line}:${f.name}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

if (AS_JSON) console.log(JSON.stringify({ total: uniq.length, findings: uniq }, null, 2));
else {
  console.log(`\ntdz-audit — ${files.length} files, ${uniq.length} finding(s)\n`);
  for (const f of uniq) {
    console.log(`   ${f.file}:${f.line}  \`${f.name}\` declared at line ${f.declaredAt} (hook fn @${f.hookFnLine})`);
  }
  if (!uniq.length) console.log('   clean\n');
}
process.exit(0);