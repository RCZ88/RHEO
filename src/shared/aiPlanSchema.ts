/**
 * aiPlanSchema — feature 2. "Use JSON, not free text… Show a diff before
 * applying. Never apply silently. Add a 'repair' button. If parsing fails, it
 * generates a prompt telling the AI exactly what was wrong."
 *
 * ── WHY THIS EXISTS RATHER THAN REUSING `ai-bridge/parse.ts` ──
 * That parser has a documented defect that makes it unusable here: for
 * `fieldKeys.length === 1` it returns `ok: true` with the raw pasted text as
 * the value, in three separate branches. Every `FieldAIButton` call site passes
 * exactly one key, so it effectively never fails validation — prose gets written
 * into the field as if it were the answer. For a plan that will ADD TASKS AND
 * MOVE DEADLINES, "never fails" is the wrong property.
 *
 * So: a real schema, real validation, and errors that are ADDRESSABLE.
 *
 * ── WHY THE REPAIR PROMPT IS THE POINT ──
 * A validation error that says "invalid JSON" makes the user fix it by hand,
 * which is exactly the cost this feature exists to remove. Every error therefore
 * carries:
 *   · the JSON PATH that failed (`items[1].pattern`)
 *   · what was wrong in plain language
 *   · what was expected
 * and those three compose into a prompt the user can paste straight back. The
 * repair prompt is generated FROM the error list, not hand-written per case, so
 * a new validation rule automatically produces a correct repair prompt.
 *
 * ── WHY THE DIFF IS NOT OPTIONAL ──
 * The repo already has the pattern to copy: `SettingsPage.tsx`'s
 * propose → review → approve with `previousValue` captured at propose time, and
 * `ManualFillModal`'s "pure preview first, only Generate writes". A plan that
 * silently moves a deadline you set is worse than no AI at all.
 */

export const PLAN_SCHEMA_VERSION = 'training-plan-1.0';

export interface PlanTask {
  title: string;
  /** Days from today, so a plan stays valid across days. Never an absolute date. */
  dueInDays: number;
  priority: 'low' | 'medium' | 'high';
  /** Links the task to an outcome. Optional — not every task is an outcome. */
  pattern?: string;
}

export interface PlanOutcome {
  kind: 'problem_solved' | 'pr_opened' | 'pr_merged' | 'contest';
  title: string;
  count: number;
  /** true = solved with no hints. The metric CZ actually cares about. */
  cold?: boolean;
  pattern?: string;
}

export interface PlanDeadlineMove {
  title: string;
  /** Negative moves it earlier. */
  shiftDays: number;
}

export interface TrainingPlan {
  schemaVersion: string;
  tasks: PlanTask[];
  outcomes: PlanOutcome[];
  deadlineMoves: PlanDeadlineMove[];
}

export interface FieldIssue {
  /** JSON path, e.g. `items[1].pattern`. Addressable — that is the whole point. */
  path: string;
  problem: string;
  expected: string;
  received?: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: FieldIssue[];
  /** Present only when `ok`. */
  plan?: TrainingPlan;
}

export const PATTERN_VOCABULARY = [
  'arrays', 'hash-map', 'two-pointers', 'sliding-window', 'binary-search',
  'strings', 'linked-list', 'stack', 'queue', 'heap', 'tree', 'graph', 'trie',
  'dynamic-programming', 'backtracking', 'greedy', 'math', 'bit-manipulation',
  'segment-tree', 'union-find', 'sorting', 'recursion',
] as const;

const PRIORITIES = ['low', 'medium', 'high'] as const;
const OUTCOME_KINDS = ['problem_solved', 'pr_opened', 'pr_merged', 'contest'] as const;

/**
 * Extract the first JSON object from arbitrary text.
 *
 * Copied in spirit from `ai-bridge/parse.ts` (strip fences, then brace-match)
 * but with one change: it brace-matches with a depth counter rather than a
 * greedy `\{[\s\S]*\}`, because a reply that contains a nested object AND a
 * trailing sentence was previously captured whole and failed to parse.
 */
