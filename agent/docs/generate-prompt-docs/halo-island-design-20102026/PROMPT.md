# THE HALO ISLAND — Complete Design Mandate

> **Receiving AI: you are the Lead Designer and Engineer.** You already hold the design
> skills (Frontend Design, Human-Centric UX, Impeccable, Motion, UI UX Pro Max, Design
> Taste, frontend-external-infra). This document does not re-teach them. It gives you the
> product, every request the owner made, the exact geometry, the live data, and the law you
> must design inside.
>
> Read `CONTEXT_BUNDLE.md` **before** you answer. It contains the actual source of every
> component, every token value, every payload, and the real database schemas. Do not invent
> a field, a table, a number, or a colour that is not in it.

---

## 1. RAW REQUEST — the owner's words, verbatim, unedited

Newest first. Every one of these is in scope.

```
andl ike the alarm which like idk, like a proper desing should do it

including like the afk thing and like stuff related to the stopwatch being like theres hte
border representing hte amount of time left (on the pill)

the focus session

and also like the ambient stuff and like the focus stuff?

also eerything else htat i requested in which i alreayd pforgot some of them

make sure to use generate-prompt so that u can comunicate to an ai chat htta alreayd has
that context of like designing things

for the island

INCLUDE EVERYTHING THAT I REQUESTED

the laram system thwith the dealine thing or like anything related to the stopwatch for the
toodlist or like a sbumissions or smth

and like how r u going to communicate it with claude that is going to gen rerate the desing
for u

it should also have the design for everything that i requested no?

and laos like the more importnat things is oconnecting oth reminders nad like the alarms
feature where eadch dealine tehrhes like u can set when the alarm or reminder goes off, os
it should belike htta

and it hosuld show like the nearest schedule and not just htesubmissino

basicall all related to the life schedule page

MOVE IT TO THE FOCUS THING, liKE THE FOCUS DOESNT LOOK LIKE A FOCUS BECAUSE ITS NOTE EVNE
ONNECTED TO THE FOCUS FEATURE

MAKE SURE U ADD THE OCNNECTION TO THE FOCUS FEATURE OF LIKE THE LOCKIGN TO PREVENT FRO MAPPS
AND STUFF

it only shows 1 schedule deadline and cant show anything else. i cant view others, so make
sure that to add those

i can see like some psace on the right side

make sure that if i add new stuff it doesnt break the ui

the productivity neutral, distracting category that is supposed to give the scent or like
ambient color

TWO FUCKING STOPWATCH

THE APP NAME OR THE WEBSITE NAME … ACCORDING TO THE THING

Move the island
```

Everything above is a **requirement**, including the ones he says he has forgotten. §5 is
the numbered list derived from it. If you drop one, the deliverable is incomplete.

---

## 2. Context

**RHEO** is a personal productivity tracker (Electron + React + TypeScript, SQLite). It
tracks foreground apps and browser sites into productive / neutral / distracting tiers,
holds a Life schedule (`schedule_entries`), deadlines (`deadlines`), their alarm rows
(`deadline_reminders`), a stopwatch store, and a **Focus** feature that blocks distracting
apps/sites during a session.

**Halo** is RHEO's always-on-top island — its own frameless transparent window parked at the
top of the display. It is the app's most-seen surface and its most-constrained one:

| Preset | Compact pill | Expanded panel | Row | Type scale |
|---|---|---|---|---|
| Small  | 182 x 28 | 480 x 118 | 48px | 0.85, icon-only tabs |
| Medium | 198 x 32 | 560 x 134 | 56px | 1.00 |
| Large  | 227 x 40 | 680 x 154 | 64px | 1.20 |

The expanded panel is **one content row plus a 44px tab rail**, fixed:

```
Medium: 1 border + 12 pad + 56 row + 8 gap + 44 rail + 12 pad + 1 border = 134
Small:  1 + 8 + 48 + 8 + 44 + 8 + 1 = 118
Large:  1 + 16 + 64 + 12 + 44 + 16 + 1 = 154
```

**Three tabs only: `Focus · Schedule · Tools`.** The panel never resizes for data. A page
that needs more scrolls inside its 56px row. The island is a **glance** surface: the user
looks at it for under two seconds while doing something else. It is not a second app window.

