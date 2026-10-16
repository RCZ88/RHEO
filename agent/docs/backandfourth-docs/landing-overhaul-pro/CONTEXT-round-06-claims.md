# Round 06 — answers to REQUEST F

Method: greps across `src/`, plus reading the page registry. One sweep per question family.

---

## The sibling sweep you asked for, run first

"Depth" appears **335 times** in `src/`. Not one of them is the product claim. Every hit
is tree-nesting depth, CSS depth, a terminal pane depth, a comment about visual depth, or
a brace-matching counter. `grep -rniE "weighted_depth|weightedDepth|depth_weight|focus_depth|computeDepth"`
→ **zero hits.**

**There is no depth feature and no weighted-depth feature.** I found it before reading a
single page, which is what the sweep is for. That kills five claims at once — F1 below.

---

## F1 — "Depth". Five claims, one answer.

| Claim | Location | Verdict |
|---|---|---|
| "The whole day on one surface — depth, not duration" | `Gallery.tsx:68` | **FALSE.** No depth code exists. |
| "Productive, neutral, distracting — weighted by depth" | `Gallery.tsx:71` | **PARTLY TRUE, wrong mechanism.** There *is* a weight, but it is a fixed category multiplier, not depth. |
| "Dashboard donut now reflects weighted depth, not raw duration" | `Download.tsx:16` (v0.0.9) | **FALSE.** Same as above. |
| "The record marks its depth, not just its length" (DEEP WORK blurb) | `ActRecord.tsx:37` | **FALSE.** Superseded anyway by your derived-blurb ruling. |
| Hero "depth" | — | not present in the hero copy. **No change needed.** |

**What actually exists**, `src/pages/InsightsPage.tsx:573-591`, quoted:

```ts
const tierDistribution = useMemo(() => {
  const tiers = { productive: 0, neutral: 0, distracting: 0 };
  for (const stat of appStats) {
    const cat = stat.category;
    if (tierAssignments.productive.includes(cat)) tiers.productive += stat.total_ms;
    else if (tierAssignments.distracting.includes(cat)) tiers.distracting += stat.total_ms;
    else tiers.neutral += stat.total_ms;
  }
  ...
  const total = tiers.productive + tiers.neutral + tiers.distracting;
  const weighted = tiers.productive + (tiers.neutral * 0.5);
  const score = total > 0 ? (weighted / total) * 100 : 0;
  return { ...tiers, total, score };
}, [appStats, browserLogs, tierAssignments]);
```

**The weight is a constant `0.5` on the neutral tier.** Every app in a category gets the
same multiplier. There is no per-session measurement, no keystroke signal, no focus
inference. So the honest description is: *time is split into three categories, and the
neutral tier counts as half when scoring.*

**And the categories are typed in**, `InsightsPage.tsx:163`:
```ts
tierAssignments = { productive: ['IDE','AI Tools','Developer Tools','Education','Productivity','Tools'],
                     neutral: [...], distracting: [...] }
```
That is a hardcoded literal in the component. It is overridable — `tierAssignments` is a
prop (line 2502) and a type (line 102) — but I have not found where a non-default value is
passed, so **the default is what ships.** This matters for the `rankings` caption too (F3).

### `deep_focus_sessions` — what it really is

Read it, since the name implied a depth feature. `src/domains/focus/focusSchema.ts:6` and
`focusManager.ts:115`:

```ts
INSERT INTO deep_focus_sessions (started_at, planned_sec, outcome, strictness, allowed_json)
```

`planned_sec`, `outcome`, `strictness`, `allowed_json`, and at line 215
`broke_on_type`, `broke_on_name`, `return_count`.

**This is a Pomodoro-style timer with a block list.** "Deep focus" here means "a session I
declared in advance, with an outcome and a break reason." It measures *declared intent and
adherence*, not attention depth. `strictness` and `allowed_json` are the user's own rules.

Readers: `goal-handlers.ts:513, 532, 918, 1029` (joins into goal stats) and `main.ts:8237`
(count + duration rollups). No depth computation anywhere in the chain.

**`deep_focus_sessions` is not evidence for the word "depth" on the page.** It is evidence
that a focus timer exists. That is a different, shippable claim.

---

## F2 — "Lessons redraw / weights adjust themselves"

**NOT FOUND** for redraw. `grep -rniE "invalidateLesson|lessonStale|regenerate|refreshLesson|redrawLesson"`
across `src/services/learn/` and `src/infrastructure/ipc/` → **zero hits.**

