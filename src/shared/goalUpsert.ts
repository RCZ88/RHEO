/**
 * Goal row upsert that PRESERVES columns the caller did not send.
 *
 * ── WHY THIS IS A SEPARATE FILE ──
 * It is pure enough to test and it is the fix for a bug that silently destroyed
 * user data, so it must be testable WITHOUT importing `main.ts`. The repo already
 * established exactly this rule in `src/__tests__/pollForeground.test.ts`:
 *
 *   "These test the state-transition invariants … WITHOUT importing the
 *    side-effect-heavy main.ts. This file EXTRACTS the equivalent pure-logic
 *    contracts so a future refactor cannot silently violate the invariants."
 *
 * So the rules live here and `goal-handlers.ts` calls in. Only a `db` with
 * `prepare()` is required — deliberately not typed as `better-sqlite3`, so a
 * test can hand it `node:sqlite` (the native binding is compiled for Electron's
 * ABI and cannot be loaded from a plain Node process).
 *
 * ── THE BUG THIS FIXES ──
 * `save-goal` and `save-goals-batch` both used `INSERT OR REPLACE`, which in
 * SQLite is `DELETE` + `INSERT`. Each statement listed 18 of the table's 24
 * columns, so the ones it omitted — `is_habit`, `cadence`, `weekly_target_days`,
 * `detection`, `linked_schedule_id`, `journal_text`, `slipped_count` — were not
 * merely left alone. They were deleted and reset to their column default on
 * EVERY write.
 *
 * That is not hypothetical. `HabitsPage` calls `saveGoal` on each habit toggle,
 * and the live database contains **0 rows** with `is_habit = 1`: every habit
 * saved was silently un-habited by the next save of the same id. Any partial
 * update likewise nulled `progress_seconds`, `completed_at` and `links`.
 *
 * ── THE CONTRACT ──
 *   • UPDATE an existing row → touch ONLY the keys the payload carries.
 *     An explicit `null` CLEARS a field; an absent key LEAVES IT ALONE.
 *   • INSERT a new row      → absent keys take the column default.
 *
 * That is a PATCH semantic, not a REPLACE semantic, which is the whole point.
 */

/** The minimal surface `upsertGoalRow` needs from a SQLite handle. */
export interface SqliteLike {
  prepare(sql: string): {
    run(...params: any[]): { changes: number | bigint };
    all(...params: any[]): any[];
    get(...params: any[]): any;
  };
}

export type GoalColumn = readonly [name: string, read: (g: any) => unknown, insertDefault: unknown];

const j = (v: unknown): string => JSON.stringify(v ?? null);

/** Parent ids are stored twice: denormalised for the common case, plus JSON. */
function parentIdsOf(g: any): string[] {
  if (Array.isArray(g.parentIds)) return g.parentIds.map(String);
  if (g.parent_id) return [String(g.parent_id)];
  return [];
}

/**
 * Every column this module may write, and how it is derived from the camelCase
 * goal object the renderer sends.
 *
 * Each `read` returns `undefined` when the payload did not supply that field.
 * That distinction is load-bearing: `undefined` means "leave it alone on UPDATE,
 * use the default on INSERT", while an explicit `null` means "clear it".
 * Returning `''` or `null` for an absent key would silently reintroduce the bug.
 */
export const GOAL_WRITABLE: readonly GoalColumn[] = [
  // ── core ──
  ['date',             (g) => g.date,                          null],
  ['title',            (g) => g.title,                         null],
  ['description',      (g) => g.description,                   null],
  ['category',         (g) => g.category,                      null],
  ['target_type',      (g) => g.target?.type,                  null],
  ['target_seconds',   (g) => g.target?.targetSeconds,         null],
  ['match_category',   (g) => g.target?.matchCategory,         null],
  ['status',           (g) => g.status,                        null],
  ['period',           (g) => g.period,                        null],
  ['source',           (g) => g.source,                        null],
  ['links',            (g) => (g.links === undefined ? undefined : j(g.links)), '[]'],
  ['progress_seconds', (g) => g.progressSeconds,               null],
  ['completed_at',     (g) => g.completedAt,                   null],
  ['priority',         (g) => g.priority,                      null],
  ['parent_id',        (g) => { const p = parentIdsOf(g); return (g.parentIds === undefined && g.parent_id === undefined) ? undefined : (p[0] || null); }, null],
  ['parent_ids',       (g) => (g.parentIds === undefined && g.parent_id === undefined) ? undefined : j(parentIdsOf(g)), '[]'],
  ['deadline',         (g) => g.deadline,                      null],

  // ── habit + cadence metadata: the columns REPLACE was destroying ──
  ['is_habit',         (g) => (g.isHabit ?? g.is_habit),       null],
  ['cadence',          (g) => g.cadence,                       null],
  ['weekly_target_days', (g) => (g.weeklyTargetDays === undefined ? undefined : j(g.weeklyTargetDays)), '[]'],
  ['detection',        (g) => (g.detection === undefined ? undefined : j(g.detection)), 'null'],
  ['linked_schedule_id', (g) => g.linkedScheduleId,            null],
  ['journal_text',     (g) => g.journalText,                   null],
  ['slipped_count',    (g) => g.slippedCount,                  null],

  // ── completion + tracking config (DDL added by migration v6) ──
  ['completion_config', (g) => {
    const v = g.completionLogic ?? g.completionConfig;
    return v === undefined ? undefined : j(v);
  }, '{"lateAllowed":false,"gracePeriodMinutes":0,"partialCredit":false,"partialCreditThreshold":80,"streakOnMiss":"reset"}'],
  ['tracking_mode',    (g) => g.trackingMode,                  null],
  ['cadence_config',   (g) => (g.cadenceConfig === undefined ? undefined : j(g.cadenceConfig)),
                          '{"type":"fixed","fixedDays":[],"rollingTarget":1,"flexibleWindowDays":7}'],
  ['cross_feature_link', (g) => (g.crossFeatureLink === undefined ? undefined : j(g.crossFeatureLink)), 'null'],
  ['external_activity_id', (g) => g.externalActivityId,        null],
  ['match_apps',       (g) => {
    const a = g.target?.matchApps ?? g.appUsage?.apps;
    return a === undefined ? undefined : j(a);
  }, '[]'],
];

