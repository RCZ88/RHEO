/**
 * Feature 2. The single most important assertion in this file is the FIRST one:
 * the OLD parser accepted prose for single-key payloads, so "never apply
 * silently" was impossible with it.
 */
import { preparePlanReply, extractJsonBlock, validateTrainingPlan, buildRepairPrompt, diffTrainingPlan, PLAN_SCHEMA_VERSION, PATTERN_VOCABULARY } from '../shared/aiPlanSchema';

const good = JSON.stringify({
  schemaVersion: PLAN_SCHEMA_VERSION,
  tasks: [{ title: 'Two pointers set', dueInDays: 1, priority: 'high', pattern: 'two-pointers' }],
  outcomes: [{ kind: 'problem_solved', title: 'Prefix Sum', count: 2, cold: true, pattern: 'arrays' }],
  deadlineMoves: [{ title: 'Problem set 3', shiftDays: 2 }],
});

describe('aiPlan — it REJECTS what the old parser accepted', () => {
  it('prose with no JSON is an error, NOT a successful value', () => {
    const r = preparePlanReply('Sure! I added three tasks for you and moved the deadline.');
    expect(r.report.ok).toBe(false);
    expect(r.diff).toBeNull();
  });
  it('the failure produces a repair prompt, not a dead end', () => {
    expect(preparePlanReply('looks good to me!').repairPrompt.length).toBeGreaterThan(40);
  });
});

