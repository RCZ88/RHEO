# HALO_RESULT.md

Answer to `halo-island-design-20102026/PROMPT.md`. Visual reference with exact CSS: `HALO_EDGE.html` (open it, use the S / M / L and Warm Paper buttons). Read the CSS in that file, not the picture.

Skills named per decision: **FD** Frontend Design, **HC** Human-Centric UX, **IM** Impeccable, **MO** Motion, **PM** UI UX Pro Max, **DT** Design Taste, **INF** frontend-external-infra.

I had no registry access in this session. I did not read the source of `status-island`, `undo-button` or `morph-popover`. Where I say "the mechanic of X", I specify it from first principles and name X only as a possible shortcut for the engineer.

---

## 0. The seven rulings (section 11 of the brief)

| # | Question | Ruling |
|---|---|---|
| 1 | Where is an alarm set? | **In the island, in place.** The bell button on the Schedule page turns the content row into a quick-pick (1 hour, 1 day, On time, Custom). Custom hands off to `/deadlines`. No floating layer, because the window has no headroom. |
| 2 | Deadline title vs app name on the pill | **The deadline title takes the name slot on the pill.** The app or site moves to the expanded Focus row. The subject of the work answers "what am I spending time on". |
| 3 | Schedule rows visible | **Exactly two**, at every size. Scroll-snap. A `n/N` counter shows when N is over 2. |
| 4 | Neutral ring | **Blue at half weight** (hairline 40%, glow 14%). It is different from off because off carries no hue at all. Tier colour appears only on the edge, never on a fill or on text. |
| 5 | Unbounded stopwatch, time-left border | **Nothing.** No target means no ring. A ring with no end is a lie. |
| 6 | AFK: stay or hide | **Stay and change.** The pill never hides. The coffee pip is deleted. |
| 7 | Elapsed time per deadline | **It should persist.** That needs a new table (backend gap, section 9). Until it exists, the binding lives in memory and is lost when the app closes. |

---

## 1. Design thesis (one sentence each)

- **Pill:** it says what you are doing right now (one clock, one name) and lets the edge carry the state you did not ask for.
- **Focus stopwatch:** one clock and one subject, with controls that exist only because they drive that clock.
- **Focus session:** the island visibly changes jobs from "measuring" to "enforcing", and tells you what is locked, who is allowed, and when it ends.
- **Schedule:** your next hour in one glance: the next class on the left, the most urgent deadlines on the right, and the two buttons that act on the one you are looking at.
- **Alarm:** a deadline's alarm is a short, honest fact on its row, and changing it takes two key presses in the same row.
- **AFK:** when you leave, the island does not look away. It tells you that it stopped counting, and for how long.

---

## 2. The edge model (one ruling)

One edge, three channels. Each owns a different physical property, so none can fight.

| Channel | Owner | What it draws | When |
|---|---|---|---|
| **Stroke** (2px, inside the border) | Time left | `--halo-ring` (ink colour), depleting clockwise from top centre | Only when a bounded target exists (focus session with `endsAt`) |
| **Hairline tint + outer glow** | Productivity tier | `border-color` mixed with the tier colour, plus a soft outer bloom | Ambient pref `edge`, and not while AFK |
| **Dashed hairline** | AFK | Dashed `--halo-away`, no glow | While the user is away |

Rules that fall out of this:

1. **The stroke is never a hue.** It uses ink (`--halo-text`), so it cannot be mistaken for the green productive glow or the red distracting glow, and it needs no extra accent.
2. **Tier colour never fills or colours text.** It only touches the hairline and the glow.
3. **Away red and distracting red are the same red on purpose** (the app has only one red). They are kept apart by form: distracting is a solid hairline with a glow, away is a dashed hairline with no glow. They also cannot appear together, because AFK switches the tier channel off. The words "Away 12m" and the coffee icon carry the meaning, so colour is never the only signal.
4. **Overdue amber never touches the edge.** It lives on dots and text in the Schedule rows.
5. **Off is off.** No tier hue, no glow, plain hairline. **Neutral** is blue at half weight.
6. **The old `0 0 0 1px var(--tier-x)` ring is removed.** It put the tier on the stroke channel.
7. **Light mode:** tier tokens switch to their `html.light` values. The glow is multiplied by `--bloom: 0`, so light mode gets the tinted hairline only (LAMINAR section 11: depth from hairlines, never shadow).
8. **The expanded panel** gets the tinted hairline only, no glow and no stroke. The stroke exists only on the pill.

