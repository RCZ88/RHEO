-- ═══════════════════════════════════════════════════════════════════════════
-- 005 · substrate repair: tables the code reads but nothing ever created
-- ═══════════════════════════════════════════════════════════════════════════
--
-- All three are `CREATE TABLE IF NOT EXISTS`, so this file is idempotent and
-- safe to run against CZ's live database as well as a fresh one.

-- ── rewind_cache ───────────────────────────────────────────────────────────
-- Read at engine.ts:733, written at engine.ts:782. The SELECT is NOT inside a
-- try/catch, so on any database where this table is absent `generateRewind`
-- throws before computing anything — the whole Rewind / Insights digest is
-- dead, not degraded. The INSERT two lines below it *is* guarded, which is why
-- the failure looked like a silent cache miss rather than a crash.
CREATE TABLE IF NOT EXISTS rewind_cache (
  period_key TEXT PRIMARY KEY,
  json       TEXT NOT NULL,
  built_at   DATETIME
);

-- ── insight_log ───────────────────────────────────────────────────────────
-- Read at engine.ts:640, written at engine.ts:809. Both sites ARE guarded, so
-- the only real symptom was that insight de-duplication never worked: the same
-- insight could be shown on consecutive days because the "shown in the last 2
-- days" query always threw and the penalty was skipped.
CREATE TABLE IF NOT EXISTS insight_log (
  id        TEXT PRIMARY KEY,
  atom_id   TEXT NOT NULL,
  shown_at  DATETIME,
  period    TEXT,
  dismissed INTEGER DEFAULT 0,
  shared    INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_insight_log_shown ON insight_log(shown_at);
CREATE INDEX IF NOT EXISTS idx_insight_log_atom  ON insight_log(atom_id);

-- ── habit_completions ─────────────────────────────────────────────────────
-- Habit definitions have always lived in SQLite (`goals.is_habit = 1`), but the
-- act of *completing* one lived in four `localStorage` keys
-- (src/features/covenant/storage.ts). That is split-brain: unsynced, absent
-- from every database backup, and destroyed by a Chromium profile reset — while
-- the definitions survive. This table is the real home.
--
-- `met_minimum` is deliberately stored rather than computed at read time. The
-- point of the minimum-day rule is that a bad day still counts, so whether a
-- given day "counted" must be decided once, when it happened, against the
-- threshold in force then — not re-derived later against a threshold that may
-- since have changed.
CREATE TABLE IF NOT EXISTS habit_completions (
  id           TEXT PRIMARY KEY,
  habit_id     TEXT NOT NULL,
  date         TEXT NOT NULL,                    -- YYYY-MM-DD, local
  minutes      INTEGER DEFAULT 0,
  met_minimum  INTEGER DEFAULT 0,
  source       TEXT DEFAULT 'manual',             -- manual | detected | migrated
  completed_at TEXT NOT NULL,
  UNIQUE(habit_id, date)
);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_date ON habit_completions(habit_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_completions_date       ON habit_completions(date DESC);