**What already exists** (this week's work — the plumbing is done, the design is not): a real
stopwatch readout with the tracked app/site name; a drag-to-move gesture on the pill; an
ambient tier ring; a Focus page wired to the real `FocusManager`; and a Schedule page
showing the nearest recurring class block plus every open deadline with its alarm.

**What is raw** — and what this mandate is about: those surfaces are currently *markup with
inline styles*. There is no designed hierarchy, no designed state change, no designed
overflow, no designed alarm, no designed AFK, and no designed relationship between the
stopwatch and the work that is due.

---

## 3. Problem statement

The owner asked for five things and got five implementations. He is now asking for the
**design** of them, because the implementations read as ad-hoc:

- The open island has **one clock and a name**, and then empty space.
- A **focus session** changes the content but not the *feeling* — the island does not look
  like it noticed that the machine is now enforcing a lock.
- The **Schedule page** lists real data that does not read as "your day".
- The **ambient ring** is a 1px technical artifact, not a state you can feel.
- **AFK** is the one state the pill actively hides, so the island disappears exactly when
  the user has walked away and would most want to know how long.
- The **pill border carries no information at all**, and the owner wants it to carry *time
  left*.
- An **alarm** is a bell glyph and a string. It has no state, no priority, and no way to be
  set from the island.
- Nothing connects the **stopwatch** to the **deadline / submission** it is being spent on.

---

## 4. The skills you already have, and how each must fire here

You are expected to apply these; name which one produced each decision.

| Skill | What it must contribute **to this surface** |
|---|---|
| **Frontend Design** | The component patterns, the type scale, the spacing rhythm, and the z-ladder — inside a 560x134 box, not a page. |
| **Human-Centric UX** | All four states per element (empty / loading / error / populated), progressive disclosure in a surface with **no room to disclose**, and the six pillars applied at 2-second glance speed. |
| **Impeccable** | The 7 domains and the 27 anti-patterns. Especially: optical alignment of mixed mono/proportional text, numeral width stability, and never carrying meaning by colour alone. |
| **Motion — Bring the UI Alive** | A **Liveliness Level** with a reason, a motion inventory per surface, and the reduced-motion fallback. The island is L1/L2 — it may acknowledge, it may not perform. |
| **UI UX Pro Max** | The developer-tool / personal-analytics rule set: density, restraint, no consumer playfulness in a data row. |
| **Design Taste System** | The knobs, written down. On App UI, `DESIGN_VARIANCE` is clamped to **1–5**; the anti-repetition rules are **void** here (LAMINAR caps type families at 2 and one signal hue per surface, so rotation is drift). |
| **frontend-external-infra** | Source routing + re-skin. Pull real components; do not hand-invent one that a registry already has. |

### 4.1 Registry inventory you may pull from (verified present in this project)

| Component | Registry | Use for |
|---|---|---|
| `status-island` | `@kokonutui` | **The closest existing precedent**: a pill that reports background work, reshapes as tasks change, opens into a list of what is in flight. Study its shape logic. |
| `undo-button` | `@kokonutui` | "time left drawn around its own edge" — the exact border-as-time-left mechanic the owner asked for. |
| `apple-activity-card` | `@kokonutui` | Progress rings that draw with a count-up and lap past 100% with a shadowed end cap. |
| `morph-popover` | `@kokonutui` | A button that grows into the form it opens and shrinks into a confirmation — candidate for the alarm editor. |
| `hold-button` | `@kokonutui` | Press-and-hold to confirm, with a fill that drains back on early release. Candidate for the destructive parts. |
| `command-button` | `@kokonutui` | Shortcut keycaps that sink on the real key press. Candidate for the pill's keyboard affordance. |
| `smooth-drawer`, `stack-panel` | `@kokonutui` | Sheet / drill-in patterns, if the alarm needs a second level. |
| `gauge-chart`, `ring-chart` | `@bklit` | **Only if** a radial progress is genuinely the right mechanic (they are charts; the pill ring is not a chart — say so if you reject them). |
| `card`, `button`, `badge`, `separator`, `scroll-area`, `tooltip`, `toggle-group`, `progress` | `@shadcn` core | Baseline primitives to re-skin. |
| `Bell`, `BellRing`, `Lock`, `CalendarClock`, `Timer`, `Coffee`, `Globe`, `AppWindow`, `RotateCcw`, `Pause`, `Play`, `ArrowRight`, `ChevronDown` | `lucide-react` | The only icon set. No emoji, no mixed sets. |

**Re-skin law (this overrides the generic anti-slop checklist):** after pulling, every
colour becomes a `--halo-*` / `--tier-*` token, every radius becomes 8 / 12 / pill, the
fonts become Inter + JetBrains Mono only, and **glassmorphism is banned** — LAMINAR §7
requires flat surfaces with hairline borders. Do not import a registry's palette, its
springs, or its blur. If a pulled component's motion is spring-based, it is rejected or
re-timed to `damping: 1.0`.

---

## 5. Requirement checklist — everything, numbered

Every item is **in scope**. "Design" means: hierarchy, exact pixels, tokens, states, copy,
motion. Not "make it nicer".

### The pill (compact, 198x32)

- **R1 — One clock, one name.** "I have been in Figma for 42 minutes" is **one statement**.
  The app/site name belongs *with* the stopwatch, not in a separate block. Never print the
  same clock twice ("TWO FUCKING STOPWATCH").
- **R2 — The name is the thing in front of you.** Desktop app → the app name. Browser →
  the **website/domain**. Private window → the words "Private window" and **never** a
  hostname.
- **R3 — Move the island by dragging the pill.** Click-and-hold on the pill itself, not a
  Settings-only control. Needs: grab affordance, dragging feel, settle behaviour, and a
  visible affordance that does not compete with the clock.
- **R4 — The border represents time left.** The pill's edge should encode *how much time is
  left*, depleting as it goes. This is the owner's newest ask and it has **no
  implementation**. It must coexist with the ambient ring (R5) on the same 1px edge —
  resolve that conflict explicitly.
- **R5 — Ambient edge glow, by productivity tier.** "The productivity / neutral /
  distracting category that is supposed to give the scent, or ambient colour." Chosen
  treatment: **edge glow only**, no background tint. Green productive · blue neutral · red
  distracting, from the live foreground-app reading. It must not look broken when neutral,
  must not look broken when off, and must not become a second accent.
- **R14 — AFK, and it should go red.** The island must handle being away. Today the pill is
  **actively suppressed** when the AFK slot is live (`composed.live.kind !== 'afkGap'`),
  because the coffee pip overflowed the 32px pill — so the island vanishes exactly when the
  user walks away. **The owner's instruction: "the afk should like turn the thing like afk
  red or smth."** Design it: the pill stays, the edge/state turns red (which red, at what
  weight, against the distracting-tier red so the two cannot be confused), what the clock
  shows while frozen, the return acknowledgement ("you were away 12m"), and the recovery.
  Note: AFK preferences live in `src/lib/afk.ts` (threshold, pause-vs-reset behaviour) and
  the stopwatch freezes **without** setting `paused` — so `paused` cannot be the signal.
  Resolve the collision: AFK red vs distracting-tier red vs overdue-amber must be three
  distinguishable states on a 1px edge.

