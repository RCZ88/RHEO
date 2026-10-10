/**
 * The habit-metadata destruction bug, and its fix.
 *
 * `save-goal` used `INSERT OR REPLACE`, which in SQLite is DELETE + INSERT. The
 * statement named 18 of the table's 24 columns, so the seven it omitted were not
 * left alone — they were deleted and reset to their column default on EVERY
 * write. `HabitsPage` calls `saveGoal` on each habit toggle, and the live
 * database had 0 rows with `is_habit = 1`.
 *
 * These tests use `node:sqlite`'s DatabaseSync, NOT `better-sqlite3`: the native
 * binding here is compiled for Electron's ABI (NODE_MODULE_VERSION 145) and
 * cannot be loaded from a plain Node process at all.
 */
import { DatabaseSync } from 'node:sqlite';
import { upsertGoalRow } from '../shared/goalUpsert';

const SCHEMA = `
CREATE TABLE goals (
  id TEXT PRIMARY KEY, date TEXT, title TEXT, description TEXT, category TEXT,
  target_type TEXT, target_seconds INTEGER, match_category TEXT, status TEXT,
  period TEXT, source TEXT, links TEXT DEFAULT '[]', progress_seconds INTEGER DEFAULT 0,
  completed_at TEXT, priority INTEGER DEFAULT 0, parent_id TEXT, parent_ids TEXT DEFAULT '[]',
  deadline TEXT, is_habit INTEGER DEFAULT 0, cadence TEXT, weekly_target_days TEXT DEFAULT '[]',
  detection TEXT, linked_schedule_id TEXT, journal_text TEXT, slipped_count INTEGER DEFAULT 0,
  completion_config TEXT, tracking_mode TEXT, cadence_config TEXT, cross_feature_link TEXT,
  external_activity_id INTEGER, match_apps TEXT
);`;

const mk = () => { const d = new DatabaseSync(':memory:'); d.exec(SCHEMA); return d; };
const row = (db, id) => db.prepare('SELECT * FROM goals WHERE id=?').get(id);
const SINGLE = { date: '2026-10-05', category: 'work', targetType: 'time', status: 'pending', period: 'daily', source: 'manual' };
const BATCH = { date: '2000-01-01', category: 'work', targetType: 'custom', status: 'pending', period: 'daily', source: 'ai_assistant' };

const HABIT = {
  id: 'h1', title: 'LeetCode', isHabit: 1, cadence: 'weekly', weeklyTargetDays: [1, 3, 5],
  detection: { enabled: true }, journalText: 'note', slippedCount: 2, linkedScheduleId: 's9',
  completionLogic: { streakOnMiss: 'pause' }, trackingMode: 'hybrid',
};

describe('upsertGoalRow — the habit columns survive an ordinary save', () => {
  const db = mk();
  it('reports created on first write', () => {
    expect(upsertGoalRow(db, 'h1', HABIT, SINGLE)).toBe('created');
  });
  it('stores is_habit', () => expect(row(db, 'h1').is_habit).toBe(1));
  it('stores cadence', () => expect(row(db, 'h1').cadence).toBe('weekly'));
  it('stores weekly_target_days as JSON', () => expect(row(db, 'h1').weekly_target_days).toBe('[1,3,5]'));
  it('stores completion_config with the caller streakOnMiss', () => {
    expect(JSON.parse(row(db, 'h1').completion_config).streakOnMiss).toBe('pause');
  });

  // This is the exact call HabitsPage makes on toggle: same id, no habit keys.
  it('reports updated when re-saved without habit keys', () => {
    expect(upsertGoalRow(db, 'h1', { title: 'LeetCode', status: 'done', date: '2026-10-06' }, SINGLE)).toBe('updated');
  });
  it('PRESERVES is_habit', () => expect(row(db, 'h1').is_habit).toBe(1));
  it('PRESERVES cadence', () => expect(row(db, 'h1').cadence).toBe('weekly'));
  it('PRESERVES weekly_target_days', () => expect(row(db, 'h1').weekly_target_days).toBe('[1,3,5]'));
  it('PRESERVES journal_text', () => expect(row(db, 'h1').journal_text).toBe('note'));
  it('PRESERVES slipped_count', () => expect(row(db, 'h1').slipped_count).toBe(2));
  it('PRESERVES linked_schedule_id', () => expect(row(db, 'h1').linked_schedule_id).toBe('s9'));
  it('PRESERVES completion_config', () => {
    expect(JSON.parse(row(db, 'h1').completion_config).streakOnMiss).toBe('pause');
  });
  it('…but the supplied status DID change', () => expect(row(db, 'h1').status).toBe('done'));
  it('…and the date DID move', () => expect(row(db, 'h1').date).toBe('2026-10-06'));
});