**What does exist** is mastery tracking, not redraw. `src/services/learn/services/progress.service.ts:1`:
```
// ProgressService — evidence → mastery estimate → spaced repetition
```
with `mastery_target` as a stored column on nodes
(`content.service.ts:48,86`, `import.service.ts:79,124`) and an assessment prompt at
`tutor.service.ts:66` that grades against the rubric.

`learn_velocity` exists as a table (`db/migrations/007_stats_and_motivation.sql:68`) and
is listed in `main.ts:7618`, but **`INSERT INTO learn_velocity` is not found in any `.ts`
source.** It may be written by raw SQL in a migration or never written at all. **I have
not read the migration body.**

**Verdict: the caption is false as written.** "Lessons that redraw as you grow" describes
content regeneration; nothing regenerates a lesson. "Weights adjust themselves" describes
model weights; what adjusts is a per-node `mastery_target` score from assessments.

**Shippable replacement:** *"Tracks what you have mastered and what to review next."* —
which is exactly what `progress.service.ts` says it does.

---

## F3 — `rankings`: "Computed from the record, never typed in"

The computation exists. `src/pages/RankingsPage.tsx:212`:
```ts
api.getPeriodRankings({ period: effectivePeriod, dateOffset, granularity, metric })
```

**Answering your actual question — is any ranking input typed by the user? YES, two ways:**

1. **`metric` is user-selected** — `RankingsPage.tsx:213` passes it from UI state, and the
   comment at line 222 says *"changing the metric re-ranks."*
2. **The categories feeding those metrics are hardcoded**, `InsightsPage.tsx:163`, per F1.

There is no `rankings` table in the live DB and no `INSERT INTO rankings` anywhere —
rankings are computed on read, not stored. That part of the claim is true.

**Verdict: partly false.** The *numbers* are computed, but *what gets counted* is a
hardcoded category list, and *what order* is a user-chosen metric. "Never typed in"
describes the arithmetic, not the inputs.

---

## F4 — one line per screen

Taken from the page registry, which is the repo's own declaration of what each surface is.
Note **three of the five captions name routes that do not exist as page files** — the
manifest is the authority.

| Caption | Route | What it is, per the manifest |
|---|---|---|
| `studio` | `/studio` | Content Engine: Lessons, Frameworks, Ideas, Series, Takes. Registry `studio.ts:31`. |
| `lecture` | `/lecture` | "Decks, transcription, prompt forge, research" — registry `learn.ts:58`. It is **not a teaching mode.** |
| `labs` | `/labs` | Registry `studio.ts:71` — the Labs container, parent of Content Engine and Lecture. |
| `guide` | `/guide` | Registry `settings.ts:96` — a settings sub-route. **Not** "how the instruments fit together." |
| `ide` | `/ide` | Registry `ide.ts:15`. Component is `src/pages/IDEProjectsPage.tsx`. |

**Two captions are describing screens that do not exist as described:**
- **`lecture`: "Teach the room from the record."** The manifest calls it decks,
  transcription, prompt forge and research. That is authoring material, not teaching a room.
- **`guide`: "How the instruments fit together."** It is a settings sub-route. The
  manifest hint for it is not a documentation shell.

**Not assessed beyond one line**, as instructed. I have not read any of these five page
components.

---

## F5 — `finance`: "No bank sync"

**Confirmed. Nine greps, all zero hits** across `src/`:

```
plaid              NOT FOUND
truelayer          NOT FOUND
openbanking        NOT FOUND
open-banking       NOT FOUND
mxbank             NOT FOUND
yodlee             NOT FOUND
finicity           NOT FOUND
refreshfinancial   NOT FOUND
plaid_client       NOT FOUND
```

Corroborating: the round-02/03 network audits found no bank host in any of the 32 `fetch`
call sites. Finance makes exactly one outbound call, and it is currency rates
(`currency-data.ts:59` → `api.exchangerate-api.com`), already documented in the Ledger.

**Verdict: TRUE. Keep it.** It is the best-verified claim on the page.

One caveat worth stating: finance data *can* leave the machine, via the AI prompt — unless
Finance is locked, which round 03 confirmed fails closed. So "No bank sync" is true, but
the privacy docs must not let a reader infer "your finances never leave." That lock
sentence in `/docs/ai` already covers it.

---

## F6 — `life_phases`: user-facing and editable? **YES to both.**

