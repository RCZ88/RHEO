# Round 04 — answers to REQUEST A, B, C

Method: greps + `sqlite3` against a **copy** of the live DB (`/tmp/readonly-probe.db`,
deleted after). Nothing here is described from a filename.

**Correction first, because it invalidates a line I already gave you.**

## I was wrong about WAL. The DB is in WAL mode.

Round 02 said: *"No `PRAGMA journal_mode=WAL` anywhere, so no `-wal` sidecar. The
`1 SQLite file` claim HOLDS."* That was a bad grep — I searched `PRAGMA` and missed
`db.pragma`, a different method on the same thing.

```
src/main.ts:27306:    db.pragma('journal_mode = WAL');
src/main/backup/BackupService.ts:115:    db.pragma('journal_mode = WAL')
```

Measured on the live database:

```
$ sqlite3 deskflow-data.db "PRAGMA journal_mode;"
wal
```

And the sidecars exist right now:

```
-rwxrwxrwx 122585088  deskflow-data.db
-rwxrwxrwx      32768  deskflow-data.db-shm
-rwxrwxrwx   4177712  deskflow-data.db-wal
```

So **`"1 SQLite file is your entire history"` is FALSE as written.** It is three files
on disk. The history is in one logical database; the claim as phrased is about the
filesystem and the filesystem says three. Round 02's "HOLDS" verdict is retracted.

---

## REQUEST A — every file and folder written inside the data directory

Root is `app.getPath('userData')` (`src/main.ts:222`), which on this machine resolves to
`~/.config/RHEO/`.

### Directories

| Path | Creating line |
|---|---|
| `userData` itself | `src/main.ts:2406` — `mkdirSync(userDataPath, { recursive: true })` |
| `agent/skills/` | `src/main.ts:27601, 27651, 27937, 28036` |
| `agent-state/` | `src/main.ts:15060` |
| `backups/` | `src/main/backup/BackupService.ts:16` |
| `ai-gateway/` | `src/main.ts:8547` |
| `lyceum/illustrations/<lessonId>/` | `src/services/learn/index.ts:1051, 1095, 1137` |

### Files, with the line that writes them

| File | Creating line |
|---|---|
| `deskflow-data.db` | `src/main.ts:223` (path), opened with WAL at `27306` |
| `deskflow-data.db-wal`, `deskflow-data.db-shm` | sidecars of the above; **exist live, 4.1 MB + 32 KB** |
| `deskflow-data.json` | `src/main.ts:224` |
| `error-log.txt` | `src/main.ts:14, 24` |
| `deskflow-sleep-state.json` | `src/main.ts:225` |
| `deskflow-sleep-pattern.json` | `src/main.ts:226` |
| `deskflow-window-state.json` | `src/main.ts:227` |
| `deskflow-last-focus.json` | `src/main.ts:389, 7206, 7231, 7256, 24497` |
| `show-morning-prompt.json` | `src/main.ts:471, 25532, 25546` |
| `deskflow-categories.json` | `src/main.ts:483` |
| `deskflow-audit-key.bin` | `src/main.ts:4433, 31290` |
| `deskflow-sleep-detection.json` | `src/main.ts:5237, 25719, 25836, 25849, 25863` |
| `sync-debug.log` | `src/main.ts:5787, 24542` |
| `deskflow-prefs.json` | `src/main.ts:8791` |
| `stt-rec-<stamp>.<ext>` / `stt-rec-<stamp>.py` | `src/main.ts:9226, 9227` — temp recording + script |
| `overlay-studio-transcribe.py` | `src/main.ts:9362` |
| `stt-native.ps1` | `src/main.ts:9411` |
| `vocab.json` | `src/main.ts:9643` |
| `deskflow-custom-scan-dirs.json` | `src/main.ts:14345` |
| `auto-assign-config.json` | `src/main.ts:20458, 20467` |
| `.gpu-disabled` | `src/main.ts:23941` |
| `halo-diagnostic.log` | `src/main.ts:24227, 24246`; also `src/main/halo/haloIsland.ts:73` |
| `deskflow-afk-queue.json` | `src/main.ts:25863, 25879, 25891` |
| `resume-data.json` | `src/main.ts:31700` |
| `ai-settings.json` | `src/main.ts:31865` |
| `preferences.json` | `src/services/learn/index.ts:1083` |
| `backup-settings.json` | `src/main/backup/BackupService.ts:35` |
| `gas-pending-queue.json` (const `PENDING_QUEUE_FILE`) | `src/main/gas/ipc.ts:134, 146` |
| `gas-secrets.json` | `src/main/gas/secrets.ts:16` |
| `sync-auth.json` | `src/main/authStore.ts:14` |
| `deskflow-kb.json` | `src/main/services/knowledge-store.ts:20` |
| `notifications` data | `src/main/notifications.ts:62` |
| project backups | `src/main/backup/ProjectBackupService.ts:42` |

