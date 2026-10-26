# Halo Island — LAMINAR Design Brief

> **You are the Architect.** You are being asked to **design**, not to audit, not to
> re-architect, and not to write a plan. The backend and the data plumbing already exist
> (they were built and measured this week). What does not exist is the **visual and
> interaction design** for four surfaces inside a 560x134px fixed panel.
>
> Read `CONTEXT_BUNDLE.md` before answering. It contains the real source, the real token
> values, the real DB schemas, and the live data these surfaces render. Do not invent a
> field, a table, or a number that is not in it.

---

## 0. What the deliverable is

Return **one design**, not options. It must contain, in this order:

1. **The design thesis** — one sentence per surface. What it means, not what it looks like.
2. **A token table** — for every element you specify: `element -> CSS variable / class`,
   with the actual value. No raw hex in component code (LAMINAR §7). If a value does not
   exist in the token list in §4, you must **name the new token and say where it goes**.
3. **The markup** — exact JSX for the changed blocks, written against the existing
   component API (props and payload shapes in §6). Inline `style={{}}` with `var(--halo-*)`
   is the house style in this file; Tailwind classes are acceptable where the codebase
   already uses them.
4. **The state matrix** — for each surface: empty / loading / error / populated / overflow.
5. **The motion spec** — enter, exit, hover, press, and the reduced-motion fallback. LAMINAR
   §6 durations only.
6. **The "what I refused" list** — anything the user asked for that you believe is wrong,
   with the reason and the alternative. The owner overrides you, but he must be told.

Everything must fit the fixed geometry. A design that needs 10 more pixels is not a design.

---

## 1. The product, in one paragraph

**Halo** is RHEO's always-on-top island. It lives in its own frameless, transparent
Electron window parked at the top of the display. Collapsed it is a **198x32 pill** that
shows the live stopwatch and what is being tracked. Hovering (or pinning) expands it into
a **560x134 panel** containing exactly **one content row** and a **44px tab rail**.

The expanded panel is a fixed preset, not a content-driven box:

```
Medium:  1 border + 12 pad + 56 row + 8 gap + 44 rail + 12 pad + 1 border = 134
Small:   1 + 8 + 48 + 8 + 44 + 8 + 1  = 118   (480 wide, icon-only tabs)
Large:   1 + 16 + 64 + 12 + 44 + 16 + 1 = 154 (680 wide, labels)
```

There are **three tabs only**: `Focus · Schedule · Tools`. The panel never resizes when
the data changes. Every page is **one row**; anything longer scrolls **inside** that row.

The island is a *glance* surface. It is not a second app window. The user looks at it for
under two seconds while doing something else.

---

## 2. Every request the owner has made — including the ones he has forgotten

This is the complete list, reconstructed from the working session. **All of it is in
scope for this brief** except where the "Design needed?" column says no.