Cost of this ruling: the "blue" of neutral is one more hue on the edge than the single-signal ideal. I kept it because the owner asked for red, blue, green in his own words, and it is only ever one at a time.

---

## 3. Token table

New tokens go in `halo.css` next to the `--halo-signal` block. Everything else already exists.

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--halo-away` (NEW) | `var(--tier-distracting)` | same | AFK dashed edge, "Away" text and icon |
| `--halo-ring` (NEW) | `var(--halo-text)` | same | Time-left stroke |
| `--halo-ring-w` (NEW) | `2px` | `2px` | Stroke width |
| `--halo-ring-w-final` (NEW) | `3px` | `3px` | Stroke width in the last 60 seconds |
| `--halo-bloom` (NEW) | `1` | `0` | Multiplier for the tier glow alpha |
| `--halo-ease` (NEW) | `cubic-bezier(0.16, 1, 0.3, 1)` | same | LAMINAR section 6 easing |
| `--halo-sched-row` (NEW) | `calc((var(--halo-row) - 4px) / 2)` | same | Schedule row height: 22 / 26 / 30 |
| `--halo-row` (NEW, set per preset) | 48 / 56 / 64 px | same | Content row height, so CSS can read it |

Existing tokens in use: `--halo-surface`, `--halo-raised`, `--halo-tab`, `--halo-border`, `--halo-text`, `--halo-muted`, `--halo-dim`, `--halo-accent`, `--halo-signal` (overdue), `--tier-*`, `--halo-t-*` roles, `--halo-gap-*`.

| Element | Token | Value (Medium) |
|---|---|---|
| Pill size | preset | 198 x 32, radius pill |
| Pill hairline | `--halo-border` | 1px |
| Tier glow dark | `color-mix(var(--tier-x) 28%, transparent)` (productive and distracting) | blur 12px |
| Tier glow neutral | `color-mix(var(--tier-neutral) 14%, transparent)` | blur 10px |
| Tier hairline tint | `color-mix(var(--tier-x) 55%, var(--halo-border))` (neutral 40%) | 1px |
| Away hairline | `1px dashed var(--halo-away)` | inset -1px pseudo-element |
| Progress stroke | `--halo-ring` | 2px, 3px when 60s or less remain |
| Schedule row | `--halo-sched-row` | 26px, gap 4px, radius 8 |
| Current row fill | `--halo-tab` | |
| Quick-pick chip | height 44, radius pill, `--halo-t-label` | selected: `--halo-tab` + 2px `--halo-accent` ring |
| Allow-list chip | height 28, radius pill, display-only | |

Type roles: eyebrow `--halo-t-eyebrow` (mono, 400, 0.08em, uppercase, `--halo-dim`); label `--halo-t-label`; value `--halo-t-value`; hero `--halo-t-hero` (mono 500). Minimum 11px at every size.

---

## 4. Markup

Inline `style` with `var(--halo-*)` is the house style. These are the blocks that change. Props and payloads are the real ones from the bundle.

### 4.1 The stroke: new `src/features/halo/PillEdge.tsx`

```tsx
import { memo } from 'react';

/** Time-left stroke. Draws only when `remaining` is a number in 0..1. No target = render nothing. */
export const PillEdge = memo(function PillEdge({
  width, height, remaining, paused, final,
}: { width: number; height: number; remaining: number | null; paused?: boolean; final?: boolean }) {
  if (remaining == null) return null;                      // unbounded: no ring, never a fake one
  const r = (height - 2) / 2, cx = width / 2;
  const d = `M ${cx} 1 H ${width - 1 - r} A ${r} ${r} 0 0 1 ${width - 1 - r} ${height - 1} ` +
            `H ${1 + r} A ${r} ${r} 0 0 1 ${1 + r} 1 H ${cx}`;
  const elapsed = (1 - Math.min(1, Math.max(0, remaining))) * 100;
  return (
    <svg aria-hidden="true" width={width + 2} height={height + 2} viewBox={`-1 -1 ${width + 2} ${height + 2}`}
         style={{ position: 'absolute', inset: -1, pointerEvents: 'none', overflow: 'visible' }}>
      <path d={d} pathLength={100} fill="none"
        stroke={paused ? 'var(--halo-dim)' : 'var(--halo-ring)'}
        strokeWidth={final ? 'var(--halo-ring-w-final)' : 'var(--halo-ring-w)'}
        strokeDasharray="100 200" strokeDashoffset={-elapsed}
        style={{ transition: paused ? 'none' : 'stroke-dashoffset 1s linear' }} />
    </svg>
  );
});
```

Usage in `OverlayRoot.tsx` (inside the pill, `position: relative`):

```tsx
const total = session?.endsAt && session?.startedAt ? session.endsAt - session.startedAt : null;
const remaining = total && total > 0 ? Math.max(0, (session!.endsAt! - now) / total) : null;
<PillEdge width={size.compactWidth} height={size.compactHeight} remaining={remaining}
          paused={session?.paused} final={remaining != null && session!.endsAt! - now <= 60_000} />