export function extractJsonBlock(raw: string): string | null {
  const s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Validate a parsed plan against the schema.
 *
 * Deliberately hand-written rather than AJV: the repo's only AJV user reads its
 * schema from disk at runtime, which is right for a 500-line .ldoc document and
 * wrong for a 3-key object where the error list is the product. This returns
 * ADDRESSABLE issues, which `ajv` also does, but without a schema file to keep in
 * sync, and without pulling JSON Schema into a code path an external AI's text
 * enters.
 */
export function validateTrainingPlan(input: unknown): ValidationReport {
  const issues: FieldIssue[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      issues: [{ path: '', problem: 'The reply is not a JSON object.', expected: 'an object with tasks, outcomes and deadlineMoves' }],
    };
  }
  const o = input as Record<string, unknown>;

  if (o.schemaVersion !== undefined && o.schemaVersion !== PLAN_SCHEMA_VERSION) {
    issues.push({
      path: 'schemaVersion',
      problem: `Wrong schema version: ${String(o.schemaVersion)}.`,
      expected: `"${PLAN_SCHEMA_VERSION}"`,
    });
  }

  const tasks = validateArray(o.tasks, 'tasks', issues, validateTask);
  const outcomes = validateArray(o.outcomes, 'outcomes', issues, validateOutcome);
  const moves = validateArray(o.deadlineMoves, 'deadlineMoves', issues, validateMove);

  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    issues: [],
    plan: {
      schemaVersion: PLAN_SCHEMA_VERSION,
      tasks: tasks as PlanTask[],
      outcomes: outcomes as PlanOutcome[],
      deadlineMoves: moves as PlanDeadlineMove[],
    },
  };
}

function validateArray<T>(value: unknown, path: string, issues: FieldIssue[], each: (v: unknown, p: string, iss: FieldIssue[]) => T | null): T[] {
  // Absent is treated as empty. A plan with nothing to add is a valid answer,
  // and demanding the keys makes the model invent content to satisfy the schema.
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    issues.push({ path, problem: 'Expected an array.', expected: 'an array', received: typeName(value) });
    return [];
  }
  const out: T[] = [];
  (value as unknown[]).forEach((v, i) => {
    const r = each(v, `${path}[${i}]`, issues);
    if (r !== null) out.push(r);
  });
  return out;
}

function validateTask(v: unknown, path: string, issues: FieldIssue[]): PlanTask | null {
  if (!v || typeof v !== 'object') {
    issues.push({ path, problem: 'A task was not an object.', expected: '{ title, dueInDays, priority }' });
    return null;
  }
  const t = v as Record<string, unknown>;

  // The pattern vocabulary is CLOSED, and an unrecognised value must be REJECTED
  // rather than passed through. Accepting it is the single most damaging thing
  // this validator could do: "hashmap", "hash map" and "hash-map" would become
  // three separate spaced-repetition queues, and the queue would silently stop
  // being a queue. So a bad pattern is dropped AND reported, which also puts it
  // into the repair prompt where the model can fix it in one pass.
  let pattern: string | undefined;
  if (t.pattern !== undefined && t.pattern !== null && t.pattern !== '') {
    if (isStr(t.pattern) && (PATTERN_VOCABULARY as readonly string[]).includes(t.pattern)) {
      pattern = t.pattern;
    } else {
      issues.push({
        path: `${path}.pattern`,
        problem: `"${String(t.pattern)}" is not a known pattern.`,
        expected: `one of: ${PATTERN_VOCABULARY.join(', ')}`,
        received: JSON.stringify(t.pattern),
      });
    }
  }

  // ABSENT is fine and gets the default. PRESENT-BUT-WRONG is an error and gets
  // reported. Silently coercing the second into the first is how a plan comes
  // back looking applied with data quietly missing and no repair prompt fired.
  if (t.dueInDays !== undefined && !isNum(t.dueInDays)) {
    issues.push({
      path: `${path}.dueInDays`,
      problem: 'dueInDays must be a number of days.',
      expected: 'a number, e.g. 0 for today or 2 for in two days',
      received: JSON.stringify(t.dueInDays),
    });
  }
  if (t.priority !== undefined && !(PRIORITIES as readonly string[]).includes(String(t.priority))) {
    issues.push({
      path: `${path}.priority`,
      problem: `"${String(t.priority)}" is not a known priority.`,
      expected: PRIORITIES.join(' | '),
      received: JSON.stringify(t.priority),
    });
  }

  return {
    title: isStr(t.title) ? t.title : '',
    dueInDays: isNum(t.dueInDays) ? t.dueInDays : 1,
    priority: (PRIORITIES as readonly string[]).includes(String(t.priority)) ? (t.priority as PlanTask['priority']) : 'medium',
    pattern,
  };
}

