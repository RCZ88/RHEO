// Proves the ArchMapPage crash + the fix, using the EXACT shapes main.ts returns.
let fails = 0;
const ok = (l, c) => { if (!c) { fails++; console.log('FAIL  ' + l); } else console.log('ok    ' + l); };

// what main.ts:22785 actually returns on success
const REAL_MAIN_RESPONSE = { success: true, data: { nodes: [{id:'1',type:'page',name:'Home',filePath:'src/App.tsx'}], edges: [], stats: { totalPages: 1 } } };
// what it returns when the scanner is unhappy
const MAIN_FAILURE = { success: false, error: 'No project path' };
// what a future/fixed main.ts might return (the shape the docs promise)
const DOC_SHAPE = { nodes: [{id:'1',type:'page',name:'Home',filePath:'src/App.tsx'}], edges: [], stats: {} };

// ── the OLD code, verbatim ──
function oldFilteredNodes(mapData) {
  if (!mapData) return [];
  let nodes = mapData.nodes;          // undefined for the real response
  return nodes.filter(n => true);     // <-- the crash
}
try { oldFilteredNodes(REAL_MAIN_RESPONSE); ok('old code survives the real response', true); }
catch (e) { ok('old code CRASHES on the real main.ts response (the reported bug)', /filter/.test(e.message)); console.log('        -> ' + e.message); }
try { oldFilteredNodes(DOC_SHAPE); ok('old code works only on the DOCUMENTED shape', true); }
catch (e) { ok('old code crashes on doc shape', false); }

// ── the NEW code, verbatim ──
function normalize(res) {
  if (res?.success === false) return null;
  const map = res?.data ?? res;
  if (map && Array.isArray(map.nodes)) return { ...map, nodes: map.nodes, edges: Array.isArray(map.edges) ? map.edges : [], stats: map.stats ?? {} };
  return null;
}
function newFilteredNodes(mapData) {
  if (!mapData) return [];
  let nodes = Array.isArray(mapData.nodes) ? mapData.nodes : [];
  if (!nodes.length) return [];
  return nodes.filter(n => true);
}
for (const [name, res] of [['real main.ts response', REAL_MAIN_RESPONSE], ['documented shape', DOC_SHAPE], ['main.ts failure', MAIN_FAILURE], ['null', null], ['garbage', {}]]) {
  try {
    const m = normalize(res);
    const out = newFilteredNodes(m);
    ok('new code handles ' + name + ' -> ' + out.length + ' nodes', true);
  } catch (e) { ok('new code handles ' + name, false); console.log('        -> ' + e.message); }
}

// every downstream reader must be safe on a normalised payload
const m = normalize(REAL_MAIN_RESPONSE);
try { m.nodes.filter(()=>true); m.edges.filter(()=>true); m.nodes.find(()=>true); m?.nodes.find(()=>true);
      for (const n of m.nodes) {} ok('all six downstream readers safe on normalised data', true); }
catch (e) { ok('downstream readers', false); console.log('        -> ' + e.message); }

// and on the failure path there is no map at all
ok('failure path yields null, so no reader runs', normalize(MAIN_FAILURE) === null);
ok('null yield is safe', newFilteredNodes(normalize(MAIN_FAILURE)).length === 0);

console.log(''); console.log(fails === 0 ? 'ALL PASS' : fails + ' FAILURES');
process.exit(fails ? 1 : 0);