describe('upsertGoalRow — PATCH, not REPLACE', () => {
  const db = mk();
  upsertGoalRow(db, 'g1', { title: 'A', description: 'keep me', links: [{ a: 1 }], priority: 5 }, SINGLE);
  it('an explicit null CLEARS the field', () => {
    upsertGoalRow(db, 'g1', { title: 'B', description: null }, SINGLE);
    expect(row(db, 'g1').description).toBeNull();
  });
  it('an absent key leaves `links` alone', () => expect(row(db, 'g1').links).toBe('[{"a":1}]'));
  it('an absent key leaves `priority` alone', () => expect(row(db, 'g1').priority).toBe(5));
  it('a supplied key is still updated', () => expect(row(db, 'g1').title).toBe('B'));
});

describe('upsertGoalRow — per-writer defaults, on INSERT only', () => {
  const db = mk();
  upsertGoalRow(db, 's1', { title: 'S' }, SINGLE);
  upsertGoalRow(db, 'b1', { title: 'B' }, BATCH);
  it('single writer keeps source=manual', () => expect(row(db, 's1').source).toBe('manual'));
  it('single writer keeps target_type=time', () => expect(row(db, 's1').target_type).toBe('time'));
  it('batch writer keeps source=ai_assistant', () => expect(row(db, 'b1').source).toBe('ai_assistant'));
  it('batch writer keeps target_type=custom', () => expect(row(db, 'b1').target_type).toBe('custom'));
  it('batch writer default date applied', () => expect(row(db, 'b1').date).toBe('2000-01-01'));

  it('a later UPDATE with NO defaults must not blank source', () => {
    upsertGoalRow(db, 's1', { status: 'done' }, {});
    expect(row(db, 's1').source).toBe('manual');
  });
  it('…and must not blank target_type', () => expect(row(db, 's1').target_type).toBe('time'));
});

describe('upsertGoalRow — safety', () => {
  it('never changes the row count (PATCH, not delete+insert)', () => {
    const db = mk();
    const habits = [1, 2, 3, 4, 5].map((i) => ({ id: `h${i}`, title: `H${i}`, isHabit: 1, date: '2026-10-05' }));
    for (const h of habits) upsertGoalRow(db, h.id, h, SINGLE);
    for (const h of habits) upsertGoalRow(db, h.id, { title: `H${h.id}`, date: '2026-10-06' }, SINGLE);
    expect(db.prepare('SELECT COUNT(*) n FROM goals').get().n).toBe(5);
    expect(db.prepare('SELECT COUNT(*) n FROM goals WHERE is_habit=1').get().n).toBe(5);
  });

  it('works against a legacy schema missing the migration-v6 columns', () => {
    // Without the PRAGMA table_info intersection the UPDATE would name a column
    // that does not exist and throw, so a pre-v6 database would fail every save.
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE goals (id TEXT PRIMARY KEY, date TEXT, title TEXT, status TEXT,
             is_habit INTEGER DEFAULT 0, cadence TEXT, detection TEXT)`);
    expect(upsertGoalRow(db, 'x', { title: 'X', isHabit: 1 }, SINGLE)).toBe('created');
    expect(row(db, 'x').is_habit).toBe(1);
  });
});