| # | The request (owner's words where they were recorded) | Surface | Current state | Design needed? |
|---|---|---|---|---|
| R1 | "I have been in Figma for 42 minutes" is **one statement** — the app/site name belongs *with* the stopwatch, not in a separate block. | Pill + Focus row | Implemented: name sits in the same group as the clock, with a 1px hairline separator. | **Yes** — make that grouping beautiful. |
| R2 | "TWO FUCKING STOPWATCH" — the open island must never print the same clock twice. | Focus page | Implemented: the `PRODUCTIVE 3:12:40` second figure was removed. One clock only. | **Yes** — the right side now needs a designed identity. |
| R3 | "Make it so I can move the island" — click-and-hold **on the pill itself**, not Settings-only. | Compact pill | Implemented end-to-end (host reports cumulative offset; main persists). No visual language for it. | **Yes** — the grab / dragging / settled states do not exist visually. |
| R4 | "Ambient … the productivity / neutral / distracting category … the scent, or ambient colour." He then chose **"Edge glow only"** over a background tint. | Pill edge | Implemented: a 1px `--tier-*` ring + a 14px 30% bloom, layered on the existing `--halo-shadow`. No motion, no threshold design. | **Yes** — this is the main ambient design problem. |
| R5 | "The focus doesn't look like a focus because it's not even connected to the focus feature." | Focus page | Implemented: real `FocusManager` state, countdown, lock chip, ENDS. | **Yes — this is the centrepiece. See §5.2.** |
| R6 | "Move it to the Focus thing" — delete the **Now** tab, fold anything worth keeping into Focus. | Tabs | Implemented: `now` removed from the page id union, defaults, rail, settings preview and the legacy rail map. | No — removing it was a correction, not a design. |
| R7 | "It only shows 1 schedule deadline and can't show anything else. I can't view others." | Schedule page | Implemented: nearest recurring class block **plus every open deadline**, soonest first, in a 56px scroller. | **Yes.** |
| R8 | "It should show like the nearest schedule and not just the submission." | Schedule page | Implemented: `schedule_entries` (recurring weekday + HH:MM) is read alongside `deadlines`. | **Yes** — the two data kinds must read as one picture. |
| R9 | "Connecting the reminders and alarms feature where each deadline … you can set when the alarm or reminder goes off." | Schedule row | Partially: the island **reads** `deadline_reminders` and prints the alarm ("1d before", "19:00"). It does **not** let you set one. | **Yes — the biggest open design question. See §5.4.** |
| R10 | "Make sure that if I add new stuff it doesn't break the UI." | Schedule page | Implemented structurally: fixed 22px rows, fixed height, `flexShrink:0`, overflow scroll, wheel `stopPropagation`. | **Yes** — overflow needs a designed affordance; right now a 3rd row simply clips. |
| R11 | "I can see like some space on the right side" — the old page had a divider and emptiness. | Schedule page | Implemented: four facts per row (title, due day, alarm, remaining). | **Yes** — check the right edge actually earns its width. |
| R12 | "It should also have the design for everything that I requested." | All | **Not done.** This brief is that request. | **Yes.** |
| R13 | "Anything related to the stopwatch for the todo list or like a submissions" — he wants the stopwatch to relate to schoolwork, not float free. | Focus + Schedule | **Not built, not designed.** There is no link between a deadline and time tracking. | **Yes — design only. See §5.5.** |

### Deliberately out of scope

- Backend, IPC, schema, migrations, the tracker daemon. All exist.
- The Settings page as a whole. Only the Halo ambient control (§5.6) is in scope.
- The legacy (non-Figma) island layout. It renders `StopwatchHeroExpanded` and is not
  being redesigned here.
- The compact pill's body except for the ambient ring and the drag affordance.

---

## 3. Hard constraints (physical and legal)

These are not preferences. Violating any one of them means the change cannot ship.

1. **The panel height is fixed.** 118 / 134 / 154. A page may never exceed `rowHeight`
   (48 / 56 / 64). If your design needs more, it must scroll or it must be cut.
2. **Three tabs.** No fourth page. The rail is 44px and already full.
3. **Minimum type is 11px** at every preset. `--halo-scale` floors every role at 11px.
4. **Two fonts maximum per view.** In the island: **Inter** (UI/body) and
   **JetBrains Mono** (numerals, labels, metadata). No third family.
5. **Radii are 8 / 12 / pill.** Nothing else. No `rounded-2xl`, no `rounded-3xl`.
6. **No glassmorphism, no gradient chrome, no neon, no emoji.** lucide icons only.
7. **No raw hex in component code.** `var(--halo-*)`, `var(--tier-*)`, `var(--ws-*)` only.
8. **No spring / bounce.** `damping: 1.0` only, and only where motion carries meaning.
9. **No new dependency.** `motion` v12 and `lucide-react` are already present.
10. **The island must remain readable in light mode** ("Warm Paper"). Every colour you
    choose must resolve to a token that has an `html.light` value. Accent-coloured **text**
    in light mode uses `--ws-accent-text`, not `--ws-accent`.
11. **Nothing may be mouse-only.** The rail and the pill are keyboard reachable today.
12. **The 22px row is display-only.** It is not a button. If you make a row interactive,
    the target must be ≥ 44px, which means it cannot be a 22px row — design around that.