### The Focus page

- **R6 — The Focus page must be connected to the Focus feature.** "The focus doesn't look
  like a focus because it's not even connected to the focus feature." It now reads the real
  `FocusManager.getPublicState()`. Make it *look* connected.
- **R7 — The lock.** "Add the connection to the focus feature, of like the locking to
  prevent apps and stuff." The row must state what is being enforced, distinguish
  `distracting` ("Locked") from `non_allowed` ("Allow-list"), and carry the full rule.
- **R8 — The focus session.** This is the owner's last clarification, and the centrepiece.
  Design the **running session state**: eyebrow `FOCUS`, lock chip, session countdown, and
  `ENDS hh:mm`. An open-ended session (`endsAt === null`) counts **up** and reads
  `ENDS no limit`. A **paused** session must not claim to be live. The stopwatch controls
  must disappear while a session runs (they would lie), and the transition *into* the
  session must be felt, not just swapped.
- **R9 — Delete the "Now" tab.** Done structurally; ensure nothing of it survives visually.

### The Schedule page

- **R10 — Show the nearest schedule, not just the submission.** The nearest recurring class
  block (`schedule_entries`) and the open deadlines are one picture.
- **R11 — Show ALL open deadlines, not one.** "It only shows 1 schedule deadline and can't
  show anything else." They scroll inside the fixed row.
- **R12 — Adding data must never break the UI.** Fixed height, fixed rows, overflow scroll.
  Prove it at 1, 3, 10 deadlines.
- **R13 — The right side must earn its space.** "I can see like some space on the right
  side." The old page had a divider and emptiness.