### `aiDebugVault` — where it writes: **it does not write a file.**

`src/services/aiDebugVault.ts` has **zero** `writeFileSync`, `appendFileSync`,
`mkdirSync`, or `getPath` calls. Line 1 is `import type { Database } from 'better-sqlite3'`
and the header at lines 4-9 says:

```
// AI Debug Vault — append-only verbatim audit log of EVERY AI interaction
// inside DeskFlow. Table: ai_debug_events | Retention: newest 25,000 rows |
// payload cap 300 KB
```

**It is a table inside the same SQLite database, not a second location.** The table
`ai_debug_events` exists in the live DB. So it does **not** break the "one database"
claim — but it does mean your prompts and answers are persisted on disk on every
question, which the page must disclose.

Note lines 48-56: there is a secret-redaction pass before serialising
(`sk-ant-`, `sk-`, `AIza`, `ghp_`, `Bearer …`, `"api_key": "…"` and others). Real
mitigation, and worth stating as such.

### Table names — **228**, from the live database

Counted, not estimated:
`SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'` → **228**.

The source declares **178** distinct names (`CREATE TABLE` grep). The extra ~50 exist in
the live DB but are not in current source — migration residue, plus FTS5 shadow tables
(`ai_chat_fts`, `ai_chat_fts_config`, `ai_chat_fts_content`, `ai_chat_fts_data`,
`ai_chat_fts_docsize`, `ai_chat_fts_idx`, and the same six for `ai_debug_fts`).

**That gap is itself a finding.** 12 of the 228 are FTS index shadow tables; the rest are
tables whose `CREATE` lives in a migration or has been dropped from source while its data
survived. Two live tables are clearly abandoned: `finance_wallets_old`,
`finance_transactions_v2`.

The tables that actually hold your history, by row count on the live DB:

| Table | Rows |
|---|---|
| `logs` | 43,805 |
| `ai_chat_messages` | 1,724 |
| `productivity_sessions` | 598 |
| `sessions` | 297 |
| `ai_debug_events` | 428 |
| `context_facts` | 219 |

Full list is in the copy command below — I did not paste 228 names into a chat message.

### Verdict for the Ledger

- ~~"1 SQLite file is your entire history"~~ → **must change.** One logical database in
  **three files** on disk (`-wal` is 4.1 MB and grows), plus ~28 config/state files and 6
  directories alongside it.
- Honest replacement: **"One SQLite database holds your history. It is three files on
  disk, plus your settings and caches in the same folder."**

---

## REQUEST B — phase detection, quoted

There are **two unrelated things named "phase"** and I read both, because guessing which
one you meant is how the earlier slips happened.

### B1. `src/lib/currentPhase.ts` — NOT phase detection. Do not document it.

54 lines. It is an **animation clock** for the Current page:

```
const CYCLE_MS = 8000; // full pulse cycle duration
let phase = 0;
function tick(timestamp: number) { … phase = (phase + delta / CYCLE_MS) % 1; … }
export function startPhaseClock() { … }
export function getPhase(): number { return phase; }
```

`getPhase()` returns a 0→1 animation value. No inputs, no thresholds, no network. The
file's own comment says *"The phase is a number 0→1 that increments continuously via rAF."*

**A naive grep for "phase detection" lands here and it is the wrong file.** Worth saying
so in `/docs/phases` so the next reader does not repeat it.

### B2. `src/shared/phaseRules.ts` — this is the real one. 174 lines.

Quoted, the detection function:

```ts
export function detectDrift(input: {
  days: string[];              // 'YYYY-MM-DD' per day, oldest first
  newMinutesByDay: number[];   // minutes of NEW-topic work per day
  totalMinutesByDay: number[]; // total minutes per day
  currentMode: TrainingMode;
}): { drifting: boolean; reason: string } {
  const n = input.days.length;
  if (n < 3) return { drifting: false, reason: 'Not enough days to judge a phase.' };

  const window = Math.min(5, n);
  const start = n - window;
  let newMin = 0;
  let totalMin = 0;
  for (let i = start; i < n; i++) {
    newMin += input.newMinutesByDay[i] ?? 0;
    totalMin += input.totalMinutesByDay[i] ?? 0;
  }
  if (totalMin <= 0) return { drifting: false, reason: 'No work logged in the last few days.' };

  const newShare = newMin / totalMin;
  const consecutive = trailingRun(input.newMinutesByDay, start, n, (m) => m > 0);

  if (newShare < 0.6 || consecutive < 3) {
    return { drifting: false, reason: 'Not enough new material to call a phase change.' };
  }

  return input.currentMode === 'burn_down'
    ? { drifting: true, reason: `You have spent ${Math.round(newShare * 100)}% of the last ${window} days on new material.` }
    : { drifting: false, reason: 'Already in a phase that allows new material.' };
}
```

**Inputs:** per-day new-topic minutes, per-day total minutes, the current mode, and the
day list. No app names, no window titles, no keystrokes, no session ids.

