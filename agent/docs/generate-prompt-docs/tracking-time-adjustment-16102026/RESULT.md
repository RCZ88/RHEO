# Tracking Time Adjustment — Design & Engineering Specification

**Status:** implementation-ready plan; not a claim that code has been changed or tested.  
**Source of truth:** the PROMPT and embedded `CONTEXT_BUNDLE.md` supplied on 2026-10-16. Anything not shown there is marked as an implementation gate instead of guessed.  
**Goal:** stop fabricated sleep-time usage in both writers; let users correct recorded app/site totals with an exact slider and previewed session reflow; unify gap fill and manual time into one discoverable workflow; preserve user data and undo.

## 1. Root Cause Summary

### 1.1 Daemon sleep leak is a clock-ordering bug

In `~/.local/share/rheo-tracker/daemon.mjs`, `feed()` assigns `lastPollMs = now` before calling `flush()` when `wallGap > SLEEP_GAP_MS`. `flush()` then reads the already-advanced value as the end time. A several-hour suspend becomes a several-hour session, capped to 60 minutes by `MAX_LOGGED_SESSION_MS`. The cap limits the damage; it does not make the data true.

**Correct invariant:** an open usage session can end only at the end timestamp of a successful observation known to belong to that session. A failed poll, suspended interval, screen-lock interval, shutdown gap, or unknown interval contributes zero usage. Store two distinct clocks:

```js
let lastPollAttemptMs = 0;             // advances for every attempt, success or failure
let lastSuccessfulObservationMs = 0;   // advances only when the observer returns a valid result
```

Do not overload one timestamp for both meanings.

### 1.2 The app writer is a reference model, not a reason to skip tests

`src/main.ts` already computes `lastSuccessfulObservationTime - sessionStart` on the suspicious-gap path. Mirror that semantic rule in the daemon. Keep the app path's independent gap check as a second line of defence, and add probes for both writers. Both write to the same `logs` table, so fixing only Electron leaves the bug active whenever `rheo-tracker.service` owns port 54321.

### 1.3 Existing correction and fill features solve different tasks but overlap in UI

- `update-app-log` edits one row through date/time text inputs. It is not an app/day total correction tool and does not reflow multiple sessions.
- `manual-assign:*` creates user-authored spans, with one `logs` row plus one linked `manual_time_assignments` row.
- `ManualAssignModal` and `ManualFillModal` are two fronts for the same write path.
- Two unrelated actions have the identical label `Smart Fill`; one opens `ManualAssignModal`, while the other queues the real gap-fill flow.
- `predict-day-gaps` and `useGapPredictions.ts` exist but the hook is imported nowhere.
- Three unreferenced GapFill components call nonexistent IPC channels. They must not become active again.

The solution is one `TrackingTimeDialog` with distinct modes for **correct recorded time**, **fill a detected gap**, and **add manual time**. Different intent is represented by tabs and entry-point context, not competing modals and duplicated buttons.

### 1.4 Data invariants are now explicit ship gates

For each exclusive usage timeline, use half-open intervals `[startMs, endMs)`. Adjacent rows may meet at the same instant, but must not overlap. After a repair, assert:

```text
for every adjacent pair in the canonical timeline:
  start[i] + duration[i] <= start[i + 1]
for every app-defined local day:
  sum(duration_ms) <= 86_400_000
for every row:
  duration_ms > 0
  timestamp is valid ISO-8601
  interval is within its assigned day
```

**Semantic assumption to verify before migration:** the supplied context says rows are expected to be a non-overlapping timeline, but it also has browser-tracking rows in the same table. Confirm whether `is_browser_tracking=1` is intended as exclusive time or a nested annotation of a browser app interval. If it intentionally duplicates browser foreground time, the global no-overlap invariant requires changing that model first; do not silently destroy meaningful website history by truncating nested rows. The plan proceeds on the stated product invariant that `logs` represents exclusive credited time. A database audit and preview must flag any contrary pattern before writing.

## 2. Data Model & Migration

### 2.1 Canonical correction representation

Use a **correction ledger** as the authoritative audit and undo record. Add `source='corrected'` to `logs` as a visible provenance marker, but do not rely on that marker alone for reversibility. Do **not** add a `corrected_from` column as the only model: it cannot represent a multi-row change, a split, deleted excess rows, or a whole-batch undo.

Every applied correction is one atomic batch, including all rows updated, removed, and created. Record before/after snapshots and algorithm version. Snapshot JSON must include every column that the operation can change, not just timestamp and duration.

### 2.2 New tables

Use the project's migration/versioning convention. Schema proposal (adapt names only if they conflict with existing migrations):

```sql
CREATE TABLE IF NOT EXISTS time_correction_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_key TEXT NOT NULL,
  app TEXT NOT NULL,
  profile_id TEXT,
  timezone_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('applied', 'undone')),
  original_total_ms INTEGER NOT NULL CHECK (original_total_ms >= 0),
  target_total_ms INTEGER NOT NULL CHECK (target_total_ms >= 0),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  algorithm_version TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  undone_at TEXT,
  baseline_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_time_correction_batches_day_app
  ON time_correction_batches(day_key, app, profile_id, created_at);

CREATE TABLE IF NOT EXISTS time_correction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES time_correction_batches(id),
  operation TEXT NOT NULL CHECK (operation IN ('updated', 'deleted', 'inserted')),
  log_id INTEGER,
  before_log_json TEXT,
  after_log_json TEXT,
  before_assignment_json TEXT,
  after_assignment_json TEXT,
  CHECK (
    (operation = 'updated' AND log_id IS NOT NULL AND before_log_json IS NOT NULL AND after_log_json IS NOT NULL) OR
    (operation = 'deleted' AND log_id IS NOT NULL AND before_log_json IS NOT NULL AND after_log_json IS NULL) OR
    (operation = 'inserted' AND log_id IS NOT NULL AND before_log_json IS NULL AND after_log_json IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_time_correction_items_batch
  ON time_correction_items(batch_id, id);
```

`before_assignment_json` and `after_assignment_json` preserve the row in `manual_time_assignments` associated with the log. Store full row snapshots, including assignment `id`, `log_id`, `date`, `started_at`, `ended_at`, `duration_seconds`, `mode`, `app`, `category`, and `created_at`.

The existing table has no unique constraint on `manual_time_assignments.log_id`. Audit duplicates before adding a unique index. If one assignment per log is verified, add `CREATE UNIQUE INDEX ... ON manual_time_assignments(log_id) WHERE log_id IS NOT NULL`; otherwise clean/report duplicates first. Never make the migration fail silently on pre-existing duplicates.

### 2.3 Source and assignment rules

- Existing untouched observations remain `source='auto'`.
- Explicit user-entered spans remain `source='manual'`.
- Rows modified by a committed reflow become `source='corrected'`.
- Every corrected/generated session has one `logs` row and one linked `manual_time_assignments` row (`mode='custom'`, `log_id` set). This follows the verified two-table convention so existing reports, timeline queries, and per-app breakdowns can see the real `logs` row.
- A corrected row that used to be auto retains its log ID when reused by the plan, but its original row is in the ledger. Extra rows removed by the plan are snapshotted before deletion. Extra rows inserted by the plan are marked `source='corrected'` and snapshotted after insertion.
- A correction batch is not “saved” until log rows, assignment rows, aggregate maintenance, and ledger rows have all committed successfully.

### 2.4 Migration sequence

1. **Read-only audit:** count invalid timestamps, non-positive durations, duplicate assignment links, source values, duplicate IDs (should be impossible), all overlaps, and day totals using the app's canonical day zone. Emit a report only; do not repair automatically.
2. Verify the meaning of browser-tracking rows. If nested rather than exclusive, define the canonical exclusive timeline before enabling writes.
3. Add ledger tables; add `'corrected'` to any TypeScript source union, source filters, UI chips, and tests. The database column itself is plain `TEXT`, but query filters may assume only `auto/manual`.
4. Add `UPDATE` and `DELETE` aggregate maintenance (see §8.3) by reusing the actual current trigger formulas. Do not invent aggregate columns absent from this bundle.
5. Dry-run rebuild of `stats_hourly`, `stats_daily`, manual assignment stats, and app aggregates against the same query/formula semantics as existing triggers/helpers. Compare against existing totals, and abort if unexplained differences appear.
6. Deploy the sleep fix to both writers and enable invariant probes before enabling the correction UI.
7. Enable preview first. Keep writes disabled by a feature flag until preview, transaction, aggregate, and undo probes pass.
8. Enable commit and undo. Preserve every pre-correction row in the ledger.