```

### 4.2 The tier channel: replace the `boxShadow` block at `OverlayRoot.tsx:1526-1545`

```tsx
const tierVar = `var(--tier-${dwellTier})`;               // dwellTier: see section 7.2
const weight = dwellTier === 'neutral' ? 40 : 55;
const bloom = dwellTier === 'neutral' ? 14 : 28;
...(prefs.ambient === 'edge' && !isAway
  ? {
      borderColor: `color-mix(in srgb, ${tierVar} ${weight}%, var(--halo-border))`,
      boxShadow: expanded
        ? 'var(--halo-shadow)'                            // expanded: tinted hairline only
        : `var(--halo-shadow), 0 0 12px color-mix(in srgb, ${tierVar} calc(${bloom}% * var(--halo-bloom)), transparent)`,
      transition: 'border-color 250ms var(--halo-ease), box-shadow 250ms var(--halo-ease)',
    }
  : {}),
```

The old `0 0 0 1px var(--tier-...)` and its `0 0 14px` are deleted.

### 4.3 AFK stays on the pill: replace the suppression at `OverlayRoot.tsx:1615-1632`

Delete `composed.live.kind !== 'afkGap'` and the coffee pip. The pill body becomes a state:

```tsx
const isAway = afkEnabled && snap.lastInteractionAtMs > 0 && !passive &&
               now - snap.lastInteractionAtMs >= afk.thresholdMinutes * 60_000;
// pill content when isAway:
<>
  <Coffee size={ic} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-away)' }} />
  <span className="tabular-nums" style={{ color: 'var(--halo-dim)' }}>{frozenClock}</span>
  <Sep />
  <span style={{ color: 'var(--halo-away)', fontWeight: 500 }}>Away {formatAway(now - snap.lastInteractionAtMs)}</span>
  {/* dashed edge: a pseudo-layer so solid -> dashed can cross-fade (border-style cannot animate) */}
  <span aria-hidden="true" style={{ position: 'absolute', inset: -1, borderRadius: 'inherit',
        border: '1px dashed var(--halo-away)', pointerEvents: 'none',
        opacity: 1, transition: 'opacity 150ms var(--halo-ease)' }} />
</>
```

When `isAway`, the pill's own `borderColor` is `transparent` so the dashed layer is the only edge.

### 4.4 Focus page: allow-list view (change to `FocusPageRow.tsx`)

Add one 44px chevron button where the stopwatch controls used to be (inside `session &&`), and a second view:

```tsx
const [view, setView] = useState<'row' | 'allowed'>('row');
...
{session && view === 'row' && (
  <button type="button" aria-label="Show what is allowed in this session" onClick={() => setView('allowed')}
    style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid var(--halo-border)',
             background: 'transparent', color: 'var(--halo-muted)', flexShrink: 0, cursor: 'pointer' }}>
    <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
  </button>
)}
{session && view === 'allowed' && <AllowedView focus={focus} onBack={() => setView('row')} />}
```

`AllowedView`: back button (44, `ChevronLeft`), eyebrow "Allowed in this session", then a horizontally scrolling chip list (`overflow-x: auto`, `tabIndex={0}`, `role="list"`, wheel stopPropagation). Each chip is 28px tall, display-only: `AppWindow` + app name for `allowedApps`, `Globe` + domain for `allowedDomains`, a plain word for `allowedTiers`. When `strictness === 'distracting'` the list is replaced by one line: "Distracting apps and sites are blocked." An arrow button (44) at the end calls `bridge.navigate('/focus')`: editing the allow-list is a hand-off, not an island feature.

The session row itself adds a `Now` block: the tracked name with a `Check` glyph when the tracked app or site is in the allow-list (or the session is `distracting` and the tier is not distracting). No glyph when unknown. The glyph is the signal, not its colour.

### 4.5 Schedule: replace `OverlayRoot.tsx:1837-2037` list body

```tsx
// left, pinned: the nearest block
<div style={{ flex: '0 0 clamp(100px, 22%, 150px)', minWidth: 0 }} className="flex flex-col" data-halo-life-row="class">
  <span style={EYEBROW}>{isNow ? 'Now' : 'Next'} <span style={{ textTransform: 'none', letterSpacing: 0 }}>{isNow ? `${leftMin}m left` : formatIn(startsAtMs - life.now)}</span></span>
  <span className="truncate" style={{ fontSize: 'var(--halo-t-value)', fontWeight: 500 }}>{schedule.title || 'Untitled'}</span>
  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--halo-t-label)', color: 'var(--halo-dim)' }}>{formatBlockWhen(schedule)}</span>