---

## 4. The design system you must work inside

### 4.1 LAMINAR (the app constitution, `design/design.md`)

- **Base:** monochrome zinc. Surfaces step `#09090b` → `#18181b` → `#27272a`.
- **One signal hue per surface.** The island's signal is **sage `#6fb38f`** in dark,
  **deep teal `#0e7490`** in light. It means *live / recording / active* — nothing else.
- **Depth is hairline + one shadow.** No per-component shadow, radius or border.
- **Motion:** 150 / 250 / 400ms, `cubic-bezier(0.16,1,0.3,1)`. Page enter: opacity 0→1,
  y 16→0, 250ms. No decorative infinite loops in app UI.
- **Heat is semantic, not decorative.** `--halo-signal` (amber) is *overdue*.

### 4.2 The island's own tokens (`src/features/halo/halo.css`)

Dark:

```
--halo-surface   #09090b   the card
--halo-raised    #18181b   the tab rail track
--halo-tab       #27272a   the SELECTED tab pill
--halo-border    #2e2e33
--halo-text      #fafafa
--halo-muted     #a1a1aa
--halo-dim       #8b8b94   metadata that is still read
--halo-accent    #6fb38f   the ONLY accent
--halo-signal    #d97706   overdue only
--halo-radius-compact  9999px
--halo-radius-expanded 12px
--halo-radius-card     12px
--halo-radius-control   8px
--halo-shadow   0 12px 36px rgb(0 0 0 / .32)
```

Light (`html.light`):

```
--halo-surface  #fcfbf8   --halo-raised #f5f2ec   --halo-tab #edeae2
--halo-border   rgb(28 25 23 / .10)
--halo-text     #1c1917   --halo-muted #57534e   --halo-dim #6f665e
--halo-accent   #0e7490   --halo-on-accent #ffffff
--halo-shadow   none      <-- depth comes from hairlines, never shadow
```

Type scale (scales with the preset, floored at 11):

```
--halo-t-eyebrow  max(11px, 11 * scale)   JetBrains Mono 400, .08em, UPPERCASE
--halo-t-label    max(11px, 12 * scale)   Inter 400 / metadata
--halo-t-value    max(11px, 14 * scale)   JetBrains Mono 500 / a value
--halo-t-hero     max(22px, 26 * scale)   the one numeral per surface
```

Rhythm: `--halo-gap-hair 4 · tight 6 · gap 8 · loose 12 · block 16` (all scaled).
Weight: 400 / 500 / 600 only. 700 is reserved for the hero numeral.

### 4.3 The productivity tiers (`src/index.css`)

```
--tier-productive  #22c55e      (light: #166534)
--tier-neutral     #3b82f6      (light: #1d4ed8)
--tier-distracting #ef4444      (light: #b91c1c)
--tier-*-muted     12% mixes of the above
```

These are the **only** colours the ambient edge may use. They are data, not chrome —
which is why they are an exception to "one signal hue per surface". The exception is
bounded: **the ring, and nothing else.**

---

## 5. The surfaces

### 5.1 The compact pill (198x32)

Current anatomy, left to right: status dot (6px) · label (the tracked app/site) ·
clock · optional pin. During a drag the whole pill is the handle.

Design what is missing:

- **Grab.** The pill has no affordance that says "you can move me". It must not add a
  visible handle that competes with the clock. Options to consider: a `grab` cursor plus a
  *2px lift and 1px brightness step* on press, a hairline that appears only on hover, or
  nothing visible at all. Choose one and justify it.
- **Dragging.** It must feel attached to the pointer: no easing during the drag, offset
  applied directly, the shadow staying constant (the pill is *lifted*, not resized).
- **Settled.** On release: snap to the nearest 8px of the drag axis? No — it is free
  placement, but it must clamp to the display. Decide whether it animates back inside
  bounds (≤ 200ms) or clamps silently.
- **The ambient ring** — see §5.3.

### 5.2 The Focus page — **the stopwatch state and the session state**