### 2.5 Day and timezone semantics

The `timestamp` and `started_at` columns are ISO-8601 text, normally UTC with `Z`. Never use `date(timestamp,'unixepoch')`; it returns empty for this format. For existing grouping SQL use `substr(timestamp,1,10)` where that is the current canonical day-key convention. For **local-day correction boundaries**, compute `startOfDay` and `startOfNextDay` in the app's configured timezone in TypeScript, convert both to ISO UTC, then query with `timestamp >= ? AND timestamp < ?`. Do not assume every local day is exactly 86,400,000 ms in zones with daylight-saving changes. The invariant bounds total *credited duration* to 86,400,000 ms; start/end boundaries must use the real local day. The app must display the timezone/day key used by the correction.

## 3. The Prediction Algorithm (with the actual math)

### 3.1 Separate “correct the total” from “fill missing time”

Both can use the same sessionisation engine, but they are different intents:

- `reflow_corrected_total`: fit a user-selected total for a specific app/site/day into plausible, unoccupied intervals.
- `fill_missing_time`: assign a previously empty detected gap among candidate activities.

Do not feed an “app should have had 4h total” correction into the gap-fill writer without explicit user selection. Predictions are advisory until the user reviews and commits.

### 3.2 Build a clean reference set

For target app `a`, profile `p`, day `d`, form history `H(a,p)` from the prior 56 days, excluding target day and all records that cannot be trusted:

- only `source='auto'` records for the initial training version;
- same `app`/website identity, profile, platform and browser-tracking class;
- valid ISO timestamps and positive duration;
- wholly inside their assigned historical local day;
- not overlapping another canonical exclusive interval;
- reject daemon-cap-sized 3,600,000 ms rows on known corrupt timestamps/days and rows adjacent to a recorded long polling gap;
- exclude manually assigned and corrected rows so a correction does not train on its own predictions;
- reject or down-weight days whose total timeline duration exceeds 24 h or whose overlap audit fails.

Keep an exclusion reason for every removed sample for diagnostics. If fewer than 3 clean days or 5 sessions survive, mark the model as low-data rather than pretending the output is learned.

### 3.3 Estimate total time for an initial recommendation

The user's slider is authoritative. The model's default recommendation is a review aid:

1. Calculate clean historical daily totals `D_j` for app `a` on eligible days. Prefer same weekday; if fewer than 4 same-weekday days exist, use all eligible days.
2. Let `T_hat = median(D_j)`; robustly trim only impossible days according to §3.2, not plausible high-usage days.
3. Bound `T_hat` to `[0, capacityMs]`, where `capacityMs` is the duration of valid free intervals remaining after removing the target app/day's old rows and subtracting all other occupied rows.
4. Show `T_hat` with the number of reference days, uncertainty/confidence, and a statement that it is a suggestion. Do not auto-commit it.
5. With no clean history, **do not show a fabricated recommended number**. Start at the bounded recorded total only if it is sane; if the stored total is greater than capacity/day bounds, start at an explicitly labelled safe proposal `min(capacityMs, 0)` only as a neutral baseline and require the user to set/confirm the intended total. Prefer an empty/required numeric target over silently normalising corrupted data.

For a row total of 139 h, never initialise the slider to 24 h and make it look correct. Present `Recorded: 139 h (invalid)` separately from `Capacity: ...` and `Suggested correction: ...` or `No reliable suggestion`; require deliberate review.

### 3.4 Historical timing distributions

For each clean sample session record:

- duration `d_i` in milliseconds;
- local start-time minute-of-day `m_i`;
- 24-bin local start-hour histogram `S_h`;
- a 288-bin 5-minute usage profile `U_b`, calculated from interval overlap with each local-day bin, not just the starting hour;
- inter-session gap values between successive sessions of the same app;
- weekday identity.

Use Laplace smoothing for start hour:

`P_start(h) = (S_h + 1) / (sum_{k=0..23} S_k + 24)`

Use duration empirical distribution rather than assuming a normal distribution. Sample its sorted quantiles deterministically, with a seed derived from `app + dayKey + targetMs + algorithmVersion + previewNonce`, so the same preview is stable and a new preview can explore another valid arrangement. Never send raw timestamps or app titles to a remote service; the predictor is local.

### 3.5 Choose a plausible session count

Use these version-1 bounds:

```text
MIN_SESSION_MS = 6_000          // whole-second minimum safely exceeds the writer's >5s threshold
MAX_SESSION_MS = 7_200_000      // 2 hours; same order as the app's MAX_SESSION_MS
MAX_SESSIONS_PER_APP_DAY = 120
```

Targets are whole seconds because `manual_time_assignments.duration_seconds` is integer. Valid targets are `T=0` or `T >= 6_000` with `T % 1_000 === 0`; reject a positive target below six seconds rather than creating a row that one of the current writers would discard. For target `T > 0`, let `d50` be the weighted median of clean historical session durations. If history is unavailable, use a 25-minute conservative default only as a *starting template*, and label confidence “Low — insufficient history”. Calculate:

`N0 = round(T / d50)`

`Nmin = ceil(T / MAX_SESSION_MS)`

`Nmax = min(MAX_SESSIONS_PER_APP_DAY, floor(T / MIN_SESSION_MS))`

If `T = 0`, `N=0`. Otherwise require `Nmin <= Nmax`, then `N = clamp(N0, Nmin, Nmax)`. If no feasible `N` exists, reject the preview instead of inventing impossible sessions. For the maximum 24 h target, the configured 2 h cap requires at least 12 sessions, which remains below the 120-session ceiling.

Sample `N` duration weights `w_i` from the app's empirical session-duration distribution, preserving relative session lengths but not forcing sampled sessions to have the original sum. With no usable history, use deterministic 25-minute templates and a low-confidence even schedule.

### 3.6 Allocate the target total exactly

This constrained proportional allocation makes all session durations integer milliseconds and guarantees the sum equals `T`:

Allocate in integer **seconds** so the generated `logs.duration_ms` and `manual_time_assignments.duration_seconds` agree exactly. Let `T_s = T / 1000`, `L_s = MIN_SESSION_MS / 1000`, `U_s = MAX_SESSION_MS / 1000`, and `R = T_s - N*L_s`. If `R < 0` or `T_s > N*U_s`, reject/adjust `N` before continuing.

Initial weights: `q_i = max(1, w_i)` and `Q = sum(q_i)`. Start each duration at `L_s`. Distribute remaining duration by weighted water-filling:

```text
active = {1..N}
remaining = T - N*L
while active is not empty and remaining > 0:
    Q = sum(q_i for i in active)
    for i in active:
        share_i = remaining * q_i / Q
    saturated = {i in active where share_i >= U_s - duration_i}
    if saturated is not empty:
        for i in saturated:
            add U_s - duration_i to duration_i
            subtract that amount from remaining
            remove i from active
        continue
    for i in active:
        exact_i = share_i
        base_i = floor(exact_i)
        duration_i += base_i
    remaining -= sum(base_i)
    distribute remaining one second at a time to active items in descending
      (exact_i - base_i), ties by stable session index, skipping any at U
    break
```

After allocation, assert `sum(durationSeconds_i) === T_s`, and every duration is in `[L_s,U_s]`. Convert each to `durationMs_i = durationSeconds_i * 1000`; assert `sum(durationMs_i) === T` and `durationMs_i === manual_time_assignments.duration_seconds_i * 1000`. The remainder distribution is deterministic. If any bound fails, fail preview generation as a programmer/data error and do not offer commit.

