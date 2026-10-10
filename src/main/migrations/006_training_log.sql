-- ═══════════════════════════════════════════════════════════════════════════
-- 006 · the training log — storage for all 7 features
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Design notes that belong with the schema, not in a doc:
--
--  · training_outcomes is an IMMUTABLE LOG. Problems, PRs and ratings are
--    evidence; they are never edited in place. A correction is a new row, so
--    "what did I actually do in March" stays answerable.
--  · training_cards is DERIVED STATE (the queue row) and training_reviews is
--    the EVENT LOG. This split is copied from `learn_cards` /
--    `learn_card_reviews`, which is the best-engineered pattern already in the
--    repo, and it is what makes the schedule rebuildable if the heuristic is
--    ever replaced.
--  · `pattern` is deliberately a free TEXT column with a closed vocabulary in
--    code (`aiPlanSchema.PATTERN_VOCABULARY`, `captureParse.PATTERNS`) rather
--    than a CHECK constraint. A CHECK would make the SQL schema the place the
--    vocabulary lives; the vocabulary has to be shared with the parser and the
--    validator, which are TypeScript. Duplicating it in SQL is how the two drift.
--    See the note in captureParse.ts on why "hash map"/"hashmap" splitting into
--    two queues is the failure this guards against.
--
-- All statements are IF NOT EXISTS so this is safe on a database that already
-- has some of it.

-- ── the outcome ledger (F3: outcomes, not hours) ──────────────────────────
CREATE TABLE IF NOT EXISTS training_outcomes (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,                    -- YYYY-MM-DD, local
  kind        TEXT NOT NULL,                    -- problem_solved | pr_opened | pr_merged | contest
  title       TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 1,
  -- `cold` is the metric CZ actually cares about: solved with no hints.
  -- Nullable because it is meaningless for a PR.
  cold        INTEGER,
  pattern     TEXT,
  minutes     INTEGER,
  app         TEXT,
  source      TEXT NOT NULL DEFAULT 'capture',  -- capture | manual | import
  -- Free text for "what actually happened". Never shown as the primary label.
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_training_outcomes_date    ON training_outcomes(date DESC);
CREATE INDEX IF NOT EXISTS idx_training_outcomes_kind    ON training_outcomes(kind, date DESC);
CREATE INDEX IF NOT EXISTS idx_training_outcomes_pattern ON training_outcomes(pattern, date DESC);
-- Partial index for the one query the queue actually runs. SQLite supports
-- these, and a full index on 200 rows that are mostly historical is wasted.
CREATE INDEX IF NOT EXISTS idx_training_outcomes_cold    ON training_outcomes(date DESC) WHERE cold = 1;

-- ── the spaced-repetition queue (F3) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_cards (
  id              TEXT PRIMARY KEY,
  pattern         TEXT,
  title           TEXT NOT NULL,
  -- NULL means "new, never scheduled". `dueCards` sorts these FIRST on purpose:
  -- a queue you open must never look empty.
  due             TEXT,
  reps            INTEGER NOT NULL DEFAULT 0,
  lapses          INTEGER NOT NULL DEFAULT 0,
  scheduled_days  INTEGER NOT NULL DEFAULT 0,
  source_outcome  TEXT,                          -- training_outcomes.id
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_training_cards_due ON training_cards(due);

CREATE TABLE IF NOT EXISTS training_reviews (
  id              INTEGER PRIMARY KEY,
  card_id         TEXT NOT NULL REFERENCES training_cards(id) ON DELETE CASCADE,
  rating          TEXT NOT NULL,                 -- recalled | partial | forgotten
  review_date     TEXT NOT NULL,
  scheduled_days  INTEGER,
  -- Retained even though it is derivable, so the whole schedule can be rebuilt
  -- from this table alone if `training_cards` is ever wrong.
  elapsed_days    INTEGER,
  weakened        INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_training_reviews_card ON training_reviews(card_id);
CREATE INDEX IF NOT EXISTS idx_training_reviews_date ON training_reviews(review_date);

-- ── weekly review (F6), cached so it never recomputes on render ────────────
-- Modelled on `finance_monthrecaps`: UNIQUE period + a JSON stats blob + an
-- explicit status enum + provider/error columns. That table is the existing
-- precedent for "a periodic digest that must not be recomputed per repaint".
CREATE TABLE IF NOT EXISTS weekly_reviews (
  week_key          TEXT PRIMARY KEY,            -- '2026-W42', Monday-anchored
  planned           INTEGER NOT NULL DEFAULT 0,
  done              INTEGER NOT NULL DEFAULT 0,
  most_skipped_habit TEXT,
  -- Exactly ONE proposal. A TEXT column, not a JSON array, so "one change only"
  -- is enforced by the schema and cannot be violated by a future caller.
  proposal          TEXT,
  proposal_why      TEXT,
  proposal_accepted INTEGER NOT NULL DEFAULT 0,
  headline          TEXT,
  all_clear         INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'generated',  -- pending | generated | failed
  stats_json        TEXT NOT NULL,
  provider_id       TEXT,
  error_message     TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── plan mode (F7) — the escape log, which is the actual mechanism ────────
CREATE TABLE IF NOT EXISTS plan_mode_events (
  id           INTEGER PRIMARY KEY,
  date         TEXT NOT NULL,
  phase_id     TEXT,
  -- 'armed' | 'released' | 'broke'. 'broke' is the row that makes Sunday's
  -- review able to say "you broke the block twice this week" — without it the
  -- rule is just an obstacle, and obstacles get deleted.
  kind         TEXT NOT NULL,
  outstanding  INTEGER NOT NULL DEFAULT 0,
  -- The typed phrase is NOT stored verbatim; only that it matched. Storing what
  -- someone typed to get past a guard is data nobody needs.
  confirmation_ok INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plan_mode_events_date ON plan_mode_events(date DESC);

-- ── drift-question answers (F5), so "Not now" can actually silence it ─────
CREATE TABLE IF NOT EXISTS phase_drift_answers (
  id          INTEGER PRIMARY KEY,
  phase_id    TEXT,
  week_key    TEXT NOT NULL,
  answer      TEXT NOT NULL,                     -- yes | not_now | no
  reason      TEXT,
  -- When this question may be asked again. "Not now" is a real answer, not a
  -- dismissal; without a cooldown the prompt becomes an irritant that gets
  -- permanently dismissed unread, which is worse than never asking.
  ask_again_after TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_phase_drift_answers_week ON phase_drift_answers(week_key);

-- ── life_phases gains the rules that make a phase mean something (F5) ──────
-- Conditional ALTERs live in runMigrations.ts as v7, because SQLite has no
-- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.