**Mounted in the real UI:** `src/features/warmth/LifePage.tsx:14` imports `PhaseCard`, and
line 1045 renders it inside the phase list:

```tsx
<PhaseCard
  phase={phase}
  active={activePhaseId === phase.id}
  allPhases={phases}
  covenant={{ commitments: covenant.commitments, completions: covenant.completions }}
  memories={memories.items}
  longTermGoals={ltgs}
  onSave={p => { savePhase(p) }}
  onReflect={(p, answers, variation) => reflect(p, answers, variation)}
  ...
```

**`onSave` means the user edits it.** Plus `phase-form-dialog.tsx` (894, 953, 1218) is a
create/edit form, and `goal-handlers.ts` provides `INSERT OR REPLACE` (325), `DELETE` (396)
and `UPDATE` (402, 1628). It is full CRUD behind a real screen.

### So the hero line survives — with a rewrite

`"so every phase of your life can be seen, questioned, and improved"` — the *phases* are
real and user-editable. **But this is now the third distinct meaning of "phase"** after
round 04's Learn/Burn-down finding and the `#act-record` blocks:

| Meaning | Where | Real? |
|---|---|---|
| Life eras with dates, category, reflections, memories | `life_phases`, LifePage | **YES** |
| Learn / Burn-down training mode | `phaseRules.ts`, `training:phase:current` | **YES**, user-set |
| REST / DEEP WORK / MEETINGS / LEARNING | `ActRecord.tsx:25` | **NO** — hand-typed sample |

The hero is talking about the **first** meaning, which is real. Keep the line. Your
`#act-record` rename to "blocks" is what removes the collision.

Note `LifePage.tsx` is at `src/features/warmth/LifePage.tsx`, **not** `src/pages/LifePage.tsx`.
There is no `src/pages/LifePage.tsx` — my first grep for it returned nothing and I nearly
reported that as the phase surface being absent. It is in `features/`.

---

## Requested in your rules, not in a REQUEST

**F2 sibling sweep.** The `learn` caption had two claims ("redraw", "weights adjust
themselves") and F1's lesson was that one search settles a family. Searching the whole of
`src/` for `mastery`, `redraw`, `regenerate` turned up **no second "lessons adapt to you"
claim** anywhere else. The `insights` and `dashboard` captions were already in F1.

**New false claims found by these sweeps, none requested:**

| Claim | Location | Why false |
|---|---|---|
| "Teach the room from the record" | `Gallery.tsx:83` (`lecture`) | manifest calls it decks, transcription, prompt forge, research |
| "How the instruments fit together" | `Gallery.tsx:81` (`guide`) | it is a settings sub-route, not a docs shell |
| "Sessions become documentation and explainers" | `Gallery.tsx:80` (`studio`) | **not assessed** — I have not read the component. Flagged, not cleared. |
| "Coding time, organised per project" | `Gallery.tsx:76` (`ide`) | **not assessed.** Flagged, not cleared. |

---

## Verdict table for the caption rewrite

| Caption | Verdict | Replacement |
|---|---|---|
| `dashboard` | **FALSE** (no depth) | "The day on one screen." |
| `insights` | **PARTLY FALSE** | "Time split into productive, neutral and distracting." The 0.5 weight exists; depth does not. |
| `ai` | **FALSE** (round 04) | "Ask questions about your day." |
| `database` | **FALSE** (round 04) | "One SQLite database on your disk. Browse it. It's yours." |
| `settings` | **OVERSTATED** | "Local-first by default. No analytics code." |
| `learn` | **FALSE** (F2) | "Tracks what you have mastered and what to review next." |
| `rankings` | **PARTLY FALSE** (F3) | "Computed from your record, ranked by the metric you pick." |
| `lecture` | **FALSE** (F4) | "Decks, transcripts, and research notes." |
| `guide` | **FALSE** (F4) | **needs your decision** — it is a settings route; either describe the settings route or cut the capture. |
| `finance` | **TRUE** | keep |
| `studio`, `ide` | **not assessed** | flagged |
| 6 others | screenshot description | unchanged |

**One decision for you:** the `guide` capture shows a settings screen while the caption
describes a documentation shell. Either the caption becomes "Settings and configuration"
or the capture comes out of the gallery. I have not looked at the image.

## Still OPEN

- `studio`, `ide` captions — **components not read.**
- `learn_velocity` writes — **only found in a migration I have not read.**
- Non-default `tierAssignments` — **no caller found**, default is what ships.
- 50 source-less tables — **counted, not diffed.**