### 3.7 Place sessions without overlap

1. Construct the target local day's timeline as `[dayStartMs, nextDayStartMs)`.
2. Remove all existing rows belonging to the app/profile/day being corrected from the occupied set; they are what the correction replaces.
3. Treat every other canonical usage interval as fixed occupancy. Sort by `(startMs, endMs, id)` and calculate its complement inside the day, producing free intervals.
4. `capacityMs = sum(freeInterval.length)`, with intervals shorter than the configured minimum excluded from placement capacity. Set slider max to this capacity and reject any target greater than it.
5. Sample a preferred start time for each session from a clean same-weekday historical session. If unavailable, sample bins according to `P_start(h)`. Sort candidates by preferred start, then stable ID.
6. For each candidate, find a free interval that can fit its allocated duration. Score feasible placements with:

   `score = -ln(P_start(hour(start))) + 0.25 * abs(startMs - preferredStartMs)/3_600_000 + 0.10 * abs(startHour - priorHourMedian)`

   Choose the lowest score; break ties by earliest start. If exact placement fails because free intervals are fragmented, split the candidate into contiguous pieces only at free-interval boundaries, then rerun §3.6 across the resulting pieces. Each piece must meet `MIN_SESSION_MS`; if the exact target cannot be packed under the minimum/maximum/session-count constraints, mark prediction unavailable and ask the user to lower the target or resolve neighbouring occupancy. Never overlap or move another app's session automatically.
7. Align starts/ends to historical minute patterns only if a whole-minute move remains inside the free interval. Otherwise preserve millisecond precision from interval bounds. Snapping must not change the total duration.
8. Return sorted segments `{startMs,endMs,durationMs,confidenceContribution,explanation}`. Assert each `durationMs=endMs-startMs`, sum equals `T`, all segments fit the day, and no segment intersects occupancy or another generated segment.

This is a constrained scheduling operation, not a claim that the model knows the exact moments of the corrupted usage. The preview must say that session timing is reconstructed, while the target total is exact.

### 3.8 Confidence

Calculate three transparent terms:

```text
C_days = min(1, cleanDistinctDays / 20)
C_sessions = min(1, cleanSessions / 40)
C_fit = exp(-medianLeaveOneDayOutNormalizedAbsoluteError)
confidence = clamp(0.35*C_days + 0.25*C_sessions + 0.40*C_fit, 0, 1)
```

`medianLeaveOneDayOutNormalizedAbsoluteError` is the median across eligible reference days of `abs(predictedDayTotal - actualDayTotal) / max(actualDayTotal, 60_000)`, capped to `[0,5]` before exponentiation. If fewer than 3 clean days exist, cap confidence at `0.35`; if no clean sessions exist, confidence is `0`.

Display both the label and the reason, not only a coloured bar:

- `High` ≥ 0.80: “Strong history: X clean days, Y sessions”.
- `Medium` ≥ 0.55: “Some history: X clean days, Y sessions”.
- `Low` < 0.55: “Weak estimate — review each session”.
- `Unavailable`: no feasible schedule, no capacity, or invalid/corrupt inputs.

Confidence describes timing/session shape, not certainty about the user's intended total. The user-selected total is always exact and user-owned.

### 3.9 Reuse/extend/retire existing prediction code

- **Reuse:** `detect-usage-gaps` and `compute-adjacent-gaps` to identify candidate free spans and nearby existing rows; extend the returned model with `availableCapacityMs`, overlap diagnostics and explicit timezone/day bounds.
- **Reuse and connect:** `predict-day-gaps` in `src/main.ts:31473` and its existing preload bindings. Reconnect `useGapPredictions.ts` to the consolidated fill-gaps mode. Do not leave the hook unreachable.
- **Extend:** create a pure `predictSessionReflow()` module for per-app/day corrected-total reconstruction. Keep it separate from gap fill at the API boundary but reuse cleaned history and allocation utilities.
- **Reuse:** `manualBackfill.ts` as a pure helper where its existing behavior exactly matches the required span construction; do not rely on it for DB writes.
- **Retire only behind approval:** dead `GapFillModal`/`GapFillDrawer` components and their nonexistent `predictGapFill`/`confirmGapFill` API calls. They are not the engine to revive.

## 4. Safety, Undo & Reversibility

### 4.1 Preview before every write

Preview is mandatory. It shows:

- app/site, profile, local date and timezone;
- raw recorded total and the anomaly badge if it exceeds the day or overlaps other rows;
- target total, delta (`recorded → corrected`, signed ms + human-readable duration);
- history sample counts, confidence and why samples were excluded;
- original vs proposed timeline on the same 24-hour axis;
- every proposed session's start, end, duration, and provenance `corrected`;
- neighbouring occupancy that blocks placement;
- exact count of rows to update/delete/insert and which aggregate windows will be rebuilt.

Nothing writes while dragging. On release, calculate preview locally in a pure function and request a fresh main-process validation preview. The main process is authoritative and recomputes against the database, not a renderer-supplied arbitrary list of sessions.

### 4.2 Commit contract

Preview returns `previewId`, `baselineHash`, `targetTotalMs`, `algorithmVersion`, `expiresAt`, and proposed intervals. `commitCorrection` must reject if:

- preview expired;
- any target rows or occupied neighbour rows changed;
- `baselineHash` no longer matches;
- proposed total differs from requested target;
- any segment is out of day, overlapping, too short/long, or collides with another interval;
- total exceeds capacity or 24 h;
- confidence metadata is malformed;
- a source or row ID was changed by the renderer.

Then re-plan on main process within the same serialized DB write queue and transaction. Use an idempotency key to prevent double-click/double-IPC duplication.

### 4.3 Transaction and undo

`BEGIN IMMEDIATE` and in one transaction:

1. verify baseline and validate schedule again;
2. insert a `time_correction_batches` row in `state='applied'`;
3. insert before snapshots into `time_correction_items` before each changed row;
4. update/reuse existing target log rows; delete excess target rows only after snapshots are stored; insert additional target rows with `source='corrected'`;
5. maintain one linked `manual_time_assignments` row per output segment (write/update `logs` first, then assignment, consistent with existing convention);
6. run/trigger hourly, daily, per-app and manual-stat recomputation for every affected old and new bucket;
7. run interval and aggregate invariants against the transaction's result;
8. if any assertion fails, `ROLLBACK`; otherwise commit.

Any row outside the selected app/day is immutable during correction. If its overlap means the requested target cannot fit, preview is unavailable; do not “fix” other rows silently.

Undo is whole-batch, single action, and atomic. For `inserted`, delete the generated log/assignment. For `updated`, restore before snapshots. For `deleted`, recreate the original log with its original ID and restore linked assignment. Restore aggregates and verify invariants before commit. Mark batch `undone`; retain ledger. Disallow undo if later corrections depend on the batch or those rows have been edited since; offer a new correction instead of overwriting newer work. Define a redo as creating a new batch from the same proposal, not mutating history.

### 4.4 Protect real data

- Always show original values and a row-count diff before apply.
- Keep a persistent Undo entry in the success state and in the day's correction history.
- Destructive confirmation is only needed when deleting/truncating existing sessions or when a correction changes more than a configured threshold (default: `>50%` of the recorded total or deletes `>5` rows). It must state exact counts/durations.
- Never auto-correct other apps, other days, manually authored rows, or a user's already-corrected rows.
- Reject stale previews with a clear conflict message and preserve user's slider value so it can be previewed again.
- If a raw session is later deleted manually, keep the correction ledger. Mark the batch `orphaned` in diagnostics (add the state via migration, or store an `orphaned_at` column); do not silently recreate the deleted session from a routine refresh. Undo reports which row is now missing and offers a guarded restore from snapshot.
- Keep a backup/export of the ledger with the normal DB backup. Never send app history to cloud prediction.

## 5. Sleep / Suspend / Shutdown Handling (both writers)

### 5.1 Daemon exact feed/flush fix

Refactor `flush` to accept an explicit endpoint. It must never derive an endpoint from `lastPollMs` implicitly.