**Thresholds — all four, measured from the source:**

| Threshold | Value | Line |
|---|---|---|
| minimum days of history | `n < 3` → bail | 101 |
| analysis window | `Math.min(5, n)` days | 104 |
| new-material share | `>= 0.6` | 128 |
| consecutive days with new work | `>= 3` | 128, via `trailingRun` at 135-142 |

**Direction is one-way.** Drift only fires when you are in `burn_down` and have moved back
into new material. From `learn`, the function returns `drifting: false` unconditionally
(line 134) — "Already in a phase that allows new material."

**The caller never supplies real new-topic minutes.** `src/infrastructure/ipc/goal-handlers.ts:1593`:

```ts
const drift = detectDrift({
  days: week,
  newMinutesByDay: week.map(() => 0),   // <-- always zero
  totalMinutesByDay: total,
  currentMode: mode,
});
```

`newMinutesByDay` is hardcoded to seven zeros. So `newMin` is always `0`, `newShare` is
always `0`, and `0 < 0.6` always holds — **`detectDrift` can never return `true` as wired.**
The drift question is currently unreachable in the running app.

**Does any step call the AI or the network? NO.** `detectDrift` is pure arithmetic. The
surrounding handler `training:phase:current` (`goal-handlers.ts:1561-1619`) does two SQL
reads — `life_phases` and a `logs` aggregate over the current week — and reads the user's
own prior answer from `phase_drift_answers`. No `fetch`, no provider, no LLM. The mode is
also never inferred: `training:phase:set-mode` (`goal-handlers.ts:1621`) writes whatever
the user chose.

The policy tables are frozen literals, and the source says why (lines 45-49):

```ts
export const PHASE_RULES: Record<TrainingMode, PhaseRules> = {
  learn: { mode:'learn', allowNew:true, maxNewPerDay:2, reviewFloorMinutes:10, requireReviewQueueCleared:false },
  burn_down: { mode:'burn_down', allowNew:false, maxNewPerDay:0, reviewFloorMinutes:20, requireReviewQueueCleared:true },
};
// Exported as a frozen literal rather than computed, because these are POLICY,
// and a policy that is derived from data will change itself without anyone
// deciding to change it.
```

### Verdict for `/docs/phases`

The honest page: **phases are user-set, not detected.** The detector exists, is
conservative by design, has four documented thresholds, runs entirely locally — and is
currently wired with zeros so it cannot fire. Document the policy (learn vs burn-down,
what each forbids) and state plainly that the app never guesses.

---

## REQUEST C — do AI responses include session citations?

# **NOT FOUND.**

Searched, with no hits for any of:
`citation`, `cited`, `citedSessions`, `session_refs`, `usedSessions`, `sourceSession`,
`evidence`, `receipt`, `ref_session` — across `src/main.ts`, `src/infrastructure/ipc/**`,
`src/services/aiDebugVault.ts`, `src/pages/AiPage.tsx`, `src/components/ai/**`,
`src/hooks/useAiChat.ts`.

The only `citations` type in the codebase is unrelated to time tracking —
`src/shared/learn/types.ts:307, 438`:

```ts
citations: { id: string; url: string; title: string }[];
```

That is Lyceum lesson sources, with URLs. Nothing links a model answer to a
`logs`/`sessions` row.

The response path is fully quoted in round 03 and has no citation step: the AI returns
plain text, `parseAssistantContent` splits it into a canvas card, and the card is merged.
No session ids are attached, because the prompt carries **aggregates** — `clip(dash, 900)`,
totals and goals, not row references — so there is nothing to cite even in principle.

**Consequence: the landing page is currently making a claim the code does not support.**
`landing/src/components/rheo/Gallery.tsx:73`, the AI Assistant caption:

> "It answers against your record, and cites the sessions it used."

Cut the second clause, as you ruled. The `Download.tsx:14` changelog entry claims
"Added cited-session chips under every AI answer — receipts, not guesses" for v0.0.7.
**That is also unsupported** — no such code exists. If a changelog entry describes a
shipped feature, it is a false claim sitting above the CTA. Recommend cutting it too, or
flagging it as unreleased.

---

## Three retraction-ready items

1. **"1 SQLite file" is false.** WAL mode is explicit at `main.ts:27306`; three files, 4.1 MB
   of `-wal` right now. Round 02's "HOLDS" is retracted.
2. **`aiDebugVault` is not a second location.** It is a table in the same database — but
   that table holds every prompt and answer verbatim, so disclose it.
3. **Drift detection is unreachable as wired.** Seven literal zeros. Document it as
   user-set phases, not detected ones.

## Remaining OPEN from your spec

- What exact install identifier does the update check send? `electron-updater` sends
  platform, arch and version by default; the exact header set is inside the library and I
  have not read it. **NOT VERIFIED.**
- Whether the 50 source-less tables are migration residue or orphans. I counted the gap; I
  have not diffed them. **OPEN.**