- **R15 — Each deadline carries its alarm/reminder.** The alarm the user set must be
  visible, and must distinguish **pending** from **fired**, **relative** ("1d before") from
  **absolute** ("19:00"), and **none**.
- **R16 — Set the alarm properly.** "Connecting the reminders and alarms feature where each
  deadline … you can set when the alarm or reminder goes off." And: "like a proper design
  should do it." The island cannot host a full date picker — **design the actual
  interaction**: a compact quick-pick (1 day before · 1 hour before · custom → opens the
  page), a morphing popover, or an honest hand-off. It must be reachable without a mouse,
  and it must show what is already set.

### Everything

- **R17 — The stopwatch ↔ deadline / submission connection.** "Anything related to the
  stopwatch for the todo list or like a submissions." The timer must relate to the work that
  is due. Design: how a deadline becomes the stopwatch's subject, what the pill says while
  tracking one, where the elapsed time appears on the Schedule row, and how it ends.
  **Design only** — specify behaviour against the data in the bundle; do not write IPC.
- **R18 — LAMINAR for all of it.** The constitution is the law: nine colours, one signal hue
  per surface, radii 8/12/pill, two fonts, no glass, no gradient chrome, no spring, no raw
  hex, `prefers-reduced-motion` honoured.

---

## 6. Engineering task — the logic you must specify (not just pixels)

You are the engineer too. For each of these, give the **rule**, the **inputs**, the
**formatting**, and the **edge cases**:

1. **Time-left ring (R4).** What is "time left" when a focus session runs
   (`endsAt - now`)? When no session runs, there is **no target** — so what does the border
   do? (Our position: it must not invent progress. A ring with no bounded target is a lie.
   Either it is absent, or it is a different, honest state.) Define: the denominator, the
   tick (1s? 1m?), what happens at 0, what happens when the session is open-ended, and how
   the ring composes with the ambient tier ring on the same 1px edge.
2. **Ambient tier (R5).** The source is `currentApp.tier`, classified per foreground app or
   domain. Define the mapping to ring + bloom per theme, the transition (property and
   duration, or a hard cut), and the neutral and off states.
3. **AFK (R14).** Inputs: `awayMs`, `since`, the frozen stopwatch, the AFK preference
   (pause-only vs pause-and-reset). Define the thresholds for "just now" / "away" / "long
   away", and the return acknowledgement.
4. **Nearest block (R10).** Recurring weekday + `HH:MM`, today's finished block rolls to next
   week, `isNow` when start ≤ now < end. Define the label for each case and the exact
   countdown formatting.
5. **Deadline order and formatting (R11/R13).** Soonest first; overdue first or by date?
   Define `dueAt` → `21 Aug` / `today` / `in 3d` / `61d overdue`; the 0-day boundary; and
   null-date handling.
6. **Alarm derivation (R15/R16).** `deadline_reminders` is the source (`mode`, `lead_min`,
   `remind_at`, `fired`); `deadlines.remind_at` is legacy fallback only. Define which alarm
   a row prints when there are several (pending first, then the one that last fired?), how a
   relative alarm is displayed without inventing a clock time, and how "fired" differs from
   "pending" **without** a second hue.
7. **Overflow (R12).** How many rows fit at 48 / 56 / 64px, and the exact overflow
   treatment.
8. **Tracking a deadline (R17).** What starts it, what stops it, what the pill shows, what
   happens if the app closes mid-session, and whether elapsed time is persisted per deadline.

⚠ **Backend status, verified:** `halo:get-focus`, `halo:get-life`, and
`halo:get-next-deadline` exist and return real data. `deadline_reminders` exists and is
written by the app's reminder UI. **A known pre-existing bug** (`add-deadline-reminder`
stores `remind_at = NULL` for `mode='relative'`, while the ticker requires
`remind_at IS NOT NULL`) means relative reminders never fire today. Design as if it is
fixed; flag it once, do not fix it in this brief. There is **no** per-deadline time-tracking
table — if R17 needs persistence, say so explicitly as a backend gap.

---

## 7. Design task — the high-fidelity spec

For **every** element you touch, return:

- exact size (w × h) and position within the 526 × 56 content area (Medium), and the
  behaviour at 480 × 48 (Small), 680 × 64 (Large), and the clamped **380px** narrow case;