```js
const SLEEP_GAP_MS = 5 * 60_000;
let lastPollAttemptMs = 0;
let lastSuccessfulObservationMs = 0;
let trackingPaused = false;

function flush(reason, endedAtMs) {
  if (!open) return;
  const session = open;
  const end = Number.isFinite(endedAtMs) ? endedAtMs : lastSuccessfulObservationMs;
  open = null; // clear before commit so re-entrant code cannot double-write
  if (!Number.isFinite(end) || end <= session.startedAtMs) return;
  const durationMs = end - session.startedAtMs;
  if (durationMs < 5_000) return;
  // No sleep-gap cap may be applied to manufacture a 60-minute row.
  // Normal max-session segmentation belongs in the live tracking path.
  const ok = commitLog({
    timestamp: new Date(session.startedAtMs).toISOString(),
    app: session.app, category: session.category,
    duration_ms: durationMs, title: session.title,
    is_browser_tracking: 0, platform: 'linux', source: 'auto'
  }, { timestamp: new Date(session.startedAtMs).toISOString(),
       app: session.app, category: session.category,
       duration_ms: durationMs, is_browser_tracking: 0 });
  if (ok) recordFlushSuccess(session, durationMs, reason);
  else warnFlushFailure(session, durationMs, reason);
}

function feed(result) {
  const now = Date.now();
  const wallGap = lastPollAttemptMs === 0 ? 0 : now - lastPollAttemptMs;

  // IMPORTANT: detect the gap BEFORE updating lastPollAttemptMs.
  if (!trackingPaused && open && wallGap > SLEEP_GAP_MS) {
    flush(`sleep gap ${Math.round(wallGap / 1000)}s`, lastSuccessfulObservationMs);
    warn(`detected ${Math.round(wallGap / 60000)} min gap; excluded unobserved time`);
    nullPolls = 0;
    if (afkState === 'afk') afkState = 'active';
  }
  lastPollAttemptMs = now;

  // Caller must distinguish a successful “no foreground app” result from a failed poll.
  if (!result || result.ok !== true) return;
  lastSuccessfulObservationMs = now;
  if (trackingPaused) return;

  const observed = result.observation; // null means a successful observation of no trackable app
  if (!isTrackable(observed)) {
    if (open) flush('no trackable foreground app', lastSuccessfulObservationMs);
    open = null;
    return;
  }

  if (!open) open = makeOpenSession(observed, now);
  else if (!sameIdentity(open, observed)) {
    flush('foreground changed', now); // current observation makes this boundary known
    open = makeOpenSession(observed, now);
  }
}
```

**Integration gate:** the bundle does not show the poller's caller contract. Change the call site so a transport/OS error is `result.ok=false`, while a successfully observed desktop with no trackable foreground is `{ok:true, observation:null}`. If the existing poll path currently maps both cases to `null`, locate and change that mapping before deploying this code. Never count a failed observation as successful merely to move a clock.

Additional daemon rules:

- Update `lastSuccessfulObservationMs` on every successful observation, including a verified no-app result. Do not update it for exceptions, unavailable X11/tool output, malformed payloads, or timeout.
- On a normal foreground transition, close the previous session at the successful observation time, then start the next at that same instant. Half-open intervals prevent overlap.
- On a gap `> SLEEP_GAP_MS`, close at `lastSuccessfulObservationMs`, clear the open session, and only start a new one from a fresh successful post-gap observation. Do not backfill the gap.
- Remove `MAX_LOGGED_SESSION_MS = 60 min` from the sleep-gap path. It hides the bug as a plausible one-hour lie. Keep normal `MAX_SESSION_MS` segmentation for actively observed continuous sessions.
- On daemon start, initialise both clocks to zero, keep `open=null`, and require the first successful observation before starting a session. Never restore a persisted open session and bridge the offline span.

### 5.2 Electron app writer

Keep and probe the existing app-level gap branch in `src/main.ts` around 6355–6385. Apply the same ordering rule: compute `timeSinceLastPoll` first, detect a gap, flush `lastSuccessfulObservationTime - sessionStart`, reset the session, then establish a new baseline only after a fresh successful poll. Normal foreground changes close at the current successful observation, not at a previously failed poll.

Add one shared pure helper where practical, e.g. `computeSafeSessionEnd(startMs, lastSuccessMs, maxEndMs)`, and use it in both writer probes. The daemon is a separate deployed JS file, so if it cannot import the TypeScript module, mirror the short pure logic and keep the same test vectors.

### 5.3 Event handling and honest guarantees on KDE/Linux

- **Electron `powerMonitor` `suspend` / `resume`:** subscribe in the app main process and flush at `lastSuccessfulObservationTime` when `suspend` arrives; stop/ignore polls while paused; after `resume`, reset polling baselines and require a fresh successful observation before opening a new session. Verify `suspend` delivery on the installed Electron build under KDE. Do not make it the only protection.
- **Shutdown:** Electron documents `powerMonitor`'s `shutdown` event on Linux and macOS. In the handler synchronously stop polling, flush at the last successful observation, commit SQLite, and close the DB cleanly. Do not wait for asynchronous renderer work or prevent system shutdown for a cosmetic prompt. A forced power cut, process kill, crash, or non-cooperative shutdown may not deliver it.
- **Lock screen:** Electron documents `lock-screen` for macOS/Windows, not Linux. On KDE, use the existing/available `org.freedesktop.login1` session lock/unlock signal path if present in the daemon/app environment; pause at the last successful observation on lock and reopen only after unlock plus a fresh observation. Verify the exact D-Bus signal and session path on the machine before shipping; do not claim Electron provides a Linux lock event.
- **Daemon:** the daemon must implement the same suspend/lock pause semantics if its current environment can receive the corresponding system event. Prefer a verified `org.freedesktop.login1` `PrepareForSleep(true/false)` integration, using a bounded delay inhibitor only if necessary to ensure a synchronous SQLite flush completes. Release any inhibitor immediately after committing. The normal sleep gap detector remains the authoritative fallback when the event is absent.
- **Shutdown cannot be guaranteed for every failure:** hardware power loss, battery depletion, kernel crash, SIGKILL, or power-monitor event loss may prevent a final flush. The contract is still safe because persisted usage ends at the last successful sample, not at restart time; after restart the gap detector never fills the unobserved interval.
- `powerMonitor.getSystemIdleTime()` returns `0` in the observed Linux environment. It must not participate in sleep inference, AFK recovery, or any session endpoint. Use sample-success timestamps and foreground-change/renderer input fallbacks where they already exist.

### 5.4 No-overlap enforcement in both writers

At write time, use half-open intervals and a serialized DB write queue. Before commit, compare the proposed start/end against the prior and next canonical rows. Normalise starts and ends to the observation boundary. If another row already occupies the interval, fail the write or clip only an automatically observed interval using a documented source precedence; never overlap silently. Add a start/end invariant query in the periodic data-health probe and a repair preview for existing corrupt rows.

Use these canonical priority rules for an anomalous overlap only after verifying browser rows are intended to be exclusive: user-authored `manual` / `corrected` rows are immutable and highest priority; observed `auto` rows are lower priority and can be bounded to free time only through an explicit repair preview. Never run a destructive global auto-truncation on launch.

## 6. The Consolidated UI (component tree, exact tokens, exact values)

### 6.1 One surface, three task modes

```text
TrackingTimeDialog (single owner, one open instance)
├─ Header: “Tracking time” + selected local date/timezone
├─ Tabs
│  ├─ Correct recorded time
│  │  ├─ DayAppSummary
│  │  ├─ AppSelector / searchable app+website list
│  │  ├─ RecordedVsTargetSummary
│  │  ├─ TotalDurationSlider + exact numeric input
│  │  ├─ SessionReflowPreview (24-hour timeline + session table)
│  │  ├─ ConfidenceAndEvidence
│  │  └─ PreviewDiff / Apply correction / Cancel
│  ├─ Fill gaps
│  │  ├─ GapQueuePanel (reuses current queue semantics)
│  │  ├─ GapPredictionPanel (predict-day-gaps)
│  │  └─ Assign gap / confirm / skip
│  └─ Add manual time
│     ├─ one-span input OR “distribute across range” generator
│     └─ common manual-assign:* preview and commit
└─ Footer: Undo last correction / correction history / Close
```