function validateOutcome(v: unknown, path: string, issues: FieldIssue[]): PlanOutcome | null {
  const o = v as Record<string, unknown>;

  // Same absent-vs-wrong distinction as validateTask. These two params used to be
  // declared and never touched: every bad field fell through to its default, so a
  // reply with `count: "three"` validated CLEAN and committed as 1 — the exact
  // silent data loss that makes a repair prompt pointless. An unused parameter in
  // a validator is worth reading as a bug report.
  if (o.kind !== undefined && !(OUTCOME_KINDS as readonly string[]).includes(String(o.kind))) {
    issues.push({
      path: `${path}.kind`,
      problem: `"${String(o.kind)}" is not a known outcome kind.`,
      expected: OUTCOME_KINDS.join(' | '),
      received: JSON.stringify(o.kind),
    });
  }
  if (o.count !== undefined && !isNum(o.count)) {
    issues.push({
      path: `${path}.count`,
      problem: 'count must be a number.',
      expected: 'a number, e.g. 2',
      received: JSON.stringify(o.count),
    });
  }
  if (o.cold !== undefined && typeof o.cold !== 'boolean') {
    issues.push({
      path: `${path}.cold`,
      problem: 'cold must be true or false.',
      expected: 'true | false',
      received: JSON.stringify(o.cold),
    });
  }
  if (o.pattern !== undefined && !(PATTERN_VOCABULARY as readonly string[]).includes(String(o.pattern))) {
    issues.push({
      path: `${path}.pattern`,
      problem: `"${String(o.pattern)}" is not a known pattern.`,
      expected: `one of: ${PATTERN_VOCABULARY.join(', ')}`,
      received: JSON.stringify(o.pattern),
    });
  }

  return {
    kind: (OUTCOME_KINDS as readonly string[]).includes(String(o.kind)) ? (o.kind as PlanOutcome['kind']) : 'problem_solved',
    title: isStr(o.title) ? o.title : '',
    count: isNum(o.count) ? o.count : 1,
    cold: typeof o.cold === 'boolean' ? o.cold : undefined,
    pattern: isStr(o.pattern) && (PATTERN_VOCABULARY as readonly string[]).includes(o.pattern) ? o.pattern : undefined,
  };
}

function validateMove(v: unknown, path: string, issues: FieldIssue[]): PlanDeadlineMove | null {
  const m = v as Record<string, unknown>;

  // A shift of 0 is a no-op, and a NEGATIVE shift silently moving a deadline
  // backwards is the kind of edit that needs a human to have seen it, so a
  // non-number here is reported rather than rounded into "no change".
  if (m.shiftDays !== undefined && !isNum(m.shiftDays)) {
    issues.push({
      path: `${path}.shiftDays`,
      problem: 'shiftDays must be a number of days.',
      expected: 'a number, e.g. -2 to pull a deadline two days earlier',
      received: JSON.stringify(m.shiftDays),
    });
  }

  return {
    title: isStr(m.title) ? m.title : '',
    shiftDays: isNum(m.shiftDays) ? m.shiftDays : 0,
  };
}

function typeName(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  return `a ${typeof v}`;
}

/**
 * THE REPAIR PROMPT.
 *
 * Generated from the issue list, so adding a validation rule automatically
 * produces a correct repair prompt — which is the property that makes "add a
 * repair button" maintainable instead of a thing that rots.
 */