</div>
<span aria-hidden="true" style={DIVIDER} />
// centre: the scroller. Exactly two rows tall.
<div role="listbox" aria-label="Open deadlines" tabIndex={0} aria-activedescendant={`dl-${cur.id}`}
     onWheel={(e) => e.stopPropagation()} onScroll={onScroll} onKeyDown={onListKey}
     style={{ containerType: 'inline-size', height: size.rowHeight, flex: 1, minWidth: 0, overflowY: 'auto',
              scrollSnapType: 'y mandatory', display: 'flex', flexDirection: 'column', gap: 4, scrollbarWidth: 'none' }}>
  {sorted.map((d, i) => (
    <div key={d.id} id={`dl-${d.id}`} role="option" aria-selected={i === cur.index}
      style={{ height: 'var(--halo-sched-row)', flex: 'none', scrollSnapAlign: 'start', display: 'flex', alignItems: 'center',
               gap: 8, padding: '0 8px', borderRadius: 8,
               background: i === cur.index ? 'var(--halo-tab)' : 'transparent' }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0,
            background: d.isOverdue ? 'var(--halo-signal)' : 'var(--halo-dim)' }} />
      <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 'var(--halo-t-value)' }}>{d.title || 'Untitled'}</span>
      {tracking === d.id ? <TrackChip ms={trackedMs} /> : <AlarmChip alarm={pickAlarm(d)} />}
      <span style={{ ...MONO_LABEL, color: d.isOverdue ? 'var(--halo-signal)' : 'var(--halo-dim)' }}>{formatDeadlineDue(d.deltaMs)}</span>
    </div>
  ))}
</div>
// right, pinned: two 44px buttons that act on the current row
<IconBtn label={`Set alarm for ${cur.title}`} onClick={openEditor}><Bell size={16} /></IconBtn>
<IconBtn label={`Track time on ${cur.title}`} pressed={tracking === cur.id} onClick={toggleTrack}><Timer size={16} /></IconBtn>
```

`AlarmChip`: `Bell` 11px plus the label in mono. Pending: `--halo-muted`. Fired: `--halo-dim` text with `line-through`. The label hides under 270px of list width with a container query, leaving the glyph.

### 4.6 The alarm editor: same row, swapped content

```tsx
<div role="group" aria-label={`Alarm for ${cur.title}`} className="flex items-center" style={{ gap: 12, width: '100%' }}>
  <div style={{ flex: '0 0 clamp(110px, 26%, 150px)', minWidth: 0 }}>
    <span style={EYEBROW}>Alarm</span>
    <span className="truncate" style={{ fontSize: 'var(--halo-t-value)', display: 'block' }}>{cur.title}</span>
  </div>
  <div role="group" aria-label="Alarm times" className="flex" style={{ gap: 8, flex: 1, justifyContent: 'flex-end' }}>
    {PRESETS.map((p) => (
      <button key={p.id} role="checkbox" aria-checked={has(p)} onClick={() => toggle(p)} style={QUICK_CHIP(has(p))}>{p.label}</button>
    ))}
    <button onClick={() => bridge?.navigate?.(`/deadlines?id=${cur.id}`)} style={QUICK_CHIP(false)}>Custom</button>
  </div>
  <IconBtn label="Close alarm editor" onClick={closeEditor}><X size={16} /></IconBtn>