Tabs share one modal shell, date selection, app picker, error boundary, focus trap, and commit feedback. Entry points may select a default tab, but must not mount parallel time-editing modals.

### 6.2 Exact dimensions and grid

Dark-only desktop developer-tool modal, responsive to the Electron window:

- default width `960px`; max width `min(1120px, calc(100vw - 48px))`;
- max height `min(760px, calc(100vh - 48px))`; min height `560px` where viewport permits;
- header `56px`, tab bar `44px`, footer `64px`; scroll only in body;
- body padding `16px`; layout: left app list `240px`, gap `16px`, main panel `minmax(0, 1fr)`;
- below `820px` viewport width, app picker collapses to a `240px` top selector and content becomes one column;
- panel padding `12px`; section gap `16px`; row gap `8px`; inline gap `8px`;
- input and button height `36px`; destructive confirm height `40px`; hit target minimum `36×36px`;
- radii only `8px`, `12px`, and pill. Dialog radius `12px`; panel `8px`; badges and slider thumb pill/circle.

Do not resize app shell or rewrite other pages to make room; the dialog scrolls internally. Keep the existing StatsPage per-row editor available via the correction system's detailed session action until migration parity is verified.

### 6.3 Colour and typography (token-only)

Use the source token values exactly; no additional raw hex:

| Role | Token | Value from context |
|---|---|---|
| base surface | `--ws-surface` | `#09090b` |
| raised pane | `--ws-surface-raised` | `#18181b` |
| hover surface | `--ws-surface-hover` | `#27272a` |
| default border | `--ws-border` | `rgb(39 39 42 / 0.6)` |
| strong border | `--ws-border-strong` | `rgb(63 63 70 / 0.6)` |
| sole signal / active slider | `--ws-accent` | `#06b6d4` |
| normal text | `--halo-text` / existing foreground token | `#fafafa` only if the Halo theme is intentionally reused; otherwise use the app’s registered foreground token |
| muted text | `--halo-muted` / existing muted token | `#a1a1aa` only if Halo theme is reused; otherwise use the app’s registered muted token |

**Colour rule:** one signal hue per surface (`--ws-accent`). Do not colour each app identity, prediction confidence, or delta in a different hue. Use icons, text, border style, and sign (`+`/`−`) for semantic differences; selected/interactive state alone uses accent. No gradients, glass, glow, or colored identity stripes.

- Inter: body and controls, `13px/18px`, weight `400`; section headers `14px/20px`, weight `600`; dialog title `16px/22px`, weight `600`.
- JetBrains Mono: all duration numbers, slider readout, ISO/local clock values, percentage/deltas, `12px/16px` or `14px/20px` for the main target. Use tabular numerals.
- Space Grotesk optional for section labels only, but do not load it into this view if Inter + JetBrains Mono are already used; max 2 families per view.

### 6.4 Total slider

Use existing `src/components/ui/slider.tsx` backed by installed `@radix-ui/react-slider`. Do not add a dependency.

- Height: track `4px`; active portion `4px` in `--ws-accent`; inactive track `--ws-surface-hover` with `--ws-border` outline.
- Thumb visual: `16×16px`, `2px` solid `--ws-accent`, `--ws-surface` fill; focus ring `2px` `--ws-accent` with 2px offset. Do not scale on hover.
- Pointer hit area: at least `32×32px` around the visual thumb, without inflating the visual size.
- Main scale range: `0..capacityMs` in `60_000ms` steps; include ticks every hour where width permits, 25%, 50%, 75% marks, and a `24h` endpoint. Numeric input permits exact minutes and seconds; normalise to whole seconds for user-authored totals, preserving milliseconds in existing untouched rows.
- Always show `Recorded 4h 25m → Target 3h 10m` plus signed `−1h 15m`. Do not update the database while the user drags.
- If stored total exceeds 24h/capacity, show the raw total outside the slider. The slider does not compress or misrepresent the invalid number.
- Snap to a minute on pointer/keyboard release; holding Shift nudges by 1 second; numeric input is the exact alternative. Arrow Left/Right adjusts one minute; PageUp/PageDown adjusts 15 minutes; Home/End go to min/max. Prevent any value above available capacity.

### 6.5 Session timeline and per-session handles

Do **not** render 200 dual-thumb ranges on the same track. That creates colliding handles and inaccessible hit targets. Use:

- one 24-hour overview bar, `40px` tall, with a tick every `3h`, neutral occupied zones, selected-app original segments, and proposed segments. Short sessions get a minimum `3px` display mark (display-only; never alters timestamps). All actual session rows remain in the table below.
- a session table with virtualisation after 40 rows; columns `Start`, `End`, `Duration`, `Confidence/evidence`, `Source`; rows min height `36px`, gaps `4px`.
- one selected session editor at a time. Its own start/end control is a two-thumb Radix slider constrained to the day, rendered on a separate `32px`-high track. The start and end handles use identical visuals, but the active thumb is outlined. Enforce `end - start >= MIN_SESSION_MS`, day bounds, and no overlap with adjacent sessions. Other sessions appear as passive tick markers, not active thumbs.
- collision avoidance: handles under `24px` apart get an automatic vertical label placement (label above/below, never over the handle); keyboard focus can cycle every selected session; pointer hit zones remain at least `32px`. If two actual times are closer than the minimum track hit area, do not put both active handles in the overview: select the session in the table first.
- manual refinement changes a session boundary/duration; recompute total and show the delta immediately. The editor must explain whether a change will shift an adjacent session or reduce the app total. Default mode never silently shifts another app's session.

### 6.6 Confidence overlay before commit

Show predicted intervals as outlined accent shapes and original intervals as neutral-filled shapes; no translucent glass or glow. Beside it show `High / Medium / Low / Unavailable`, `X clean days · Y clean sessions`, and one sentence explaining low confidence. Patterned hatch/solid/dashed border distinguishes observed, predicted, and manually fixed intervals without relying on color alone. The exact selected total remains a prominent numeric readout; confidence applies to *where* sessions are placed.

### 6.7 States

- **Loading:** static neutral blocks matching app list, total slider, timeline and rows. No shimmer; do not invent totals.
- **Empty day:** `No tracked sessions on this day.` Show `Add manual time` and `Fill gaps` actions; do not show fake zero rows.
- **Empty app history:** `No reliable history for this app. Set the total manually; the split will use a low-confidence default.`
- **Prediction unavailable:** `Could not place this total without overlapping other sessions.` Show available capacity and blockers; do not show Apply.
- **Error:** `Could not load tracking data.` / `Could not save correction.` with Retry only if the same verified IPC path can be retried; preserve input and preview state.
- **Populated:** recorded total, editable target, preview, history basis, proposed row diff, Apply and Cancel.
- **Conflict:** `Tracking data changed since this preview. Review the refreshed timeline before applying.` Keep the target value but discard the stale plan.
- **Success:** `Correction saved` with `Undo` as primary secondary action and `View changes` detail.

### 6.8 Motion

Use `motion` v12 only. For dialog/tab/panel transitions use `var(--ws-dur)` (`150ms`) and `var(--ws-ease)` (`cubic-bezier(0.2, 0, 0, 1)`). No spring or bounce. Never animate numbers through intermediate fictitious totals. Under `prefers-reduced-motion: reduce`, transitions become `0ms` and the preview swaps immediately. Slider tracking itself has no delayed animation.

## 7. The Correction Flow (step by step, incl. keyboard + accessibility)

