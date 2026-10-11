// Probe: classify all 140 REAL tool names from this machine + real arg shapes.
// Run: node tool-coverage-probe.cjs
const A = require('/tmp/opencode/wf-out/shared/workforceActivity.js');
const R = require('/tmp/opencode/tool-registry.json');

let fails = 0;
function ok(label, cond, extra) {
  if (!cond) { fails++; console.log('FAIL  ' + label + (extra ? '  ' + extra : '')); }
}

// ── 1. every real builtin classifies to a real kind ───────────────────────
const EXPECT = {
  bash: 'command',   // with no command it stays generic; command table asserted below
  edit: 'edit',
  write: 'edit',
  glob: 'search',
  grep: 'search',
  read: 'read',
  skill: 'read',
  question: 'blocked',
  task: 'delegate',
  todowrite: 'plan',
  webfetch: 'web',
  websearch: 'web',
  invalid: 'unknown',
  list_mcp_resources: 'mcp',
  list_mcp_resource_templates: 'mcp',
  read_mcp_resource: 'mcp',
};
console.log('--- verified builtin tools ---');
for (const t of R.builtin) {
  const got = A.classifyAction({ tool: t });
  ok('builtin ' + t + ' -> ' + EXPECT[t], got === EXPECT[t], 'got=' + got);
  if (EXPECT[t] !== null) console.log('  ok  ' + t.padEnd(30) + ' -> ' + got);
}

console.log('\n--- bash resolves via its command, not the tool name ---');
const bashCases = [
  ['npm run build', 'build'], ['vitest run', 'test'], ['npm test', 'test'],
  ['tsc --noEmit', 'lint'], ['npx eslint .', 'lint'], ['npm ci', 'install'],
  ['prisma migrate dev', 'database'], ['docker compose up -d', 'container'],
  ['git commit -m x', 'commit'], ['git switch -c f', 'branch'],
  ['git mv a b', 'move'], ['rm -rf x', 'delete'],
  ['git push origin main', 'remote'], ['npm run dev', 'serve'],
  ['curl https://x.dev', 'web'], ['zzz --flag', 'run'],
];
for (const [cmd, want] of bashCases) {
  const got = A.classifyAction({ tool: 'bash', command: cmd });
  ok('bash "' + cmd + '" -> ' + want, got === want, 'got=' + got);
  console.log('  ok  bash ' + cmd.padEnd(24) + ' -> ' + got);
}

console.log('\n--- every MCP tool in the registry (124) classifies as mcp ---');
let mcpOk = 0;
for (const t of R.mcpNames) {
  if (A.classifyAction({ tool: t }) === 'mcp') mcpOk++;
  else { fails++; console.log('  FAIL not-mcp: ' + t); }
}
console.log('  ' + mcpOk + '/' + R.mcpNames.length + ' MCP tool names -> mcp');

console.log('\n--- an MCP server installed later still works (fallback) ---');
ok('brand new server', A.classifyAction({ tool: 'my-new-server_do_thing' }) === 'mcp');
ok('namespaced form', A.classifyAction({ tool: 'mcp__linear__create_issue' }) === 'mcp');
ok('hyphen+underscore server', A.classifyAction({ tool: 'shadcn-ui-mcp_get_component' }) === 'mcp');
ok('both shadcn servers distinct',
   A.isMcpTool('shadcn_get_component') && A.isMcpTool('shadcn-ui-mcp_get_component'));

console.log('\n--- prose is never a tool ---');
for (const p of ['Note', 'Warning', 'Error', 'Result', 'Output', 'Status', 'Summary']) {
  ok('prose ' + p + '()', A.classifyAction({ tool: p + '(x)' }) === null);
}

console.log('\n--- totals ---');
console.log('builtin: ' + R.builtin.length + '  mcp: ' + R.mcpNames.length +
            '  total classified: ' + (R.builtin.length + mcpNamesCovered(R)) );
function mcpNamesCovered(reg) { return mcpOk; }

console.log('');
console.log(fails === 0 ? 'ALL PASS' : fails + ' FAILURES');
process.exit(fails === 0 ? 0 : 1);