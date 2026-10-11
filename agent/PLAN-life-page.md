# Life page — organization + legibility plan

> Problems **188–192**. PAINT P0–P7. Decisions below each carry the *reason*, not
> just the rule, per PAINT §0.3. Nothing here is written until this file exists.

---

# P0 — INTENT

**Surface:** App UI (`src/features/warmth/`) → **LAMINAR is a hard contract**, zero latitude.

**Industry:** personal-productivity / life-tracking. Density matters (a person scans this
daily), but it is *not* a developer tool — it is emotional, longitudinal. That distinction
drives every layout decision below.

**Primary goal of the Life page:** *answer "how am I actually doing?"*

**The one primary action:** on Gold, **journal/reflection**. On Schedule, **see today and act on it**.

---

## The organising thesis

You said it: Gold is reflection and routines; Schedule is time and tasks. That is not a
cosmetic split — it is a **different question per tab**, and a surface that answers two
questions answers neither.

| Tab | Answers | Owns |
|---|---|---|
| **Gold** | "How am I doing? What am I becoming?" | Routines (goals), week recap, reflection/journal, **phases** |
| **Schedule** | "What is happening, and when?" | Schedule blocks, tasks/todos, deadlines, reminders, calendar |
| **Habits** | "Am I keeping my word?" | Habit tracker, week review, hierarchy |
| **Notes** | "What did I want to keep?" | Notes, quick capture, links |

### Decisions and their reasons

**D1 — Remove `CalendarStrip` + `CalendarSidebar` from Gold.**
*Reason:* Gold is longitudinal — a week, a quarter, a phase. A month grid is a *present-tense*
instrument; it answers "what day is it" when Gold's question is "am I on track". Two date
pickers on one page (both present-tense) contradicted the page's own purpose. Date selection
stays on Schedule, which is where dates are the subject.
*Rejected:* keeping a strip "just for habits" — habits are already week-scoped via their own
tracker, so a calendar added no capability it lacked.

**D2 — Move `TodoList` back to Schedule, not Gold.**
*Reason:* I moved it to Gold earlier in this session. That was wrong and this corrects it. A
todo is a dated commitment — it belongs with the schedule, which is the surface that owns
dates. Gold should hold *outcomes*; Schedule holds *the work for a day*. This also restores
what you noticed was missing.
*Note:* the goal hub stays reachable from both — it is per-goal, not per-tab, so it does not
belong to either tab exclusively.

**D3 — Add phases to Gold.**
*Reason:* phases are the longest time-horizon object in the app (a chapter of life), and Gold
is the longitudinal tab. Right now phases exist only in the Life river + note links, so there
is **nowhere to create one**. Gold is the correct home and this is a real gap, not a nice-to-have.

**D4 — Notes editor: write on the left, config on the right.**
*Reason:* writing is the primary action; tags/links/files are *metadata about* the note. When
metadata interleaved with the body, the writing surface was ~512px wide and got interrupted
every few lines. A config rail makes the hierarchy legible and keeps the editor tall.

**D5 — Cards must read as lifted surfaces.**
*Reason:* measured, not guessed — see P4. Cards at `1.03:1` against the page are invisible as
objects; a surface you cannot see is a surface you cannot scan.

---

# P1 — CHARACTER

`variance=3, motion=5, density=7` (variance clamped to 1–5: LAMINAR is a contract).
Density 7 because this is a daily-use data surface.

# P2 — CONCEPT

**No signature element.** A dense internal tool prioritises density over delight. Stated
literally per PAINT.

---

# P4 — TOKENS (the card legibility problem, measured)

The complaint is **correct and I can prove it**. Dark theme, LAMINAR §2 zinc ramp:

| Pair | Ratio | Verdict |
|---|---|---|
| `--color-card` `#18181b` vs page `#09090b` | **1.12:1** | too close to read as a lift |
| `--color-border` `#27272a` vs card | **1.19:1** | below the 1.3 floor for a visible edge |
| `WarmCard ambient` (zinc-900/30) vs page | **1.03:1** | **effectively invisible** |
| `WarmCard normal` (zinc-900/80) vs page | **1.09:1** | barely distinguishable |
| `WarmCard` border (zinc-800/50) over card | **1.28:1** | hairline is nearly invisible |

**Target:** card ≈ **1.35:1** vs page, border ≥ **1.5:1** vs card. Both are still
monochrome — LAMINAR §2 allows no second hue, so separation comes from **lightness steps and
border strength only**.

**Fix (one file, `WarmCard.tsx`):**
- `normal`: solid `--color-card` (`#18181b`) → drops the /80 alpha that was flattening it
- `ambient`: `--color-muted`/40 → a real step above the page, not 30% of a near-invisible tone
- border: `border-border` → `border-zinc-700/60`, and on hover `border-zinc-600/70`
- keep `rounded-xl` (12px) per §4; no shadow, no blur (§7.3)

**Scope discipline:** `WarmCard` is the warmth surface used across the Life page, so one
edit fixes every card the user is complaining about. I will NOT restyle the dashboard widget
cards in the same pass — different surface, different token law, and it would be unrequested
scope.

---

# P5 — STATES

Every surface touched gets all five. Specifically:

- **Phases (new):** empty ("No phases yet — a phase is a chapter of life, like 'move to Jakarta'")
  + CTA · loading skeleton · error + Retry · populated · overflow ("+N more").
- **Notes config rail:** each control keeps its own empty/hover/focus/disabled; destructive
  (remove file / remove link) uses the existing ✕ and never wipes the note body.
- **Gold after D1:** removing two navigators must not leave a dangling `selectedDate` — the
  routines list must state which day it is showing, or the date becomes invisible state.

# P6 — MOTION

**L2 — Responsive.** Disclosure height via `AnimatePresence`, 250ms `cubic-bezier(0.16,1,0.3,1)`.
No springs (LAMINAR §7.4). No decorative loops. Global `prefers-reduced-motion` guard already
exists at `index.css:652`.

---

# Execution order (dependency, not appeal)

1. **Card legibility** — `WarmCard.tsx`, one file. Independent, unblocks scanning every card.
2. **Notes 2-column finish** — already edited, needs its build confirmed.
3. **D1/D2 Gold + Schedule cleanup** — remove 2 calendars from Gold, return TodoList to Schedule.
4. **D3 Phases on Gold** — the only genuinely new feature; needs the empty/loading/error states.
5. **Build + LAMINAR gate + tsc regression diff.**
6. **Verification** — still requires a running app; I cannot click it.

I am doing **1 → 2 → 3 → 4 → 5**, and stopping to report before any of it, because
you asked for the plan first.

---

## What I need from you

- **Confirm or correct D1–D5.** Especially D2 (todos back to Schedule) — I changed my earlier
  decision because you told me the todos were missing from the schedule.
- **Phases on Gold:** should Gold *create* phases, or only *show* existing ones? Creating needs a
  form; showing needs a read-only card. I have `lifePhaseSave` available either way.