export function buildRepairPrompt(raw: string, report: ValidationReport): string {
  if (report.ok) return '';
  const lines = [
    'Your plan could not be applied. Here is exactly what was wrong.',
    '',
  ];
  for (const i of report.issues) {
    lines.push(`• ${i.path || '(whole reply)'}: ${i.problem}`);
    lines.push(`  expected: ${i.expected}`);
    if (i.received !== undefined) lines.push(`  you sent:  ${i.received}`);
  }
  lines.push(
    '',
    'Fix ONLY those problems and reply with the same JSON object again. Do not add commentary.',
    'The schema is:',
    JSON.stringify({ schemaVersion: PLAN_SCHEMA_VERSION, tasks: [], outcomes: [], deadlineMoves: [] }, null, 2),
    '`pattern` must be one of:',
    PATTERN_VOCABULARY.join(', '),
    '`priority` must be one of: low, medium, high',
    '`kind` must be one of: ' + OUTCOME_KINDS.join(', '),
    '`dueInDays` is a NUMBER of days from today (1 = tomorrow, 0 = today). Never a date string.',
  );
  if (raw && raw.length < 4000) {
    lines.push('', 'What you sent last time:', '---', raw.slice(0, 4000), '---');
  }
  return lines.join('\n');
}

/**
 * The DIFF. Always shown, never optional.
 *
 * The summary sentence is written first and phrased as a count, because
 * "this adds 3 tasks, moves 1 deadline" is reviewable in under a second and
 * "here are your changes" is not. CZ asked for that exact sentence.
 */
export interface PlanDiff {
  summary: string;
  addTasks: PlanTask[];
  addOutcomes: PlanOutcome[];
  moveDeadlines: PlanDeadlineMove[];
  /** True when there is nothing to apply — the UI then hides Apply entirely. */
  empty: boolean;
}

export function diffTrainingPlan(plan: TrainingPlan): PlanDiff {
  const addTasks = plan.tasks ?? [];
  const addOutcomes = plan.outcomes ?? [];
  const moveDeadlines = plan.deadlineMoves ?? [];
  const bits: string[] = [];
  if (addTasks.length) bits.push(`adds ${addTasks.length} task${addTasks.length === 1 ? '' : 's'}`);
  if (addOutcomes.length) bits.push(`logs ${addOutcomes.length} outcome${addOutcomes.length === 1 ? '' : 's'}`);
  if (moveDeadlines.length) bits.push(`moves ${moveDeadlines.length} deadline${moveDeadlines.length === 1 ? '' : 's'}`);
  return {
    summary: bits.length ? `This ${bits.join(', ')}. Nothing is saved until you apply.` : 'Nothing to apply.',
    addTasks,
    addOutcomes,
    moveDeadlines,
    empty: bits.length === 0,
  };
}

/**
 * Parse + validate + diff in one call, which is the only shape the UI needs.
 * Returns the parsed-but-INVALID plan too when possible, so the repair prompt
 * can quote what the model actually sent.
 */
export function preparePlanReply(raw: string): {
  report: ValidationReport;
  diff: PlanDiff | null;
  repairPrompt: string;
} {
  const block = extractJsonBlock(raw);
  if (!block) {
    const report: ValidationReport = {
      ok: false,
      issues: [{ path: '', problem: 'No JSON object found in the reply.', expected: 'a JSON object, optionally inside a ```json fence' }],
    };
    return { report, diff: null, repairPrompt: buildRepairPrompt(raw, report) };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const report: ValidationReport = {
      ok: false,
      issues: [{ path: '', problem: `The JSON is malformed: ${detail}`, expected: 'valid JSON — check for a trailing comma or an unclosed string' }],
    };
    return { report, diff: null, repairPrompt: buildRepairPrompt(raw, report) };
  }
  const report = validateTrainingPlan(parsed);
  return {
    report,
    diff: report.ok && report.plan ? diffTrainingPlan(report.plan) : null,
    repairPrompt: report.ok ? '' : buildRepairPrompt(raw, report),
  };
}