describe('aiPlan — extraction is brace-matched, not greedy', () => {
  it('reads JSON out of surrounding prose', () => {
    expect(extractJsonBlock(`Here you go:\n${good}\nHope that helps.`)).toContain('tasks');
  });
  it('strips a json fence', () => {
    expect(extractJsonBlock('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('does NOT swallow a trailing sentence after a nested object', () => {
    const raw = '{"tasks":[{"title":"a"}]} — that is the plan.';
    expect(extractJsonBlock(raw)).toBe('{"tasks":[{"title":"a"}]}');
  });
  it('handles braces inside strings', () => {
    expect(extractJsonBlock('{"title":"a } b"}')).toBe('{"title":"a } b"}');
  });
  it('returns null when there is genuinely no object', () => {
    expect(extractJsonBlock('no json here at all')).toBeNull();
  });
});

describe('aiPlan — validation reports ADDRESSABLE paths', () => {
  it('a near-miss pattern is REJECTED, never passed through', () => {
    // "hashmap" vs "hash-map" must not become two spaced-repetition queues.
    const r = validateTrainingPlan({ tasks: [{ title: 'x', dueInDays: 1, priority: 'high', pattern: 'hashmap' }] });
    expect(r.ok).toBe(false);
    expect(r.issues[0].path).toBe('tasks[0].pattern');
    expect(r.issues[0].expected).toContain('hash-map');
  });
  it('a known pattern passes through untouched', () => {
    const r = validateTrainingPlan({ tasks: [{ title: 'x', dueInDays: 1, priority: 'high', pattern: 'hash-map' }] });
    expect(r.ok).toBe(true);
    expect(r.plan!.tasks[0].pattern).toBe('hash-map');
  });
  it('tasks must be an array — and says so with the path', () => {
    const r = validateTrainingPlan({ tasks: { nope: 1 } });
    expect(r.ok).toBe(false);
    expect(r.issues[0].path).toBe('tasks');
  });
  it('an unknown schema version is rejected', () => {
    const r = validateTrainingPlan({ schemaVersion: 'something-else' });
    expect(r.ok).toBe(false);
    expect(r.issues[0].path).toBe('schemaVersion');
  });
  it('a non-object reply is rejected with a usable message', () => {
    expect(validateTrainingPlan('just a string').ok).toBe(false);
    expect(validateTrainingPlan([1, 2, 3]).ok).toBe(false);
    expect(validateTrainingPlan(null).ok).toBe(false);
  });
  it('malformed JSON names the parse error', () => {
    const r = preparePlanReply('{ tasks: [ }');
    expect(r.report.ok).toBe(false);
    expect(r.repairPrompt.toLowerCase()).toContain('malformed');
  });
});

describe('aiPlan — absence is legal, so the model is not forced to invent', () => {
  it('an empty object is a VALID plan meaning "nothing to do"', () => {
    const r = validateTrainingPlan({});
    expect(r.ok).toBe(true);
    expect(r.plan!.tasks).toEqual([]);
  });
  it('and it diffs to "nothing to apply"', () => {
    const r = preparePlanReply('{}');
    expect(r.diff?.empty).toBe(true);
    expect(r.diff?.summary).toContain('Nothing to apply');
  });
});

describe('aiPlan — the diff is reviewable in under a second', () => {
  it('says exactly what CZ asked for: adds N, moves M', () => {
    const d = preparePlanReply(good).diff!;
    expect(d.summary).toContain('adds 1 task');
    expect(d.summary).toContain('moves 1 deadline');
    expect(d.empty).toBe(false);
  });
  it('pluralises correctly', () => {
    const many = JSON.stringify({ tasks: [{ title: 'a' }, { title: 'b' }], outcomes: [], deadlineMoves: [] });
    expect(preparePlanReply(many).diff!.summary).toContain('adds 2 tasks');
  });
  it('never claims to be applied', () => {
    expect(preparePlanReply(good).diff!.summary).toContain('Nothing is saved until you apply');
  });
});

describe('aiPlan — the repair prompt is GENERATED from the errors', () => {
  const r = preparePlanReply('{"tasks": {"nope": 1}}');
  it('exists whenever validation fails', () => expect(r.repairPrompt.length).toBeGreaterThan(60));
  it('names the failing path', () => expect(r.repairPrompt).toContain('tasks'));
  it('states what was expected', () => expect(r.repairPrompt).toContain('expected:'));
  it('includes the vocabulary so the fix needs no reference lookup', () => {
    expect(r.repairPrompt).toContain(PATTERN_VOCABULARY[0]);
  });
  it('re-states that dueInDays is a NUMBER, the most common model error', () => {
    expect(r.repairPrompt).toContain('NUMBER');
  });
  it('is empty on success — a healthy reply has nothing to repair', () => {
    expect(preparePlanReply(good).repairPrompt).toBe('');
  });
});

// ── the regression this file was written for ────────────────────────────────
// validateOutcome/validateMove declared `path` and `issues` and never touched
// them, so every malformed field fell through to its default. A reply carrying
// count:"three" or shiftDays:"later" validated CLEAN, committed as 1 and 0, and
// the UI showed "applied" with the data silently gone and no repair prompt. A
// validator that quietly corrects input is worse than one that refuses it.
describe('aiPlanSchema: wrong-typed fields are reported, not silently coerced', () => {
  const at = (paths: string[]) => paths.join(',');

  test('a string count is an error, not a silent 1', () => {
    const r = preparePlanReply(JSON.stringify({
      schemaVersion: PLAN_SCHEMA_VERSION,
      tasks: [], outcomes: [{ kind: 'problem_solved', title: 'x', count: 'three' }], deadlineMoves: [],
    }));
    expect(r.report.ok).toBe(false);
    expect(at(r.report.issues.map((i) => i.path))).toContain('outcomes[0].count');
  });

  test('a non-boolean cold is an error, not a silent drop', () => {
    const r = preparePlanReply(JSON.stringify({
      schemaVersion: PLAN_SCHEMA_VERSION,
      tasks: [], outcomes: [{ kind: 'problem_solved', title: 'x', cold: 'yes' }], deadlineMoves: [],
    }));
    expect(r.report.ok).toBe(false);
    expect(at(r.report.issues.map((i) => i.path))).toContain('outcomes[0].cold');
  });

  test('an unknown outcome kind is an error', () => {
    const r = preparePlanReply(JSON.stringify({
      schemaVersion: PLAN_SCHEMA_VERSION,
      tasks: [], outcomes: [{ kind: 'solved', title: 'x' }], deadlineMoves: [],
    }));
    expect(r.report.ok).toBe(false);
    expect(at(r.report.issues.map((i) => i.path))).toContain('outcomes[0].kind');
  });

  test('a string shiftDays is an error, not a silent no-op', () => {
    const r = preparePlanReply(JSON.stringify({
      schemaVersion: PLAN_SCHEMA_VERSION,
      tasks: [], outcomes: [], deadlineMoves: [{ title: 'd', shiftDays: 'later' }],
    }));
    expect(r.report.ok).toBe(false);
    expect(at(r.report.issues.map((i) => i.path))).toContain('deadlineMoves[0].shiftDays');
  });

  test('an unknown pattern on an OUTCOME is an error (not just on a task)', () => {
    const r = preparePlanReply(JSON.stringify({
      schemaVersion: PLAN_SCHEMA_VERSION,
      tasks: [], outcomes: [{ kind: 'problem_solved', title: 'x', pattern: 'hash map' }], deadlineMoves: [],
    }));
    expect(r.report.ok).toBe(false);
    expect(at(r.report.issues.map((i) => i.path))).toContain('outcomes[0].pattern');
  });

  test('a non-numeric dueInDays / bad priority on a TASK is an error', () => {
    const r = preparePlanReply(JSON.stringify({
      schemaVersion: PLAN_SCHEMA_VERSION,
      tasks: [{ title: 'x', dueInDays: 'tomorrow', priority: 'urgent' }], outcomes: [], deadlineMoves: [],
    }));
    expect(r.report.ok).toBe(false);
    const paths = at(r.report.issues.map((i) => i.path));
    expect(paths).toContain('tasks[0].dueInDays');
    expect(paths).toContain('tasks[0].priority');
  });

  test('OMITTED fields still default cleanly - absence is not an error', () => {
    const r = preparePlanReply(JSON.stringify({
      schemaVersion: PLAN_SCHEMA_VERSION,
      tasks: [{ title: 'x' }], outcomes: [{ kind: 'problem_solved', title: 'y' }], deadlineMoves: [{ title: 'd' }],
    }));
    expect(r.report.ok).toBe(true);
    expect(r.report.plan!.tasks[0].dueInDays).toBe(1);
    expect(r.report.plan!.outcomes[0].count).toBe(1);
    expect(r.report.plan!.deadlineMoves[0].shiftDays).toBe(0);
  });

  test('every reported issue is ADDRESSABLE so the repair prompt can quote it', () => {
    const r = preparePlanReply(JSON.stringify({
      schemaVersion: PLAN_SCHEMA_VERSION,
      tasks: [{ title: 'x', dueInDays: 'tomorrow' }],
      outcomes: [{ kind: 'problem_solved', title: 'y', count: 'three' }],
      deadlineMoves: [{ title: 'd', shiftDays: 'later' }],
    }));
    expect(r.report.ok).toBe(false);
    for (const i of r.report.issues) {
      expect(i.path).toMatch(/^(tasks|outcomes|deadlineMoves)\[\d+\]\.[a-zA-Z]+$/);
      expect(i.problem.length).toBeGreaterThan(0);
      expect(i.expected.length).toBeGreaterThan(0);
    }
    expect(r.repairPrompt).toContain('dueInDays');
    expect(r.repairPrompt).toContain('shiftDays');
  });
});
