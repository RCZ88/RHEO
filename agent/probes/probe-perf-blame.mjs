/**
 * probe-perf-blame.mjs — proves the freeze-attribution arithmetic.
 *
 * Run: node --experimental-strip-types agent/probes/probe-perf-blame.mjs
 *
 * WHY THIS MUST BE PROVEN: attribution is a CLAIM about what caused a freeze.
 * A wrong claim sends a developer to the wrong file with confidence, which is
 * worse than saying "unknown". So the rules that matter are:
 *   - an unattributed freeze returns null, it is never guessed
 *   - the winner is the LARGEST overlap, not the first or the last
 *   - a weak overlap is reported as a weak share rather than dressed up
 */
import { attributeTask, attributeAll, markTotals } from '../../src/shared/perfTypes.ts'

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` — ${detail}`}`)
}

const mark = (label, start, end) => ({ id: label, label, start, end, route: 'dashboard' })

console.log('\n=== an unattributed freeze is reported as unknown, never guessed ===')
check('no marks at all -> null', attributeTask({ t: 1000, durationMs: 400 }, []) === null)
check('a mark somewhere else -> null', attributeTask({ t: 1000, durationMs: 100 }, [mark('other', 5000, 5100)]) === null)
check('a mark that merely abuts the edge -> null (no overlap)', attributeTask({ t: 1000, durationMs: 100 }, [mark('edge', 900, 1000)]) === null)

console.log('\n=== a freeze inside one operation is attributed fully ===')
const one = attributeTask({ t: 1000, durationMs: 400 }, [mark('ipc:getLogs', 900, 1600)])
check('named', one?.label === 'ipc:getLogs', `got ${one?.label}`)
check('overlap covers the whole task', one?.overlapMs === 400, `got ${one?.overlapMs}`)
check('share is 100%', one?.sharePct === 100, `got ${one?.sharePct}`)

console.log('\n=== partial overlap is reported as a PARTIAL share, not rounded up ===')
// task [1000,1400] ∩ mark [1200,1500] = [1200,1400] = 200ms  -> 200/400 = 50%
const partial = attributeTask({ t: 1000, durationMs: 400 }, [mark('ipc:getLogs', 1200, 1500)])
check('overlap is the intersection only (200ms)', partial?.overlapMs === 200, `got ${partial?.overlapMs}`)
check('share is 50%, not 100%', partial?.sharePct === 50, `got ${partial?.sharePct}`)

console.log('\n=== the winner is the LARGEST overlap, not the first or last ===')
const many = attributeTask({ t: 0, durationMs: 1000 }, [
  mark('tiny-a', 0, 50),
  mark('huge', 100, 900),
  mark('tiny-b', 950, 1000),
])
check('the 800ms operation wins', many?.label === 'huge', `got ${many?.label}`)
check('all three are counted as overlapping', many?.overlapping === 3, `got ${many?.overlapping}`)
const later = attributeTask({ t: 0, durationMs: 1000 }, [mark('first-big', 0, 600), mark('second-big', 400, 1000)])
check('ties and ordering do not favour the later mark when it is smaller', later?.label === 'first-big', `got ${later?.label}`)

console.log('\n=== a still-open mark (operation never returned) is still named ===')
const open = attributeTask({ t: 1000, durationMs: 400 }, [{ id: 'x', label: 'never-returns', start: 900, end: null, route: null }])
check('open mark is blamed', open?.label === 'never-returns', `got ${open?.label}`)
check('open mark is bounded by the task, not infinite', open?.overlapMs === 400, `got ${open?.overlapMs}`)

console.log('\n=== degenerate input is refused, not crashed on ===')
check('zero duration -> null', attributeTask({ t: 0, durationMs: 0 }, [mark('x', 0, 100)]) === null)
check('negative duration -> null', attributeTask({ t: 0, durationMs: -50 }, [mark('x', 0, 100)]) === null)
check('NaN task -> null', attributeTask({ t: NaN, durationMs: 100 }, [mark('x', 0, 100)]) === null)
check('an empty mark list is safe', attributeTask({ t: 0, durationMs: 100 }, []) === null)
check('a mark ending before it starts contributes nothing', attributeTask({ t: 0, durationMs: 100 }, [mark('reversed', 90, 10)]) === null)

console.log('\n=== attributeAll pairs every task with its own blame ===')
const tasks = [
  { id: 'a', t: 1000, durationMs: 300, route: 'ide', attribution: 'unknown', containerType: 'window' },
  { id: 'b', t: 5000, durationMs: 100, route: 'life', attribution: 'unknown', containerType: 'window' },
]
const paired = attributeAll(tasks, [mark('ipc:loadProjects', 950, 1400)])
check('every task gets an entry', paired.length === 2)
check('the blamed task names its operation', paired[0].attribution?.label === 'ipc:loadProjects')
check('the unblamed task is explicitly null, not omitted', paired[1].attribution === null)

console.log('\n=== markTotals sums REAL durations and counts calls ===')
const totals = markTotals([
  mark('ipc:getLogs', 0, 300),
  mark('ipc:getLogs', 1000, 1150),
  mark('render:ledger', 2000, 2400),
])
check('getLogs totals 450ms across 2 calls', totals[0].totalMs === 450 && totals[0].calls === 2, JSON.stringify(totals[0]))
check('sorted by time spent, most expensive first', totals[0].label === 'ipc:getLogs' && totals[1].label === 'render:ledger')
check('an open mark contributes 0, not infinity', markTotals([{ id: 'o', label: 'open', start: 100, end: null, route: null }])[0].totalMs === 0)
check('empty input -> empty output', markTotals([]).length === 0)

console.log(failures === 0 ? '\n  ALL PROBES PASS\n' : `\n  ${failures} PROBE FAILURE(S)\n`)
process.exit(failures === 0 ? 0 : 1)