1. User opens **Tracking time** from the app header, ActivityPage, StatsPage or a detected gap. The call includes `initialMode`, `dayKey`, optional app and optional gap ID.
2. Header opens the current local day by default. The body loads app/day totals and anomaly flags. The user can search apps/websites in the left list; totals are sorted by greatest anomaly, then largest recorded duration.
3. Selecting an app shows raw total, number of rows, `source` composition, overlap flags, available free capacity, and previous correction history. Raw data stays visible.
4. User drags `TotalDurationSlider` or edits the exact numeric field. Live UI updates target/delta only; pointer move never writes SQL and does not call prediction IPC on every pixel.
5. On pointer release (or after a debounced 150ms after keyboard/numeric entry), ask the main process to generate/validate a preview. Keep the preview deterministic until the user selects `Regenerate arrangement`.
6. User examines the target and proposed session split. Selecting a proposed segment reveals its exact times and evidence. Optional manual session adjustment is available one segment at a time. Main process revalidates after each accepted change.
7. Apply opens an `AlertDialog` only if the row-diff safety threshold is exceeded or rows will be deleted. Confirmation states exact counts and durations. Otherwise the user can commit directly after reviewing preview.
8. Main process verifies baseline hash, runs transaction, verifies no overlap and aggregate invariants, commits, and returns new totals and batch ID. If the write fails, rollback; keep the slider/preview for retry and show the error.
9. Success shows `Undo correction`. Undo restores the whole transaction from ledger or refuses safely if later edits mean it is stale.
10. Gap-fill entry points open the same shell on `Fill gaps`; manual entry opens `Add manual time`. Sleep detection can open the shell at the correct gap but does not mount a second full editor.

### 7.1 Entry points and label consolidation

- App header `Smart Fill` → replace with **`Tracking time`**; tooltip: `Correct recorded time, fill gaps, or add manual time`.
- External page `Smart Fill` → rename to **`Fill gaps`** and open the unified dialog at `Fill gaps`; tooltip must describe gap prediction/assignment only.
- ActivityPage `Manual time` and `Fill a range` → both open the same unified dialog, selecting `Add manual time` and its one-span/range submode as appropriate. Do not mount `ManualAssignModal` and `ManualFillModal` simultaneously.
- TrackingCoverage `Fill now` → open unified `Fill gaps` and select the specific gap/queue item instead of bypassing the queue into `ManualFillModal`.
- StatsPage row edit → expose `Correct session` in the unified dialog/detail panel. Retain existing row edit until the new path has parity and probe coverage; do not remove silently.
- `GapsListModal` becomes the list panel inside `Fill gaps`; `AfkPromptModal` remains the auto-prompt/queue entry adapter but must render the same gap panel, not a competing implementation. `MissedTimePanel` is reused within that shared panel.
- `SleepDetectionModal` remains a minimal event summary only; its primary CTA opens the same unified gap queue, not a separate gap editor.

### 7.2 Keyboard, screen reader, accessibility

- Modal focus order: title/close → date → tabs → app search → app list → target readout/input → total slider → timeline segment selector → selected segment controls → preview diff → Apply/Cancel → Undo/history.
- `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` (`3 hours 10 minutes`), labelled-by app/day and described-by target delta. The selected session start/end controls get distinct labels and ranges. Avoid assigning a fake ARIA `slider` to the overview timeline.
- Announce on release, not every mouse pixel: `Target time 3 hours 10 minutes. Decrease of 1 hour 15 minutes. Preview has 6 sessions. Confidence medium.`
- Screen reader announces confidence as text plus sample counts; never colour-only. Each timeline row has accessible text, e.g. `Predicted session 2, 10:15 to 10:47, 32 minutes, low confidence`.
- Every drag operation has a numeric-input path. Arrow keys change by 1 minute; Shift+Arrow by 1 second; PageUp/PageDown by 15 minutes; Home/End by bounds. Escape cancels the current edit if not committed; Escape in a stale preview closes only after preserving the pending target.

### 7.3 Large/edge states

- **Empty day:** keep all modes available; use no fake data and no zero-valued session rows.
- **One session:** total slider plus one row; can shorten to zero (delete only after confirmation) or increase if free capacity exists.
- **200 sessions:** virtualise list after 40 visible rows; only one session's two handles are interactive at a time. The total slider and overview remain constant cost. Never create 400 active DOM thumbs.
- **Mid-correction:** all changes are ephemeral until commit; stale context triggers a new preview, not a silent overwrite.
- **Failed write:** transaction rollback, inputs retained, safe retry, no optimistic “saved” state.
- **Unavailable predictor:** user can manually set total and choose a simple low-confidence schedule; explicit label and exact preview remain mandatory.

## 8. Backend Specification (IPC channels, handler signatures, SQL)

### 8.1 Proposed IPC boundary

Keep the naming style and result/error wrapper of existing `manual-assign:*`/nearby app APIs. The supplied bundle does not include the canonical generic result wrapper's full TypeScript definition, so the implementer must mirror the exact adjacent handler/preload convention rather than introduce a new incompatible wrapper.

Proposed typed calls (names can follow the established naming namespace, but semantics must stay):

```ts
type CorrectionMode = 'corrected-total' | 'fill-gap' | 'manual-time';
interface TrackingDayQuery { dayKey: string; timezoneId: string; profileId?: string; }
interface AppDaySummary extends TrackingDayQuery {
  app: string; recordedTotalMs: number; rowCount: number;
  sourceCounts: Record<string, number>; overlapFlags: number;
  capacityMs: number; recommendedTotalMs: number | null;
  confidence: number; cleanDays: number; cleanSessions: number;
}
interface PreviewRequest extends TrackingDayQuery {
  app: string; targetTotalMs: number; previewNonce: string;
  expectedBaselineHash?: string; // present when refreshing an existing preview
}
interface ProposedSession { startIso: string; endIso: string; durationMs: number; evidence: 'history'|'fallback'; confidence: number; }
interface CorrectionPreview {
  previewId: string; baselineHash: string; expiresAtIso: string;
  recordedTotalMs: number; targetTotalMs: number; deltaMs: number;
  capacityMs: number; confidence: number; cleanDays: number; cleanSessions: number;
  proposedSessions: ProposedSession[];
  diff: { updateCount: number; deleteCount: number; insertCount: number };
  warnings: string[];
}
interface CommitCorrectionRequest { previewId: string; baselineHash: string; idempotencyKey: string; }
interface UndoCorrectionRequest { batchId: number; }
```

Operations:

- `tracking-time:list-day-apps(query)` → summaries, including anomaly/capacity and a nullable recommendation.
- `tracking-time:preview-correction(request)` → deterministic preview plus diff; read-only.
- `tracking-time:commit-correction(request)` → batch ID, actual summary, row diff, undo availability.
- `tracking-time:undo-correction({batchId})` → restored summary or a structured conflict.
- `tracking-time:list-corrections(query)` → batch history/status.
- Existing `predict-day-gaps` remains the gap-fill prediction API. Extend its response with a versioned schema only if current callers remain backward-compatible; do not repurpose it for corrected totals.

Main process must validate all user-provided dates, app strings, profile IDs, target bounds and session arrays. The renderer sends intent/target, not trusted timestamps to write. The main process reconstructs the proposed plan and owns every DB write. Every handler returns errors in the app's existing wrapper and logs the detailed error only in the main process.

### 8.2 Existing write convention

For manual/generated rows, preserve the verified ordering: write `logs` first so insert triggers run, then insert `manual_time_assignments` using `logInfo.lastInsertRowid`, then call the existing `syncManualStats(dayKey)` and `recomputeAppAggregate(dayKey, app)` helpers where appropriate. Corrections also UPDATE or DELETE existing rows, so those existing insert triggers alone are insufficient.

### 8.3 Aggregate maintenance after UPDATE/DELETE

The current `trg_update_hourly` and `trg_update_daily` fire `AFTER INSERT`. SQLite triggers fire only for their specified event, so an UPDATE does not invoke them. Implement explicit maintenance for old and new aggregate keys in the same transaction.

**Do not invent column names for `stats_hourly` or `stats_daily`: their CREATE TABLE and trigger bodies are not present in this context bundle.** During implementation, query `sqlite_master` and copy the exact aggregation formulas from the current INSERT triggers. Then implement equivalent UPDATE and DELETE logic:

- `AFTER UPDATE OF timestamp, app, category, duration_ms, is_browser_tracking, profile_id, source ON logs`: remove the OLD contribution from its old bucket and add NEW contribution to its new bucket; if both map to same bucket, update the delta once. If trigger SQL adds counters/rollups besides duration, maintain each exactly.
- `AFTER DELETE ON logs`: subtract OLD contribution and remove empty bucket rows as the existing query contract requires.
- If any affected aggregate uses a non-additive metric, prefer recomputing that exact bucket from `logs` rather than a blind subtract/add.
- Preserve timezone/day bucketing semantics; any ISO text date filtering uses `substr(timestamp,1,10)` for the existing UTC date key or explicit ISO range bounds for local-day correction. Never use `date(timestamp,'unixepoch')`.
- Assignment side effects: after correction commit, call `syncManualStats(dayKey)` and `recomputeAppAggregate(dayKey, app)` inside the transaction if they are transaction-safe; otherwise move their implementation into a synchronous transaction-aware helper. Do not emit success until all summaries agree.
- Migration probe compares hourly, daily, manual, and app aggregates before/after a no-op correction. A no-op must leave aggregate values unchanged.

If adding SQL triggers is unsafe because the old bodies have side effects that cannot be reversed cleanly, use a deterministic transaction helper that fully recomputes affected buckets from canonical `logs` using the same group-by expressions as the existing triggers. Pick one maintenance implementation only; do not both subtract/add in triggers and recompute the same bucket independently.

### 8.4 Database query guardrails

Corrected day query example (use local-day ISO UTC bounds supplied by main):

```sql
SELECT id, timestamp, app, category, duration_ms, title, project,
       is_browser_tracking, profile_id, platform, source
FROM logs
WHERE timestamp >= ? AND timestamp < ?
  AND app = ?
  AND (? IS NULL OR profile_id = ?)
ORDER BY timestamp ASC, id ASC;
```

Existing `manual-assign:list` uses `WHERE date = ? ORDER BY started_at ASC`; preserve this compatibility. Query identity must include profile and the browser-tracking dimension where existing behavior separates them.

Validation pseudocode before commit:

```ts
const intervals = [...unchangedRows, ...proposedRows]
  .map(row => ({ start: Date.parse(row.timestamp), end: Date.parse(row.timestamp) + row.duration_ms, row }))
  .sort((a, b) => a.start - b.start || a.end - b.end || a.row.id - b.row.id);
for (let i = 0; i < intervals.length; i++) {
  if (!Number.isFinite(intervals[i].start) || intervals[i].end <= intervals[i].start)
    throw new ValidationError('Invalid interval');
  if (i > 0 && intervals[i - 1].end > intervals[i].start)
    throw new ValidationError('Session overlap');
}
if (intervals.some(x => x.start < dayStartMs || x.end > nextDayStartMs))
  throw new ValidationError('Outside selected day');
if (proposedRows.reduce((sum, row) => sum + row.duration_ms, 0) !== targetTotalMs)
  throw new ValidationError('Target total mismatch');
```

The checker must account for the canonical-exclusive-stream decision in §1.4. Run it after both writers flush and before any correction commit.

### 8.5 Error/result semantics

Use the project's existing result/error wrapper unchanged. Empty reads must not be confused with DB failure: `[]` is a valid empty list; an error is a structured failure. `manual-assign:list` currently catches and returns `[]`, which can disguise DB errors; do not copy that ambiguity into new handlers. If compatibility permits, improve the legacy list handler only in a separately probed change.

## 9. REMOVALS

**Approval gate:** each item below is a proposed removal or UI retirement. The implementer must not delete/stop exposing these items until the user approves this list. The replacement design is specified above, but listing an item here is not approval by itself.

- `src/components/GapFillModal.tsx` — dead, zero importers, calls nonexistent `predictGapFill`/`confirmGapFill` IPC; retire after approval and verify the path stays unreferenced.
- `src/components/external/GapFillModal.tsx` — same dead/ghost-IPC failure; retire after approval.
- `src/components/GapFillDrawer.tsx` — same dead/ghost-IPC failure; retire after approval.
- `ManualAssignModal`'s standalone modal shell — consolidate into `TrackingTimeDialog` because it duplicates `ManualFillModal`'s `manual-assign:*` front end; preserve its unique assignment behavior as an inner panel until parity probes pass.
- `ManualFillModal`'s standalone modal shell — consolidate into the same dialog; preserve its spec-driven distribution controls as the `Add manual time` range submode until parity probes pass.
- The app-header `Smart Fill` label/tooltip — replace with `Tracking time`; the current tooltip describes the other action.
- The External-page `Smart Fill` label — replace with `Fill gaps`; keep its behavior as a deep link into the unified dialog.
- ActivityPage's duplicate `Manual time` / `Fill a range` separate modal launches — replace both with one unified dialog entry point that preserves the distinct one-span vs distributed-range submode.
- `TrackingCoverage`'s direct `ManualFillModal` launch — remove the bypass and route to the specific queued gap in the unified `Fill gaps` mode.
- Full editor UI inside `SleepDetectionModal` if present beyond an event summary — replace with a deep link to the same gap queue; do not remove sleep detection itself.
- Any independent, duplicate gap-prompt queue owner left after migration — retire only after queue compatibility is verified; `AfkPromptModal`'s auto-prompt behavior must continue through the shared panel.

Do **not** remove `predict-day-gaps`, `useGapPredictions.ts`, `detect-usage-gaps`, `compute-adjacent-gaps`, `manualBackfill.ts`, `update-app-log`, `delete-app-log`, `SleepDetectionModal`, or existing per-row StatsPage editing as part of this change. Reuse/bridge them, and only consider later removals with a new explicit approval list.

## 10. Open Risks & Assumptions

### P0 — correctness blockers

1. **Browser rows and exclusive time:** the bundle doesn't prove whether browser tracking overlaps are intended nested telemetry or a bug. Falsifier: current dashboards intentionally count app duration and browser duration independently. Resolve before global no-overlap repair or migration.
2. **Daemon observation success contract:** `feed(observed)` caller is not included. Falsifier: the poller already distinguishes failed polls and no-active-app results. Map actual outcomes to `{ok, observation}` before changing the function.
3. **Aggregate schemas:** actual `stats_hourly`/`stats_daily` definitions and trigger SQL were not included. Use live `sqlite_master` definitions; do not ship placeholder trigger bodies.
4. **Local day timezone:** the bundle identifies ISO UTC strings and warns to use `substr(timestamp,1,10)` for existing date-key SQL, but doesn't expose all UI timezone helpers. Reuse the product's actual day-key definition and prove local-day bounds in tests.
5. **Current IPC wrapper:** exact shared `Result<T>` type isn't included. Match adjacent live handlers and preload conventions.

### P1 — reliability and UX

6. `powerMonitor` shutdown is documented for Linux/macOS, but lock-screen is documented only for macOS/Windows; do not rely on Linux Electron lock events. Verify the installed Electron's suspend delivery and KDE/logind signals. <https://www.electronjs.org/docs/latest/api/power-monitor/>
7. `getSystemIdleTime()` is broken in this environment. Any remaining idle-based fallback must be audited; wall-gap logic stays authoritative.
8. Reflow targets are user-selected; inferred start/end times are predictions. Never market confidence as confidence that the total is correct.
9. A target can be less than current usage but unavailable because fixed neighbouring intervals occupy the day. Report exact capacity; don't silently shrink neighbouring sessions.
10. Repeated correction batches can conflict. Use baseline hashes, batch lineage, idempotency keys and all-or-nothing undo.
11. Large app histories require virtualisation and a bounded reference set. The algorithm caps sessions at 120 and history at 56 days for predictable runtime.
12. Existing summary functions may not be transaction-aware. Make them synchronous transaction-safe or calculate their writes in the same transaction before enabling Apply.

### P2 — follow-up quality