This is the surface the owner is angriest about, and the one he named last. It has **two
mutually exclusive states**, and the transition between them is the design problem.

**State A — no session. The stopwatch.**

```
● STOPWATCH · Figma            00:42:18        [reset] (pause)
```

- dot = live (accent) / paused (dim)
- eyebrow = `Stopwatch`, uppercase mono
- name = the tracked app or site, medium weight, truncates with an ellipsis
- clock = split: hours dim (`--halo-dim`), `mm:ss` bright (`--halo-text`), 26px mono
- two 44px round controls on the right; pause is the only solid accent fill, and its
  glyph is `--halo-on-accent`

**State B — a real focus session is running.**

```
● FOCUS  🔒 Locked   00:24:51              ENDS 18:40
```

- eyebrow becomes `Focus`
- a lock chip: 11px lucide `Lock` in accent + the word `Locked` or `Allow-list`
  (full rule in `title`: "Distracting apps and sites are blocked" /
  "Only the apps and sites allowed in this session are open")
- the clock is the **session** countdown, not the stopwatch
- an open-ended session (`endsAt === null`) counts **up** and reads `ENDS no limit`
- the stopwatch controls are **gone** — they would lie about what they control

**What to design, specifically:**

1. **The switch.** Right now A→B is a content swap with no motion and no acknowledgement.
   Design it so the user *sees* that the island has noticed a focus session started.
   LAMINAR forbids decoration; it does not forbid meaning. Suggested direction: the
   eyebrow cross-fades (`Stopwatch` → `Focus`) while the lock chip slides in from the
   group's edge, 150ms, no bounce. Justify or replace.
2. **The lock chip.** It is currently a bare icon + word at 11px. It carries the single
   most important fact on the surface (the machine is enforcing something). It needs a
   visual weight that is legible but not a second accent. Consider a 1px hairline capsule
   with 6px horizontal padding — but only if it does not eat the app-name width.
3. **The ENDS block.** It sits where the productive subtotal used to be, and it is the
   weakest element on the row: an 11px eyebrow over an 18px mono value, both muted. Design
   its hierarchy so "when does this end" is answerable at a glance. It must still read
   `no limit` honestly for an open-ended session — never an em-dash, never `--:--`.
4. **The width budget.** At Medium the row is 526px wide. In state B the left group is
   eyebrow + lock + clock; the right is ENDS. In state A the left group is eyebrow +
   hairline + icon + name + clock; the right is two 44px buttons. Prove both fit at 526,
   at 480 (Small), at 680 (Large), and at the clamped 380px width when the display is
   narrow. State the truncation order: **name truncates first, then ENDS collapses to the
   clock only, never the countdown.**
5. **Paused session.** `paused` exists in the payload. The current code ignores it in
   state B. Decide what a paused focus session looks like — the dot must not claim live.

### 5.3 The ambient edge

The owner's ask: the pill should carry "the scent" of what he is doing — productive,
neutral, distracting — **without** tinting the background.

Current implementation: on the pill's `boxShadow`,

```
var(--halo-shadow),                      <- the designed elevation, preserved
0 0 0 1px var(--tier-<tier>),            <- the ring
0 0 14px color-mix(in srgb, var(--tier-<tier>) 30%, transparent)
```

Tier source: `currentApp.tier` (the live tracker reading of the foreground app/site), with
the stopwatch tier as fallback.

**What to design:**

1. **Legibility on both themes.** A 30% bloom of `#22c55e` on `#09090b` is a different
   object from a 30% bloom of `#166534` on `#fcfbf8`. Give per-theme values, not one.
2. **Neutral must not look broken.** Neutral is a real state ("you are in a neutral app"),
   not "no data". It must be visibly different from `ambient: off` without becoming a
   second accent. Consider: the ring takes `--halo-border` at neutral and only the bloom
   takes the tier hue.
3. **Transitions.** The tier changes when the foreground app changes, which can be every
   few seconds during task switching. A 250ms colour transition on `box-shadow` may
   repaint constantly. Decide: transition (and how cheap), or hard cut. LAMINAR forbids
   `transition-all`; name the exact property.