- the token for every colour, radius, gap, weight and size — **no raw hex**;
- the type role (`--halo-t-eyebrow` / `label` / `value` / `hero`), the font, the weight,
  the tracking, and the truncation order;
- the empty, loading, error, populated and overflow states;
- hover / focus-visible / active / disabled for anything interactive;
- the copy, in the exact character budget that fits.

Then the **composition**: show the four surfaces as they appear in sequence (pill → focus
stopwatch → focus session → schedule), and prove the panel is still 134px in all four.

---

## 8. UX task — the interaction flow

Write the flow as state transitions, for:

1. Pointer-down on the pill → drag → release (including clamping and reversal mid-flight).
2. No session → session starts (what the user sees, in what order, over what duration).
3. Session → paused → resumed → ended (including the final 60 seconds and the moment of 0).
4. AFK trip → return → acknowledge (and what the clock says on both sides).
5. Deadline with no alarm → set one → see it (the full round trip, in ≤ 134px).
6. Two deadlines → ten deadlines (overflow, selection, and what stays pinned).
7. Error on read → retry → recovered.
8. Keyboard-only path through the rail, the pill, and the alarm control.

---

## 9. Hard constraints

1. Panel height **fixed**: 118 / 134 / 154. A page may never exceed `rowHeight`.
2. **Three tabs.** No fourth page.
3. **Minimum type 11px** at every preset.
4. **Two font families maximum**: Inter + JetBrains Mono.
5. **Radii 8 / 12 / pill only.**
6. **No** glass, gradient chrome, neon, emoji, mixed icon sets.
7. **No raw hex/rgba in component code.** Tokens only.
8. **No spring/bounce.** `damping: 1.0` only.
9. **No new dependency.** `motion` v12 + `lucide-react` are present.
10. **Light mode is first-class.** Every colour resolves to a token with an `html.light`
    value; accent-coloured text in light mode uses `--ws-accent-text`, not `--ws-accent`.
11. **Nothing mouse-only.**
12. **22px rows are display-only.** If you make one interactive, its target must be ≥ 44px —
    so design around the 22px row rather than pretending it is a button.
13. **Motion budget L1/L2.** No decorative infinite loops. The border ring depleting is a
    *functional* loop and is allowed; a breathing glow is not.
14. **The ring is shared state.** Progress (R4) and ambient tier (R5) both want the edge.
    One must own the stroke; the other must own something else (fill? bloom? inset line?).
    State the split once and use it everywhere.

---

## 10. Deliverable

Return, in this order:

1. **Design thesis** — one sentence per surface (pill, focus stopwatch, focus session,
   schedule, alarm, AFK). Meaning, not vibes.
2. **The edge model** — the single ruling on progress vs ambient vs AFK on one 1px border,
   with the visual grammar for each.
3. **Token table** — every element → token/class → value. New tokens named and placed.
4. **Markup** — exact JSX for each changed block, against the real props and payloads in the
   bundle. Inline `style={{}}` with `var(--halo-*)` is the house style; Tailwind is acceptable
   where already used.
5. **State matrix** — empty / loading / error / populated / overflow, per surface.
6. **Motion spec** — enter, exit, hover, press, the session transition, and every
   `prefers-reduced-motion` fallback.
7. **Interaction flows** — §8, as transitions.
8. **Engineering rules** — §6, as formulas and formatting tables.
9. **Coverage table** — R1…R18 → where you addressed it. **Every row must be filled.**
10. **What you refused, and why** — with the alternative. The owner overrides you, but he
    must be told.

**Do not** offer Option A / B / C. Make the call, justify it, and note what it cost.

---

## 11. Questions to settle with a ruling

1. Where does an alarm actually get **set**? (quick-pick inside the panel · morphing popover
   · honest hand-off to `/deadlines`). The owner asked for the connection *and* "a proper
   design".
2. When the stopwatch is tracking a deadline, does the **deadline title replace the app
   name** on the pill, or sit beside it? R1 says the name belongs with the clock.
3. How many schedule rows are visible, and what is the overflow affordance?
4. What is the **neutral** ring, exactly — visibly different from `off`, not a second accent?
5. For an unbounded stopwatch (no session), what does the time-left border do?
6. AFK: does the pill **stay** and change, or hide? (Today it hides, and the owner is asking
   for the AFK thing to be designed.)
7. R17: does elapsed time persist per deadline (a backend gap), or is the connection
   informational only?