/** Per-call fallbacks, so each writer keeps its own historical defaults. */
export interface UpsertDefaults {
  date?: string;
  category?: string;
  targetType?: string;
  status?: string;
  period?: string;
  source?: string;
  priority?: number;
  progressSeconds?: number;
}

/**
 * Columns the database actually has.
 *
 * Intersecting with `PRAGMA table_info` is what makes this safe to deploy
 * against a database predating migration v6 (which adds six columns that had no
 * DDL anywhere) — without the guard, the UPDATE would name a column that does
 * not exist and throw. Cached: the schema does not change mid-run.
 */
export function writableGoalColumns(db: SqliteLike): GoalColumn[] {
  let present: Set<string>;
  try {
    present = new Set((db.prepare('PRAGMA table_info(goals)').all() as any[]).map((r) => String(r.name)));
  } catch {
    return GOAL_WRITABLE as GoalColumn[]; // PRAGMA unavailable — attempt the full set
  }
  return GOAL_WRITABLE.filter(([col]) => present.has(col));
}

/**
 * Which per-call default applies to which column.
 *
 * Each writer has its own historical fallbacks — the single writer defaults
 * `source` to 'manual' and `target_type` to 'time', while the batch writer (used
 * by the AI assistant) defaults them to 'ai_assistant' and 'custom'. Collapsing
 * them to one shared value would silently change what the batch path writes.
 *
 * These apply to the INSERT path ONLY. On UPDATE an absent key means "preserve",
 * full stop — a default must never overwrite an existing value, because that
 * would reintroduce the original bug through the back door.
 */
const DEFAULT_COLUMN: Record<keyof UpsertDefaults, string> = {
  date: 'date',
  category: 'category',
  targetType: 'target_type',
  status: 'status',
  period: 'period',
  source: 'source',
  priority: 'priority',
  progressSeconds: 'progress_seconds',
};

/**
 * Insert or update a goal row without destroying unsupplied columns.
 * Returns 'created' | 'updated' so the caller can label its context-brain episode.
 */
export function upsertGoalRow(
  db: SqliteLike,
  id: string,
  goal: any,
  defaults: UpsertDefaults = {},
): 'created' | 'updated' {
  const cols = writableGoalColumns(db);
  const existed = !!db.prepare('SELECT 1 FROM goals WHERE id = ?').get(id);

  if (existed) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [col, read] of cols) {
      const v = read(goal);
      if (v === undefined) continue;              // not supplied → leave this column alone
      sets.push(`${col} = ?`);
      vals.push(v);
    }
    if (sets.length) db.prepare(`UPDATE goals SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    return 'updated';
  }

  // Per-call defaults override the column map's defaults for the INSERT path.
  const override = new Map<string, unknown>();
  for (const [key, col] of Object.entries(DEFAULT_COLUMN)) {
    const v = (defaults as any)[key];
    if (v !== undefined) override.set(col, v);
  }

  const names = ['id', ...cols.map(([c]) => c)];
  const values: unknown[] = [id];
  for (const [col, read, dflt] of cols) {
    const v = read(goal);
    // `undefined` (absent) takes the per-call default, else the column default.
    // An explicit `null` is preserved, so a caller can create a row with a
    // deliberately empty description rather than having a default overwrite intent.
    values.push(v === undefined ? (override.has(col) ? override.get(col) : dflt) : v);
  }
  db.prepare(
    `INSERT INTO goals (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
  ).run(...values);
  return 'created';
}