4. **The off state.** `ambient: 'off'` must be a real, honoured value that looks
   *deliberate*, not like the feature failed.
5. **Do not** add a pulse, a breathe, or any infinite loop. The ring is a state, not a
   heartbeat. (A functional loop would be allowed; this is not one.)
6. **The reduced-motion variant.** If you transition the colour, the fallback is a cut.

### 5.4 The Schedule page — nearest class block + every open deadline

One 56px scroller. Current rows are 22px, display-only:

```
📅 NEXT  ALGO PROG                    Wed 09:20 · in 10h
● C Programming BNCC        21 Aug  🔔 1d before   61d overdue
● NAR                       19 Oct                   1d overdue
```

Four facts per deadline row: **title** (the only thing that truncates) · **due day** ·
**alarm** · **remaining**. Overdue is the only signal hue on the row.

**What to design:**

1. **Two kinds, one picture.** A class is *upcoming and recurring*; a deadline is *due and
   one-shot*. They currently differ only by icon and eyebrow, which reads as two lists
   stacked. Give them a hierarchy that says "this is your day" without a section header
   (there is no room for one).
2. **"NOW" vs "NEXT".** When a class has started but not ended, the right side reads
   `until 13:00` instead of a countdown. Design the NOW state — it is the one moment this
   page is more urgent than a list.
3. **Overflow.** The owner's own complaint was "I can only see one". Three rows fit in
   56px at 22px each; the fourth is cut. A scrollbar is not a design. Decide one:
   - a fade at the bottom edge that implies "more below", plus rows that scroll under it;
   - a compressed 2-line row for the pinned class, freeing a third deadline slot;
   - a count chip (`+3`) that expands the list on click.
   State how many rows are visible at 48 / 56 / 64 and what happens at 10 deadlines.
4. **The alarm.** It currently prints `1d before` for a relative reminder and `19:00` for
   an absolute one, in muted mono, with a bell. There is no way to tell "this will fire"
   from "this already fired" — `fired` is in the payload and unused. Design the difference
   with weight or icon, **not** a new hue.
5. **No alarm.** A deadline with none shows nothing. That is honest, but it also means the
   most dangerous row (due, no reminder) is the quietest. Decide whether that gets a mark.
6. **The error and empty states** exist (`Retry` / `Open Schedule`) but were written as
   markup, not design. Give them the same treatment, with the copy rules in §7.

### 5.5 **The stopwatch ↔ deadline connection** (R13 — not built)

The owner's ask, reconstructed: *the stopwatch should relate to the todo list and to
submissions* — not float free as a global timer. He wants to see that the time he is
spending belongs to the work that is due.

This is **design only**. Do not specify new IPC; specify what the island must show and
what the interaction is, assuming the data in §6.

Design **one** of these, and say why the others lose:

- **A. Track-this deadline.** The Schedule row gains a single affordance (a play glyph or
  the row itself) that starts the stopwatch *against* that deadline. The Focus page then
  reads `STOPWATCH · C Programming BNCC` instead of the app name, and the Schedule row
  shows the elapsed time in place of the due day.
- **B. Time-so-far, read-only.** The stopwatch stays global; each deadline row gains a
  small `tracked` figure (e.g. `2h 14m`) read from existing session data. No new
  interaction; the connection is informational.
- **C. Submission mode.** When a deadline is a submission (`category`/`course` in the
  schema), the pill switches to a distinct submode with the deadline as its subject.

Constraints: the row is 22px and display-only; the pill has no room for a second line;
starting a stopwatch from a 22px row violates the 44px target rule, so if you pick A you
must say where the target actually lives.

### 5.6 The Settings ambient control (one radio group)

It currently reads:

```
Ambient edge   [ Off ] [ Edge glow — Green / red ring by tier ]
```

Design the *description* so a user who did not ask for this understands what it does in
one line, and so "Off" does not read as "broken". No preview is required.

---

## 6. The data you may design against

**Focus** — `halo:get-focus` → `FocusManager.getPublicState()`:

```ts
interface HaloFocusState {
  ok: boolean;
  active?: boolean;
  paused?: boolean;
  endsAt?: number | null;      // null = open-ended, counts UP
  remainingSec?: number | null;
  startedAt?: number | null;
  strictness?: 'distracting' | 'non_allowed';
  allowedApps?: string[];
  allowedDomains?: string[];
  allowedTiers?: string[];
  error?: string;
}
```

**Schedule** — `halo:get-life`, one call, one `now`:

```ts
interface HaloLifeDeadline {
  id: string; title: string;
  dueAtMs: number | null; deltaMs: number | null; isOverdue: boolean | null;
  remindAtMs: number | null;                     // legacy single column, fallback only
  alarms?: Array<{ mode: 'relative' | 'absolute';
                   leadMin: number; atMs: number | null; fired: boolean }>;
}
interface HaloLifeSchedule {
  id: string; title: string; location: string | null;
  dayOfWeek: number; startTime: string; endTime: string;
  category: string | null; startsAtMs: number; endsAtMs: number; isNow: boolean;
}
interface HaloLifePayload {
  ok: boolean; now: number;
  schedule: HaloLifeSchedule | null; deadlines: HaloLifeDeadline[]; error?: string;
}
```

**Stopwatch** — `StopwatchSnapshot`: `displayMs`, `productiveMs`, `paused`, `tier`
(`productive | distracting`), `displaySource` (`stopwatch | idle | stopwatchSite`).

**Live rows today** (measured from the real DB, not fixtures):
`ALGO PROG · Wed 21 Oct 09:20 · in 10h`; `C Programming BNCC · 21 Aug · 61d overdue ·
alarm 1d before`; `NAR · 19 Oct · 1d overdue · no alarm`.

---

## 7. Copy rules (Gate F)

- Buttons are **verb + noun**: "Open Schedule", "Reset timer". Never a bare "Open".
- Errors: **"[Thing] [verb] because [reason]. [Action]."** The existing
  `Schedule could not load. Retry.` is the ceiling of what fits in 56px — keep it short
  but keep all three parts.
- Empty states explain what *would* be there: "No classes scheduled and no open
  deadlines." is correct; "No data" is not.
- Never expose an enum, a raw token, or a stack trace. `Allow-list` is borderline — if you
  can say it in fewer characters without lying, do.
- Uppercase is applied by CSS (`text-transform`), never typed in caps.

---

## 8. Motion budget

The island sits on screen all day. Its liveliness level is **L1/L2 boundary: composed,
responsive**. It may acknowledge, it may not perform.

Allowed: the 250ms expand/collapse, the 150ms press, a cross-fade on a label change, the
drag (direct, un-eased). Banned: bounces, infinite loops, animated width/height/top/left,
`transition-all`, ambient drift, anything that moves while the user is reading a number.

Every motion you specify needs a `prefers-reduced-motion` fallback in the same breath.

---

## 9. Questions we need you to settle (give a ruling, not a menu)

1. **Where does an alarm get set?** The island cannot host a picker. Is the design (a) the
   island shows the alarm and the row is a link to `/deadlines`, (b) a long-press opens a
   44px action sheet inside the panel, or (c) alarms are out of the island entirely and it
   only reports? The owner asked for the *connection*, not necessarily the editor.
2. **Does the pill ever show the deadline?** When a focus session is tied to a submission,
   the pill could carry the title instead of the app name. R1 says the name belongs with
   the stopwatch — is the deadline the new name, or a second fact?
3. **How many deadline rows are visible?** Pick the number and the overflow treatment.
4. **What is the neutral ring?** Give the exact treatment that is neither "off" nor "a
   second accent".
5. **R13: A, B, or C** — and if A, where the 44px target lives.

---

## 10. Non-goals

Do not: add a page, add a tab, change the preset heights, introduce a component library,
propose a new dependency, redesign the tab rail, redesign the compact pill's body, add a
chart, add a toast, or write backend code. If your design requires one of those, say so in
the "what I refused" list and design the closest thing that does not.