13. Prediction version changes must not affect old corrections; persist `algorithm_version` and session snapshots.
14. If corrected sessions are deleted or edited via legacy StatsPage, mark their originating batch stale/orphaned and make undo report the conflict.
15. If the system is forcibly powered off, no event can be guaranteed. The durable safety property is that unobserved time is never appended on restart.

### Acceptance checklist

- Both writers reject sleep spans and update `lastSuccessfulObservationMs` only on valid observations.
- Sleep for 3+ hours, lid-close, shutdown/reboot, lock/unlock, daemon ownership, poll failure and resume are tested separately on KDE Wayland.
- No canonical intervals overlap after every write/repair, and no local day exceeds 24 h of exclusive credited time.
- App/day slider target equals the exact sum of proposed sessions down to milliseconds.
- All proposed sessions fit free time, do not overlap, and stay inside the selected local day.
- Preview is read-only; commit is transactional; rollback and undo restore byte-equivalent relevant row values.
- Hourly/daily/app/manual aggregates agree after insert, update, delete, undo, no-op, cross-hour update and cross-day boundary cases.
- The three UI intents share exactly one dialog instance and no two buttons retain the same ambiguous “Smart Fill” label.
- Existing `255` probes remain green. Every correction/sleep/consolidation change adds probes under `agent/probes/`; run with `npx tsx` as current practice indicates.
- No proposed removals execute until approved.

## Implementation order

1. Add invariant + sleep regression probes and inspect browser-row semantics and live aggregate trigger SQL.
2. Fix daemon timestamp ordering and explicit successful-observation state; prove with fake-clock tests.
3. Add event pause/resume lifecycle and app writer probes; add KDE/logind event adapter only after verifying its signal path.
4. Add aggregate UPDATE/DELETE maintenance, migrations, and parity probes. Rebuild a copied database before touching the live DB.
5. Add the ledger and transaction/undo backend behind a disabled feature flag.
6. Implement the pure predictor and deterministic property tests; verify 0, 1 session, 200 rows, no history, 24 h, fragmented capacity, overlaps, exact rounding.
7. Implement the unified dialog with target slider, exact input, preview, session table/selected-session handles and accessibility.
8. Route all existing entry points to the dialog; retain old shells until parity and approval.
9. Enable preview-only, compare results against actual data, then enable commit/undo after acceptance checks pass.
10. Only after explicit user approval, perform the removals in §9.

## Probe matrix (required before enabling writes)

Keep all existing `255` assertions green. Add these probes in `agent/probes/`, using the existing `npx tsx` convention and pure-module imports where possible. Each probe must fail on the pre-fix behavior, not merely assert the new function exists.

| Probe | Required assertions |
|---|---|
| `tracking-sleep-daemon.probe.mts` | Fake-clock poll at `t0`, successful session observations, then 3-hour clock jump: written end is exactly `lastSuccessfulObservationMs`, credited duration excludes the jump, and no fake 3,600,000 ms sleep-cap row appears. Assert sleep gap is checked before `lastPollAttemptMs` advances; `lastSuccessfulObservationMs` is unchanged by failed/null-error polls; successful “no foreground app” differs from poll failure; a post-gap app creates a new session starting only at fresh success; repeated flush cannot double-write. |
| `tracking-sleep-app.probe.mts` | Mirror the app writer's `lastSuccessfulObservationTime - sessionStart` behavior; failed polls do not move end time; long gap resets session; the first post-resume valid sample starts a new session; normal app switch closes old and opens new at the same boundary. |
| `tracking-sleep-lifecycle.probe.mts` | Suspend/lock stops writes and flushes at last success; resume/unlock does not bridge paused time; no poll result while paused opens a session; shutdown handler is synchronous/idempotent; no-event/forced-kill simulation still recovers via wall-gap detection. Document that this probe tests our state machine, while KDE integration is a separate manual acceptance test. |
| `tracking-interval-invariants.probe.mts` | Adjacent intervals meeting at the same millisecond pass; 1 ms overlap fails; unsorted rows are sorted before validation; invalid ISO, zero/negative duration, out-of-day start/end, >24 h sum, and overlap after an app transition fail; a cross-midnight row is rejected or split according to the day boundary policy; all duration totals use integer milliseconds. |
| `tracking-time-allocation.probe.mts` | For targets `0`, `6s`, `1m`, `8h`, and `24h`, allocated duration sum equals target exactly; all positive sessions are ≥6s and ≤2h; deterministic same-seed output is identical; different preview nonce may change placements without changing target; remainder tie-breaking is stable; no history uses low confidence; no feasible N rejects instead of rounding the target. Include randomized/property tests across hundreds of valid T/N/weights triples. |
| `tracking-time-placement.probe.mts` | All proposed sessions fit `[dayStart,nextDayStart)`, avoid every unchanged interval, avoid each other, and sum exactly to target; available capacity is computed from free intervals; target one second above capacity rejects; fragmented free space returns unavailable if it cannot pack exact sessions; placement never moves another app's session; a 23h/25h DST day uses actual boundaries but still caps credited sum at 24h. |
| `tracking-time-confidence.probe.mts` | Zero samples → confidence 0 and no learned recommendation; fewer than 3 days caps confidence at 0.35; clean sample counts/exclusions are correct; impossible 1h-capped sleep rows are excluded on flagged corrupt days; corrected/manual rows never train their own model; CV error lowers confidence; confidence is not shown as confidence in the user's selected total. |
| `tracking-time-ledger.probe.mts` | One correction creates one batch, all row diffs and snapshots, `source='corrected'` on changed/generated logs and linked assignments; exact target equality; Undo restores original log IDs/fields and assignment rows, removes generated rows, restores deleted rows, marks the batch undone, and can be run only once; stale undo with later edits fails safely; failed insert/update/aggregate check rolls back all tables. |
| `tracking-time-aggregates.probe.mts` | Update within same hour, cross-hour, cross-day, app/category/profile change, delete, insert, undo, and no-op correction preserve exact parity between aggregates and canonical `logs`; all four summary families (`stats_hourly`, `stats_daily`, manual stats, app aggregate) match fresh recomputation; `substr(timestamp,1,10)` path works for ISO `Z`; `date(timestamp,'unixepoch')` is never used. |
| `tracking-time-ipc.probe.mts` | Main process, not renderer, revalidates preview; target bounds and date/profile are validated; baseline hash conflict blocks commit; expired preview rejects; idempotency key prevents duplicate batch; handler returns the established wrapper; empty array is distinct from failure; renderer cannot send untrusted arbitrary session timestamps as the committed plan. |
| `tracking-time-ui-consolidation.probe.mts` | Header opens one dialog in `Correct recorded time`; External `Fill gaps` opens same dialog on that tab; ActivityPage `Manual time` and `Fill a range` open same single dialog with correct submode; TrackingCoverage selects its queued gap; sleep notification deep-links to same gap panel; app header tooltip matches actual behavior; no two buttons say `Smart Fill`; the 3 dead ghost-IPC components remain unmounted and have zero importers until approved for deletion. |
| `tracking-time-a11y.probe.mts` | Slider has min/max/now/value text; keyboard arrows/Shift/PageUp/Home/End follow increments; numeric field reaches the same target without drag; selected session start/end controls are labelled distinctly; 200 rows virtualise with only one active two-thumb session editor; reduced-motion sets transitions to 0; focus order and conflict announcements stay deterministic. |

**Machine acceptance queries:** every test fixture should run the interval validator and aggregate parity check after seed, after operation, and after undo. The existing 255 probes must run unchanged. The KDE manual matrix must test: app writer owns port 54321; daemon owns port 54321; suspend/wake; lid-close/wake; lock/unlock; reboot; app crash; forced termination; and sleep-gap recovery when an event is not delivered.

## References

- Electron `powerMonitor` platform/events documentation: https://www.electronjs.org/docs/latest/api/power-monitor/
- SQLite trigger events and `OLD`/`NEW` semantics: https://www.sqlite.org/lang_createtrigger.html
- systemd/logind sleep/shutdown preparation and inhibitor semantics: https://systemd.io/INHIBITOR_LOCKS/