</div>
```

`PRESETS` = `{ id: '1h', label: '1 hour', leadMin: 60 }`, `{ id: '1d', label: '1 day', leadMin: 1440 }`, `{ id: '0', label: 'On time', leadMin: 0 }`. All three write `mode: 'relative'`. A custom alarm already on the deadline shows as a read-only extra chip (for example "Tue 19:00") with an `X`.

---

## 5. State matrix

| Surface | Empty | Loading | Error | Populated | Overflow / extra |
|---|---|---|---|---|---|
| **Pill** | Stopwatch at 00:00:00, name slot shows "No app yet" in `--halo-dim` | No reading: dot only, no name | Producer failed: last good name in `--halo-dim` | Normal | Name ellipsis; clock never truncates |
| **Focus row** | n/a (stopwatch always exists) | n/a | `halo:get-focus` not ok: falls back to the stopwatch row (never a countdown from a failed read) | Stopwatch / Session / Paused / Open-ended / Complete | Tracked name ellipsis (`minWidth: 0`) |
| **Allow-list view** | "No apps or sites allowed. Everything is blocked." | Chips skeleton (3 bars, no shimmer) | Row falls back to session row | Chips | Scroll sideways, arrow keys, no wrap |
| **Schedule list** | "No open deadlines. Add one in Schedule." + arrow button | Skeleton blocks, no zero | "Schedule could not load because the database is busy. Retry." + 44px retry | Class block + rows | 1, 3, 10 rows: see 7.7 |
| **Alarm editor** | Nothing selected, all chips unchecked | n/a | Left block shows "Alarm not saved because the database is busy. Retry." Chips keep the user's choice. | Selected chips use `--halo-tab` + accent ring | Extra read-only chip for custom alarms |
| **AFK** | no `lastInteractionAtMs` (0 = unknown): no AFK state | n/a | n/a | Away / return acknowledgement | `Away 1h 12m` format over 60 min |

Interactive element states (all 44px unless noted): hover `--halo-raised` fill; focus-visible 2px `--halo-accent` ring; active `scale(0.96)`; disabled `--halo-dim` text with an explanatory title, never `opacity`. The 22 / 26 / 30px schedule rows and the 28px chips are display-only. Their actions live on the 44px buttons.

---

## 6. Motion spec

Level **L2**. The island may acknowledge. It may not perform. Easing is `--halo-ease`. No spring, no bounce.

| Element | Class | Spec |
|---|---|---|
| Time-left stroke | Functional ambient | `stroke-dashoffset` 1s linear per tick. This is the one allowed loop. |
| Stroke draw-on at session start | Transitional | 400ms, offset from full gap to 0, then depletion begins |
| Tier change | Reactive | `border-color` and `box-shadow` 250ms. Tier flips only after a 1500ms dwell, so switching windows quickly does not strobe. |
| AFK enter / exit | Transitional | Cross-fade the dashed layer 150ms. Clock dims with `color` 150ms. |
| Row state swap (stopwatch / session / allow-list / editor) | Transitional | Opacity 150ms. No slide. |
| Page change | Transitional | 150ms fade with 8px slide (existing rule) |
| Drag | Reactive | No transition while dragging. On release, snap to the anchor with 250ms ease-out. |
| Session complete | Transitional | Stroke fades 250ms, row shows "Complete" for 6s |
| Last 60 seconds | Reactive | Stroke width 2px to 3px, a static step, no animation |
| Switch / chip / button press | Reactive | `scale(0.96)`, 150ms |

**The session start, felt (about 400ms total):** 1. stopwatch group cross-fades to the focus group (150ms); 2. the lock glyph closes and the chip reads Locked or Allow-list; 3. the pill stroke draws on over 400ms; 4. the stopwatch controls fade out and the Ends block fades in.

**Reduced motion:** one global `prefers-reduced-motion` check zeroes every duration above. The stroke still updates once per second, with no interpolation. The tier changes instantly. The session start is an instant swap.

---

## 7. Engineering rules

### 7.1 Time-left stroke (R4)
- **Target:** only a focus session with `endsAt` (a number). Total = `endsAt - startedAt`. `remaining = clamp((endsAt - now) / total, 0, 1)`.
- **Offset:** `strokeDashoffset = -(1 - remaining) * 100` with `pathLength=100`, `strokeDasharray="100 200"`.
- **Tick:** the island's one-second `now`. The 1s linear CSS transition makes it look continuous.
- **Paused session:** stroke freezes at its position, `--halo-dim`, no transition, pill says Paused.
- **Last 60 seconds:** stroke 3px.
- **At 0:** stroke fades 250ms, then "Complete" for 6s (pill: `Check` + "Focus done 25m").
- **Open-ended session (`endsAt === null`):** no stroke. The clock counts up.
- **No session:** no stroke, even if the stopwatch is running or tracking a deadline.
- **Composition with tier:** different channels (section 2). They can show together.

### 7.2 Ambient tier (R5)
Source: `currentApp.tier ?? swPayload.tier`.

| Tier | Hairline (`border-color`) | Glow dark | Glow light |
|---|---|---|---|
| productive | `--tier-productive` 55% mixed with `--halo-border` | 12px, 28% | none |
| neutral | `--tier-neutral` 40% mixed | 10px, 14% | none |
| distracting | `--tier-distracting` 55% mixed | 12px, 28% | none |
| off / no reading | `--halo-border` | none | none |

Transition 250ms. **Dwell:** the first reading applies at once. After that a change must hold 1500ms before it applies. While AFK, the tier channel is off.

### 7.3 AFK (R14)
- **Inputs:** `awayMs = now - snap.lastInteractionAtMs` (0 means unknown, never AFK), `afk.enabled`, `afk.thresholdMinutes`, `afk.action`, current category vs `afk.passiveCategories`.
- **Away:** `awayMs >= thresholdMinutes * 60_000` (default 5 min) and not passive. Replace the existing `IDLE_GAP_SHOW_MS` with this, so the island and the app agree.
- **Frozen clock:** `snap.displayMs` (the store already froze it). Do not use `paused`.
- **Label:** `Away 12m` (floor minutes); from 60 min, `Away 1h 12m`. Updates once a minute.
- **Return:** when `lastInteractionAtMs` moves forward, show the acknowledgement for 6s: pill `Check` + "Back after 12m". Expanded row: the Away block becomes the consequence, from `afk.action`: pause-only "Timer paused", reset-stopwatch "Timer reset", reset-streak "Streak reset", reset-both "Timer and streak reset".
- The existing app dialog (`minPromptSeconds`, `notAfkBelowMinutes`) is separate. The island never asks the question.

### 7.4 Nearest block (R10)
Label word: `Now` if `isNow`, otherwise `Next`.

| Case | Line 1 | Line 3 |
|---|---|---|
| `isNow` | `Now  40m left` | `until 11:00` |
| Today, upcoming, under 1h | `Next  in 42m` | `Wed 09:20` |
| Today, upcoming, 1 to 23h | `Next  in 10h` | `Wed 09:20` |
| Tomorrow | `Next  in 21h` | `Thu 09:20` |
| Later this week | `Next` | `Fri 09:20` |
| Next week | `Next` | `Tue 27 Oct 09:20` |

Today's finished block rolls to next week (already in the producer).

### 7.5 Deadline order and format (R11, R13)
- **Order:** overdue first, **least overdue first** (the thing you slipped on most recently is the most recoverable). Then upcoming, soonest first. `dueAtMs === null` goes last.

| Delta | Label |
|---|---|
| overdue under 1h | `Nm overdue` |
| overdue under 24h | `Nh overdue` |
| overdue 24h or more | `Nd overdue` (floor) |
| upcoming, due in under 1h | `in Nm` |
| upcoming, under 24h | `in Nh` |
| upcoming, 24h or more | `in Nd` (floor) |
| `dueAtMs` null | `no date` |

The 0-day boundary: due later today = `in Nh`, never "today". The calendar date shows in the alarm editor and the row's `title` tooltip, not in the row.

### 7.6 Alarm derivation (R15, R16)
- **Source:** `deadline.alarms[]` first. `remindAtMs` only when `alarms` is empty (legacy).
- **Which one prints:** the soonest pending alarm. If none pending, the most recently fired. If more than one alarm exists, append ` +N`.
- **Relative label:** from `leadMin`: 0 is `on time`; under 60 is `Nm before`; whole hours `Nh before`; whole days `Nd before`; otherwise `Nh Mm before`. No clock time is invented. The moment (due minus lead) appears only in the editor.
- **Absolute label:** `19:00` same day, `Tue 19:00` within 7 days, `21 Oct` otherwise.
- **Pending vs fired, no second hue:** pending = `Bell` + label in `--halo-muted`. Fired = same glyph + label in `--halo-dim` with `line-through`, and the title says "Alarm sent". None = no chip, and the bell button has no marker.
- **Backend note (once):** relative reminders store `remind_at = NULL` and the ticker needs it non-null, so they never fire today. Designed as if fixed.

### 7.7 Overflow (R12)
Row heights are `(rowHeight - 4) / 2`.

| Preset | Row height | Visible rows | Pinned |
|---|---|---|---|
| Small (48) | 22 | 2 | class block left, buttons right |
| Medium (56) | 26 | 2 | same |
| Large (64) | 30 | 2 | same |

- 1 deadline: one row, no scroll, no counter. 3: scroll-snap, counter `1/3`. 10: same, counter `1/10`. The panel stays 118 / 134 / 154 in every case.
- The wheel is stopped so it does not change page. Arrow keys scroll one row. The top row is the current one.
- **Narrow (380px panel):** the class block is hidden and becomes a first list row with `CalendarClock`. The alarm label hides, the glyph stays.

### 7.8 Tracking a deadline (R17)
- **Start:** the Timer button on the current Schedule row. If the stopwatch is stopped it starts and binds. If it is running, it binds from that moment (earlier time is not credited).
- **Stop:** press the same button again (it is a toggle with `aria-pressed`), press Reset on the Focus row, or the deadline is completed or deleted. Pause pauses the stopwatch and keeps the binding.
- **Pill:** the deadline title replaces the name (with `CalendarClock`). Expanded Focus row: the app or site stays in the eyebrow row, and a `FOR` block shows the deadline title.
- **Schedule row:** while bound, the alarm chip is replaced by `Timer` + elapsed (`42m`).
- **App closes mid-session:** the binding and elapsed time should be saved on quit and restored. **No table exists.** Until one does, they are lost.

---

## 8. Interaction flows

1. **Drag the pill.** Pointer down on the pill, move more than 4px: drag starts (cursor `grabbing`, hairline goes `--halo-muted`, no transition, window follows 1:1, y clamps 0 to 64px in steps of 4). Reversing mid-drag just follows the pointer. Release: snap to the nearest anchor (left, centre, right) in 250ms. Esc during drag returns it to where it started. A move under 4px is a click, which toggles expand. Keyboard: Settings screen, or the shortcut path in 8.8.
2. **No session to session.** Session starts in the app. Within 400ms: row cross-fades (150ms), lock closes, stroke draws on (400ms), controls fade out, Ends fades in.
3. **Session lifecycle.** Running: stroke depletes each second. Pause: stroke and clock dim, label says Paused, dot goes dim. Resume: reverses. Final 60s: stroke 3px. At 0: stroke fades, "Complete" shows 6s, lock opens, then the stopwatch row returns.
4. **AFK.** Away threshold reached: dashed layer fades in (150ms), glow off, clock dims, "Away 12m". User returns: dashed layer fades out, tier glow returns (250ms), "Back after 12m" shows 6s, clock resumes. Stopwatch value before and after is the same `displayMs`, unless `afk.action` resets it.
5. **Alarm round trip.** Schedule page, scroll to a deadline with no alarm, press the bell (44px): the row cross-fades into the editor (150ms) and focus lands on the first chip. Choose "1 day": chip checks, left block says "Alarm set. Fires Tue 09:00" for 2s, row shows `1d before` when closed. Esc or X closes and returns focus to the bell. Total height never changes.
6. **Two to ten deadlines.** Two: no scroll. Ten: counter appears, wheel or arrows move one row at a time, the class block and buttons stay pinned, the current row moves and the buttons retarget.
7. **Error and retry.** Read fails: the page shows the failure sentence with a 44px retry. Retry: skeletons, then data. A failed read never replaces a stopwatch with a countdown.
8. **Keyboard only.** The island never takes focus on its own. The global shortcut Cmd/Ctrl+Shift+H opens it and, because the user asked for it, makes the window focusable and puts focus on the selected tab. Tab order: tab rail (roving, Left/Right), page content (buttons, list, chips), Esc closes and returns focus to the previous app. Pill: Alt+Arrows would be a second hidden path. I refuse it (section 10) and use the shortcut and Settings instead.

---

## 9. Backend gaps and assumptions (not solved here)

1. **Block events.** The FocusManager public state has no "blocked X just now" event. A "Blocked: Instagram" notice on the pill is designed in spirit but needs one.
2. **Alarm writes from the island.** The Halo bridge is read-only. The editor needs `halo:set-reminder` (add, remove) calling the same code as `add-deadline-reminder`.
3. **Per-deadline time table.** For example `deadline_time(deadline_id, started_at, ended_at, ms)`.
4. **Allow-list editing.** No API. View-only, with a hand-off.
5. **Keyboard focus on shortcut open.** `setFocusable(true)` and `focus()` while open, then restore on close.
6. **FocusManager pause.** I assume pausing lifts the lock. If it does not, the paused label must still say "Locked". Please confirm.
7. **`IDLE_GAP_SHOW_MS`.** I could not see its value. I replaced it with `afk.thresholdMinutes`.

---

## 10. What I refused, and why

| Refused | Why | Instead |
|---|---|---|
| A ring on the plain stopwatch | No target, so the ring would show invented progress | No ring |
| A tier colour on the stroke | It would collide with the sage accent and the progress meaning | Tier on glow and hairline, stroke in ink |
| A third red for AFK | LAMINAR has one red | Same red, dashed, no glow, plus words and icon |
| Hiding the pill when away | The owner asked the opposite | Pill stays |
| Floating popover for alarms | The window has no headroom | In-place morph in the row |
| A date picker in the island | No room, no precision | Quick-pick and a hand-off |
| Interactive 22px rows | Below the 44px target | Display-only rows, 44px buttons act on the current row |
| Alt+Arrow keys to move the pill | A hidden path that the island cannot receive without focus | Settings and the shortcut |
| A fourth tab | Hard constraint | Editor and allow-list reuse the existing row |
| `ring-chart` / `gauge-chart` (`@bklit`) | They are charts. The ring is a stroke on a pill | Hand-written SVG path (about 25 lines) |
| Any spring-timed registry component | LAMINAR bans spring | Re-timed to ease-out or rejected |
| Editing the allow-list in the island | No API, high risk of wrong edits | View-only plus hand-off |

---

## 11. Coverage table

| Req | Where |
|---|---|
| R1 One clock, one name | Section 4.3, 7.8; pill `Figma` after the clock, no second clock anywhere |
| R2 Name = app, domain, or "Private window" | Unchanged privacy rule; section 7.8 (deadline title takes the slot only while bound) |
| R3 Drag the pill | Flow 1, motion table, section 4 (no persistent grip; cursor and hairline are the affordance) |
| R4 Border = time left | Sections 2, 4.1, 7.1; HALO_EDGE.html section 1 |
| R5 Ambient glow | Sections 2, 4.2, 7.2 |
| R6 Focus looks connected | Section 4.4: eyebrow `FOCUS`, lock chip, `Now` block with allowed check, Ends block |
| R7 The lock | Locked vs Allow-list chip; full rule in `title`; allow-list view |
| R8 Focus session | Sections 4.4, 6 (session start, felt), flow 2 and 3; paused, open-ended and complete states in HALO_EDGE.html section 2 |
| R9 No "Now" tab | Three tabs only. The `Now` block in the session row is a label, not a tab. |
| R10 Nearest schedule | Sections 4.5, 7.4 |
| R11 All deadlines | Sections 4.5, 7.7 |
| R12 Never breaks | Section 7.7 table, proof at 1, 3, 10 rows; fixed `rowHeight` |
| R13 Right side earns space | Two pinned 44px buttons, counter, alarm chip, elapsed chip |
| R14 AFK red | Sections 2, 4.3, 7.3; flow 4 |
| R15 Alarm visible | Section 7.6 |
| R16 Set the alarm | Section 4.6, flow 5, ruling 1 |
| R17 Stopwatch to deadline | Section 7.8, ruling 2 and 7 |
| R18 LAMINAR | Section 3 tokens only; radii 8 / pill; Inter + JetBrains Mono; no glass; no spring; light mode via tokens; reduced motion section 6 |

---

## 12. Open questions for the owner AI (one-line answers are enough)

1. Does pausing a focus session lift the lock?
2. What is the value and use of `IDLE_GAP_SHOW_MS`?
3. Is the route `/focus` correct, and does `/deadlines?id=` open a given deadline?
4. Are there more than 6 alarm rows per deadline in practice? (The `+N` suffix assumes few.)
