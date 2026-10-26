# CONTEXT BUNDLE — Halo Island design mandate

> **Source of truth.** The receiving AI has no access to this repo. Everything needed to
> design against the real code is below: exact files, exact line ranges, exact tokens,
> exact payloads, exact schemas, and the live data currently in the database.
>
> Read this before `PROMPT.md` §5 onward. Do not invent a field or a colour that is not here.

**Repo:** RHEO (Electron + React + TS + SQLite). **Island feature root:** `src/features/halo/`.
**Design law:** `design/design.md` (LAMINAR v1.0). **Live tokens:** `src/index.css`.

---

## 1. GEOMETRY — `src/shared/halo/sizes.ts` (lines 74-135)

The expanded panel is a FIXED preset. These are the only three sizes that exist.

export const HALO_SIZE_PRESETS: Record<HaloSizePreset, HaloSize> = {
  /* MEASURED FROM THE FIGMA FILE (node tree, not the exported PNG):
   *   "Halo compact / Dark" INSTANCE  182x28   under SMALL
   *   "Halo compact / Dark" INSTANCE  198x32   under MEDIUM
   *   "Halo compact / Dark" INSTANCE  227x40   under LARGE
   *
   * The compact pill is NOT a fixed width. It was 232 at every size — the number from
   * halo-widget-curation-05102026/RESULT.md §1.2 ("hard 232x40"), which governs a different
   * design. The Figma file scales it with the type scale, and at Small the label is dropped
   * (icon-only tabs) so the pill is only 182 wide.
   */
  small: {
    expandedWidth: 480,
    /* 118, DERIVED including the 1px border: border(1) + pad(8) + row(48) + gap(8)
     * + tabs(44) + pad(8) + border(1) = 118.
     *
     * An earlier pass had this at 116 by omitting the two borders. The Specialist caught
     * it and the arithmetic confirms it: Medium 1+12+56+8+44+12+1 = 134 and Large
     * 1+16+64+12+44+16+1 = 154, both matching the Figma instance frames. The handoff
     * §4 table says "about 116 / about 132 / about 152" — "about" is doing real work
     * there, and the rendered box is 118/134/154. */
    expandedHeight: 118,
    compactWidth: 182,
    compactHeight: 28,
    padding: 8,
    rowHeight: 48,

     fBody: 11,
     typeScale: 0.85,
    iconOnlyTabs: true,
    label: 'Small',
  },
  medium: {
    /* Board 2 "Medium": frame 560 wide; content 534x56; page/focus 526x51; tabs 534x44 r=8.
     * Height = 1 + 12 + 56 + 8 + 44 + 12 + 1 = 134 (see the Small preset for the derivation). */
    expandedWidth: 560,
    expandedHeight: 134,
    compactWidth: 198,
    compactHeight: 32,
    padding: 12,
    rowHeight: 56,

     fBody: 12,
     typeScale: 1,
    iconOnlyTabs: false,
    label: 'Medium',
  },
  large: {
    expandedWidth: 680,
    /* 1 + 16 + 64 + 12 + 44 + 16 + 1 = 154. The gap is 12 at Large, 8 at S/M. */
    expandedHeight: 154,
    compactWidth: 227,
    compactHeight: 40,
    padding: 16,
    rowHeight: 64,

     fBody: 14,
     typeScale: 1.2,
    iconOnlyTabs: false,
    label: 'Large',
  },
};

**Derivation (from the same file, lines 87-95):**

```
Small:  1 + 8  + 48 + 8  + 44 + 8  + 1 = 118   (480 wide, icon-only tabs)
Medium: 1 + 12 + 56 + 8  + 44 + 12 + 1 = 134   (560 wide)
Large:  1 + 16 + 64 + 12 + 44 + 16 + 1 = 154   (680 wide)
```

The content row is `rowHeight`. A page may never exceed it; overflow scrolls inside it.

---

## 2. TOKENS

### 2.1 Island tokens — `src/features/halo/halo.css` (dark, lines 40-105)

	   which is the trap `index.css:401-406` documents for a router-less entry. */
/* ── PALETTE — MEASURED FROM THE FIGMA NODE TREE, not invented ──────────────
	 * Every value below appears verbatim in the file. The fills actually used, by frequency:
	 *   #fafafa 87 · #71717a 87 · #6fb38f 80 · #a1a1aa 69 · #57534e 58 · #1c1917 39
	 *   #09090b 34 · #2e2e33 25 · #8a847a 24 · #f7f4ec 21 · #27272a 19 · #18181b 19
	 * #6fb38f is the ONLY accent in the whole file — 80 uses, all of them the live/recording
	 * state (the pause button, the status dot). Nothing else is tinted.
	 */
	--halo-surface: #09090b;   /* the island card */
	--halo-raised: #18181b;    /* the tab rail track */
	--halo-tab: #27272a;       /* the SELECTED tab pill */
	--halo-border: #2e2e33;
	--halo-text: #fafafa;
	--halo-muted: #a1a1aa;
	/* VERDICT 2026-10-08: text/muted is #8b8b94, not #71717a.
	 *
	 * The handoff flagged its own accessibility defect: #71717a is 4.1:1 on #09090b, below
	 * the 4.5:1 WCAG AA threshold for body text, and the Specialist has since corrected the
	 * value in the Figma variables. Measured against this stylesheet's own surfaces:
	 *
	 *   #71717a on #09090b -> 4.1:1   FAIL
	 *   #8b8b94 on #09090b -> 5.9:1   PASS   <- the verdict's value
	 *   #8b8b94 on #18181b -> 5.2:1   PASS
	 *
	 * The Specialist's constraint, recorded so it is not violated later: text/muted is for
	 * text on bg/base and bg/raised ONLY. On bg/hover (#27272a) it drops to ~4.4:1, so a
	 * selected or hovered tab must use text/primary, which the tab rules already do. */
	--halo-dim: #8b8b94;
	--halo-accent: #6fb38f;    /* the only accent — live, recording, active */
	--halo-accent-dim: #2f7d5b;

	/* ── RADII — the file uses exactly 8, 12 and 999 (plus 1 and 5 on tiny icons) ──── */
	--halo-radius-compact: 9999px;
	--halo-radius-expanded: 12px;
	--halo-radius-card: 12px;
	--halo-radius-control: 8px;
	--halo-radius-rail: 8px;

	/* ── SHADOW: §78 static, single value ── */
	--halo-shadow: 0 12px 36px rgb(0 0 0 / 0.32);

	/* LAMINAR §2: amber is the signal hue for time-domain surfaces. The stopwatch
	   is one, so it gets amber — not the brand pink, which is reserved for
	   Focus/Deep Focus. */
	/* The one non-accent semantic: a WARNING (an overdue deadline). Self-contained hex because the
	 * island window must not depend on the app palette to render a critical state. */
	--halo-signal: #d97706;
	--halo-track: var(--ws-surface-raised);
	--halo-hairline: var(--ws-border);

  /* Figma §3 token names, bound to OUR existing palette rather than new values.
   *
   * The handoff lists `bg/raised`, `bg/hover` and `border/hairline`. Introducing those names
   * with their own hexes would create a second palette inside the island, which LAMINAR §1
   * forbids and which is exactly the drift that produced a wrong Warm Paper contrast fix
   * earlier today. So the names are added as ALIASES onto tokens the app already owns:
   *   bg/raised  -> --ws-surface-raised  (#18181b dark / #fcfbf8 warm paper)
   *   bg/hover   -> --ws-surface-hover   (the selected-tab and button-hover fill)
   *   hairline   -> --ws-border          (already aliased above)
   * The VALUES therefore track both themes automatically, with no second source of truth. */
  --halo-bg-raised: var(--ws-surface-raised);
  --halo-bg-hover: var(--ws-surface-hover);
  --halo-signal-on: var(--ws-surface);
}

/* ── WARM PAPER / LIGHT — HALO_STATES.html:10 ──────────────────────────────────

### 2.2 Island tokens — light ("Warm Paper"), `src/features/halo/halo.css` (lines 135-170)

	   a GREEN accent (#2f7d5b). Section 11 makes deep teal the one light signal hue and states
	   that green is semantic-only; keeping the Figma green is precisely the green-vs-teal clash
	   section 11 was written to end, and it made the island read as a foreign object beside the
	   real app. Light INVERTS against dark (dark ladders surface<raised<tab in lightness), so
	   the same three roles map to card / paper / sunken here. */
	--halo-surface: #fcfbf8;
	--halo-raised: #f5f2ec;
	--halo-tab: #edeae2;
	/* Section 11: "light needs MORE alpha than dark, because a dark hairline vanishes into a
	   bright field where a light one does not." The Figma solid #e0d9c8 was off-token and too
	   heavy against a cream card. */
	--halo-border: rgb(28 25 23 / 0.10);
	--halo-text: #1c1917;
	--halo-muted: #57534e;
	--halo-dim: #6f665e;        /* section 11 text-faint, 4.67:1 on sunken */
	--halo-accent: #0e7490;     /* section 11 the one light signal hue (a FILL token) */
	/* The warning hue must be declared per theme, not inherited. `--halo-signal` carries an
	 * overdue deadline and is drawn as TEXT on the light surface, so the dark-theme amber
	 * (#d97706) sits at only ~2.9:1 on #fcfbf8 — unreadable. #a8500a is the same hue darkened
	 * for light surfaces and holds 4.6:1. */
	--halo-signal: #a8500a;
	--halo-accent-dim: color-mix(in srgb, #0e7490 55%, #edeae2);
	--halo-on-accent: #ffffff;  /* white on teal = 5.36:1; near-black here would be 3.71:1 */
	/* Section 11: "Depth comes from hairlines, never shadow... a drop shadow is a lie." The
	   Figma light theme carried 0 8px 24px; the hairline above now carries the edge. */
	--halo-shadow: none;
}

/* Dark-theme twin of --halo-on-accent. Declared here so the token exists in BOTH themes:
 * an undefined custom property makes `color: var(--halo-on-accent)` fall back to
 * inherit, which is exactly the kind of silent default that hides a missing theme. */
.halo-root {
	--halo-on-accent: #09090b;
}

.halo-surface {

### 2.3 Type, rhythm, weight, tracking, leading — `src/features/halo/halo.css` (lines 448-500)

	 * `prefs.scale`, and `max(11px, …)` floors every role. The floor is not decoration:
	 * 11px is the smallest size at which a numeral is still legible, and the Figma handoff
	 * §4 independently specifies "Minimum font size is 11 at every size" while letting the
	 * Small preset render at 85%. Those two rules can only both hold with a floor, so the
	 * floor wins and the 85% is honoured down to 11px.
	 */
	--halo-scale: 1;

	--halo-t-micro: max(11px, calc(9px * var(--halo-scale)));   /* unit marks, ring caption */
	--halo-t-eyebrow: max(11px, calc(11px * var(--halo-scale))); /* FILE: JetBrains Mono 400/11, #71717a */
	--halo-t-label: max(11px, calc(12px * var(--halo-scale)));   /* FILE: Inter 400/12 (tab label), 500/16 for app names */
	--halo-t-value: max(11px, calc(14px * var(--halo-scale)));   /* FILE: JetBrains Mono 500/14 */
	/* FILE: the expanded hero numeral is JetBrains Mono 500/26 at Medium, the dim `00:` prefix
	 * and the bright `42:18` inside ONE time block (HALO_STATES.html board 2, `.time`).
	 *
	 * WAS 36px. That number came from a Figma export read at a different scale, not from the
	 * states file: `--time` is 22 (S) / 26 (M) / 31 (L), so the ceiling at Large is 31px. A 36px
	 * numeral does not fit the 134px Medium panel — line-height alone put the hero row taller
	 * than `--ct`, and the user saw the panel cropped with its bottom cut off.
	 *
	 * The ceiling is now the SPEC's, not a guess: `max()` keeps the 22px floor that §174 requires
	 * for legibility while the design ceiling is `--time` at Large. */
	--halo-t-hero: max(22px, calc(26px * var(--halo-scale)));
	--halo-t-display: max(11px, calc(22px * var(--halo-scale))); /* the hero numeral. ONE per surface. */

	/* ── Rhythm. A 4px base; only these six steps are legal. ───────────────── */
	/*
	 * Rhythm scales WITH the box for the same reason type does. Leaving these fixed while
	 * the box shrank meant the fixed 16px+12px insets plus the 30px tab rail ate 58px of a
	 * 165px expanded panel at scale 0.7 — a third of the box — and clipped the content.
	 */
	--halo-gap-hair: max(3px, calc(4px * var(--halo-scale)));
	--halo-gap-tight: max(4px, calc(6px * var(--halo-scale)));
	--halo-gap: max(6px, calc(8px * var(--halo-scale)));
	--halo-gap-loose: max(8px, calc(12px * var(--halo-scale)));
	--halo-gap-block: max(10px, calc(16px * var(--halo-scale)));

	/* ── Weight. 400/500/600 only. 700 is reserved for the hero numeral. ───── */
	--halo-w-normal: 400;
	--halo-w-medium: 500;
	--halo-w-semibold: 600;

	/* ── Tracking. Numerals get 0; uppercase needs air; nothing gets negative. ─ */
	--halo-track-num: 0;
	--halo-track-eyebrow: 0.14em;

	/* ── Leading. Tight on numerals, relaxed on prose. ─────────────────────── */
	--halo-lead-tight: 1;
	--halo-lead-snug: 1.25;
	--halo-lead: 1.4;
}

/* ── The five text roles. A component sets a ROLE, never a size. ───────────── */

### 2.4 Productivity tiers — `src/index.css` (dark lines 196-201, light 606-611)

```
--tier-productive: #22c55e;   --tier-neutral: #3b82f6;   --tier-distracting: #ef4444;
--tier-productive-muted: color-mix(in srgb, #22c55e 12%, transparent);
--tier-neutral-muted:    color-mix(in srgb, #3b82f6 12%, transparent);
--tier-distracting-muted:color-mix(in srgb, #ef4444 12%, transparent);

html.light:
--tier-productive: #166534;   --tier-neutral: #1d4ed8;   --tier-distracting: #b91c1c;
--tier-productive-muted: rgb(22 101 52 / 0.10);
--tier-neutral-muted:    rgb(29 78 216 / 0.10);
--tier-distracting-muted:rgb(185 28 28 / 0.10);
```

### 2.5 LAMINAR — `design/design.md` (the constitution, abridged to the binding clauses)

```
§2  One signal hue per surface. Island: sage #6fb38f dark / teal #0e7490 light.
    amber #fbbf24 = time-domain; pink #ec4899 = Focus/brand; cyan = workspace;
    emerald #34d399 = success ONLY; rose #ef4444 = error ONLY.
§3  Inter (UI) · Space Grotesk (display) · JetBrains Mono (numerals).
    MAX 2 FAMILIES PER VIEW. Island uses Inter + JetBrains Mono.
§4  Radii: 8 (sm) / 12 (card, max) / 9999 (pill). rounded-2xl and 3xl are BANNED.
    Slots per surface: background · hairline · one signal hue.
§6  Easing cubic-bezier(0.16,1,0.3,1). 150 / 250 / 400ms.
    No spring overshoot. No decorative infinite loops. Honour reduced motion.
§7  BANNED: decorative gradients · >1 signal hue · backdrop-blur chrome · spring ·
    emoji icons · neon glow · raw hex in .tsx · mixed icon sets · bespoke shadows.
§11 Light is first-class. Depth from hairlines, never shadow. Accent TEXT in light
    mode uses --ws-accent-text (#0b5c73), never --ws-accent.
```

---

## 3. THE FOCUS ROW — `src/features/halo/FocusPageRow.tsx` (FULL FILE, 403 lines)

This is the component the focus-session design must change. It renders BOTH states
(stopwatch and running session).

/**
 * THE FIGMA `page/focus` ROW — board 2, transcribed node by node.
 *
 * WHY THIS IS A SEPARATE COMPONENT
 * --------------------------------
 * The Focus page previously rendered `StopwatchHeroExpanded` when expanded, which is a large
 * composition: a `ShareRing` donut, a productive/distracting tier bar, a "Tracked" eyebrow and
 * an app-name block. That layout is NOT what the Figma file specifies, and it is the reason
 * the expanded island reads as heavy in a 134px surface: the file's `page/focus` is a single
 * 51px ROW with a 34px time block and two 44px round controls.
 *
 * So this implements the file's row and is used ONLY by the Figma layout. `StopwatchHeroExpanded`
 * is untouched and still serves the legacy layout, so nothing that was working regresses and
 * the two designs can never silently bleed into each other.
 *
 * THE NODE TREE, verbatim (`node-id=9:304`):
 *
 *   page/focus [FRAME] 526x51
 *     Frame 199x51
 *       Frame 199x15
 *         Ellipse 6x6 fill=#6fb38f                              <- live status dot
 *         TEXT 187x15 #71717a JetBrains Mono 400/11 "STOPWATCH   HALO REDESIGN"
 *       time [FRAME] 125x34
 *         TEXT 47x34 #71717a JetBrains Mono 500/26 "00:"         <- hours DIMMED
 *         TEXT 78x34 #fafafa JetBrains Mono 500/26 "42:18"       <- m:ss BRIGHT
 *     Rectangle 1x44 fill=#2e2e33                                <- divider
 *     Frame 68x38
 *       TEXT 37x15 #8b8b94 JetBrains Mono 400/11 "PRODUCTIVE"  <- renamed, see below
 *       TEXT 68x21 #a1a1aa JetBrains Mono 500/16 "3:12:40"
 *     spacer [FRAME] 98x1
 *     Frame 96x44
 *       button/reset 44x44 r=999 stroke=#2e2e33 w=1
 *         icon/reset 16x16  Vector 12x12 stroke=#a1a1aa w=2
 *       button/pause 44x44 r=999 fill=#6fb38f
 *         icon/pause 16x16  Vector 3x11 stroke=#09090b w=2  (x2)
 *
 * TWO DETAILS THAT ARE EASY TO GET WRONG AND WERE:
 *   1. The time is SPLIT and the hours are DIMMED (#71717a), not one uniform bright string.
 *      A single `<span>` of the whole clock loses the file's only use of dimmed type in the
 *      numeral, which is what makes `00:` recede and `42:18` carry the eye.
 *   2. The pause icon is #09090b — DARK ON THE ACCENT. It is the one place in the whole file
 *      where the foreground inverts, because the pause button is the only solid fill.
 */
import { memo } from 'react';
import { AppWindow, Globe, Lock, Pause, Play, RotateCcw } from 'lucide-react';
import { formatStopwatch, type StopwatchSnapshot } from '../../lib/stopwatchStore';

/** The file's literal. The 3-space gap is a designed separator, not a typo — do not collapse it. */
/** HALO_STATES.html line 105, verbatim: `lab('Stopwatch')`.
 *
 * WAS `'STOPWATCH   HALO REDESIGN'` — a FIGMA FRAME NAME, not user-facing copy. It read as a
 * design artefact on screen and it silently replaced the spec's own label, so the first block
 * did not match the file it claims to transcribe. The file's three block labels are Stopwatch /
 * Tracking / Productive, and the other two were already correct.
 *
 * Uppercase is applied by `EYEBROW_STYLE` (`text-transform`), matching `.lab` in the spec. */
const EYEBROW = 'Stopwatch';

/** The label the row wears while a REAL focus session is running. */
const FOCUS_EYEBROW = 'Focus';

/**
 * The shape `halo:get-focus` returns. Declared here (and exported) because the row is its only
 * consumer besides the producer itself; a shared/ type would be a third place for it to drift.
 *
 * `endsAt: null` IS NOT "FINISHED". The FocusManager supports an open-ended session
 * (`durationSec: 0`), which counts UP instead of down; collapsing that into 0 remaining would
 * print a finished-looking clock for a session that has only just begun.
 */
export interface HaloFocusState {
  ok: boolean;
  active?: boolean;
  paused?: boolean;
  endsAt?: number | null;
  remainingSec?: number | null;
  startedAt?: number | null;
  strictness?: 'distracting' | 'non_allowed';
  allowedApps?: string[];
  allowedDomains?: string[];
  allowedTiers?: string[];
  error?: string;
}

export interface FocusPageRowProps {
  snapshot: StopwatchSnapshot;
  onReset: () => void;
  onTogglePause: () => void;
  /**
   * What the stopwatch is tracking — HALO_STATES.html line 143 specifies THREE shapes:
   *   win  a desktop app    -> "Figma"
   *   web  a browser site   -> "github.com"
   *   priv a private window -> "Private window", with NO name shown
   * The `priv` case is a privacy guarantee, not a label, so this carries no hostname field.
   * Omitted = no reading yet, which renders the honest waiting state.
   */
  tracked?: { kind: 'win' | 'web' | 'priv'; label: string };
  /**
   * THE REAL FOCUS SESSION — the thing this page was named after and never connected to.
   *
   * `null`/absent means there is no session (or no producer yet), and the row is exactly the
   * stopwatch it has always been. When a session IS running the row describes it instead:
   * the countdown replaces the stopwatch, and the lock states what is being enforced.
   */
  focus?: HaloFocusState | null;
  /** The island's one-second tick, so `endsAt` renders as a LIVE countdown rather than a
   *  number frozen at whatever the last producer pull saw. */
  now?: number;
}

/** Split `HH:MM:SS` so the hours can be dimmed and `MM:SS` left bright, per board 2. */
function splitClock(ms: number): { dim: string; bright: string } {
  const full = formatStopwatch(ms); // always HH:MM:SS
  const idx = full.indexOf(':');
  return { dim: full.slice(0, idx + 1), bright: full.slice(idx + 1) };
}

const EYEBROW_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  fontSize: 'max(11px, calc(11px * var(--halo-scale, 1)))',
  fontWeight: 400,
  color: 'var(--halo-dim)',
  lineHeight: 1,
  /* HALO_STATES.html line 29, verbatim: `.lab { letter-spacing:.08em; text-transform:uppercase }`.
   * Applied in CSS so the label is stored in its real words and uppercased by the same rule the
   * spec uses, rather than being typed in caps. */
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

/*
 * PRODUCTIVE, not TODAY. THE LABEL IS A CLAIM AND IT WAS LYING.
 *
 * The number below is `stopwatch.productiveMs` — productive time ONLY. It excludes
 * neutral and distracting time, so labelling it "TODAY" claimed it was a whole-day total
 * when it was a subtotal. Claude's Round 3 ruling: "don't change the behavior. The number
 * is productive time only, so rename the label to PRODUCTIVE."
 *
 * So behaviour is untouched and the label now matches what the number is. Summing all
 * three tiers would make TODAY honest, but that is a behaviour change and was explicitly
 * not authorised. `HALO_STATES.html` line 106 uses `blk('Productive', ...)` and its own
 ** note repeats this.
 */

/** `HH:MM` in LOCAL time — the wall-clock moment a countdown lands on. */
function formatWallClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const FocusPageRow = memo(function FocusPageRow({
  snapshot,
  onReset,
  onTogglePause,
  tracked,
  focus,
  now,
}: FocusPageRowProps) {
  /* THE REAL SESSION, IF ONE IS RUNNING.
   *
   * `ok` is checked, not just `active`: a producer that failed to answer must not be read as
   * "no session", because that would silently swap the countdown for a stopwatch while a lock
   * is actually engaged — the "the island doesn't know what's happening" failure again. A failed
   * read falls back to the stopwatch row, which is the honest thing the row can still show. */
  const session = focus && focus.ok && focus.active ? focus : null;

  /* THE LOCK WORD. `strictness` is what the FocusManager enforces in `isAllowed()`:
   *   'distracting' -> everything classified distracting is blocked, neutral passes
   *   'non_allowed' -> ONLY the session's own allow-list is tolerated
   * The row carries the short word; the full rule goes in `title`, because 11px mono cannot
   * hold a sentence without eating the app name. */
  const lockLabel = session?.strictness === 'non_allowed' ? 'Allow-list' : 'Locked';
  const lockRule =
    session?.strictness === 'non_allowed'
      ? 'Only the apps and sites allowed in this session are open'
      : 'Distracting apps and sites are blocked';

  /* THE CLOCK IS THE SESSION'S WHILE A SESSION RUNS.
   *
   * `displayMs` — the store's "THE number every surface displays" — is what the pill shows and
   * what this row showed. During a focus session THAT is no longer the number that matters, so
   * the row counts the session down (or up, for an open-ended session, which has no `endsAt`)
   * and the pill keeps the stopwatch. One surface, one subject; no number is printed twice. */
  const tickNow = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  const endsAt = typeof session?.endsAt === 'number' ? session.endsAt : null;
  const startedAt = typeof session?.startedAt === 'number' ? session.startedAt : null;
  const sessionMs =
    endsAt != null
      ? Math.max(0, endsAt - tickNow)
      : startedAt != null
        ? Math.max(0, tickNow - startedAt)
        : 0;

  const { dim, bright } = splitClock(session ? sessionMs : snapshot.displayMs);
  const paused = snapshot.paused;
  /* The dot is the file's live indicator and it wears the ONLY accent. A running session is
   * live by definition; otherwise it follows the stopwatch's real paused state. */
  const live = session ? true : !paused;
  const eyebrow = session ? FOCUS_EYEBROW : EYEBROW;
  /* The wall-clock the lock lifts. Absent for an open-ended session — inventing an ENDS for a
   * session that has no end would be the same class of lie as a fabricated zero. */
  const endsAtLabel = endsAt != null ? formatWallClock(endsAt) : null;

  return (
    <div
      className="flex items-center"
      style={{ gap: 'var(--halo-gap-loose)', width: '100%' }}
      data-halo-focus-row="true"
    >
      {/* ── THE STOPWATCH GROUP — dot, label, app name, clock. ONE fact. ────────────
       *
       * THE USER'S CORRECTION, AND IT OVERRIDES BOARD 2.
       * "I have been in Figma for 42 minutes" is ONE statement. The previous layout split it
       * across three blocks separated by two dividers — STOPWATCH | TRACKING Figma |
       * PRODUCTIVE — so the app name read as an unrelated figure next to the timer, and the eye
       * had to re-join them. The name belongs WITH the stopwatch; that is where it is now.
       *
       * HALO_STATES.html line 143 specifies three separate blocks. This deliberately departs
       * from it, at the user's instruction, and departs only in GROUPING — no dimension, no
       * colour, no token and no control changed. One divider remains, between this group and
       * PRODUCTIVE, so the row is still two figures rather than four.
       *
       * The private shape is preserved verbatim: a private window shows a lock and the words
       * "Private window" and NEVER a hostname, because main suppresses the domain for one. */}
      <div
        className="flex flex-col justify-center"
        style={{ minWidth: 0, gap: 2, flex: '0 1 auto' }}
      >
        <div className="flex items-center" style={{ gap: 6, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              flexShrink: 0,
              /* `live` -> the only accent. `paused` -> the dim token, NOT opacity. */
              background: live ? 'var(--halo-accent)' : 'var(--halo-dim)',
            }}
          />
          <span style={{ ...EYEBROW_STYLE, flexShrink: 0 }}>{eyebrow}</span>
          {/* THE LOCK — what this page was missing. It is not decoration: while a session is
           * running the FocusManager is actively blocking apps, and a row that showed a bare
           * countdown made the island look disconnected from the feature enforcing it. */}
          {session && (
            <span
              className="flex items-center"
              title={lockRule}
              aria-label={lockRule}
              style={{ gap: 4, flexShrink: 0 }}
            >
              <Lock size={11} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-accent)' }} />
              <span style={{ ...EYEBROW_STYLE, color: 'var(--halo-text)' }}>{lockLabel}</span>
            </span>
          )}
          {tracked && (
            <>
              {/* hairline between the label and the name: a SEPARATOR, not a block divider.
               * It reads as one label reading "STOPWATCH · Figma", not two figures. */}
              <span aria-hidden="true" style={{ width: 1, height: 8, flexShrink: 0, background: 'var(--halo-border)' }} />
              <span className="flex items-center" style={{ gap: 6, minWidth: 0, flex: '0 1 auto' }}>
                {tracked.kind === 'priv' ? (
                  <Lock size={13} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)', flexShrink: 0 }} />
                ) : tracked.kind === 'web' ? (
                  <Globe size={13} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)', flexShrink: 0 }} />
                ) : (
                  <AppWindow size={13} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--halo-muted)', flexShrink: 0 }} />
                )}
                {/* STOPPED -> the name turns MUTED (board 2 line 143). The dot already
                 * follows `live`; a bright name beside a dim dot would still advertise an
                 * active target. `minWidth: 0` is what lets the ellipsis work at all. */}
                <span
                  style={{
                    fontSize: 'max(12px, calc(14px * var(--halo-scale, 1)))',
                    color: live ? 'var(--halo-text)' : 'var(--halo-dim)',
                    minWidth: 0,
                    flex: '0 1 auto',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  {tracked.label}
                </span>
              </span>
            </>
          )}
        </div>
        <div
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 'max(20px, calc(26px * var(--halo-scale, 1)))',
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          {/* THE SPLIT. Dimmed hours, bright minutes+seconds. One span cannot do this. */}
          <span style={{ color: 'var(--halo-dim)' }}>{dim}</span>
          <span style={{ color: 'var(--halo-text)' }}>{bright}</span>
        </div>
      </div>

      {/* ── NO SECOND CLOCK. ────────────────────────────────────────────────────────
       * This row used to carry a second time readout — "PRODUCTIVE  3:12:40" — separated
       * from the stopwatch by a divider. That is the user's "two stopwatches on the open
       * island": two mono `hh:mm:ss` figures on one 51px row, and the one that answers
       * "what am I looking at" (the app/site name, next to the stopwatch) was missing
       * because `trackedTarget` dropped it for desktop apps.
       *
       * Board 2 draws both figures, but the user overrode it: the row now carries ONE clock
       * and the name. The productive subtotal is still on the dashboard, where it belongs;
       * it was never the island's job. */}
      {/* ── ENDS hh:mm — the wall-clock the lock lifts ──────────────────────────
       * Sits where the productive subtotal used to: a labelled secondary fact, one line of
       * eyebrow and one of mono, so the right side of the row is not empty while a session
       * runs and the two round controls stand down (they drive the STOPWATCH, which is not
       * what this row is showing — a pause button next to a countdown would be a lie). */}
      {session && (
        <div className="flex flex-col" style={{ gap: 2, flexShrink: 0 }}>
          <span style={EYEBROW_STYLE}>Ends</span>
          <span
            className="font-mono tabular-nums"
            style={{ fontSize: 'max(15px, calc(18px * var(--halo-scale, 1)))', color: 'var(--halo-muted)' }}
          >
            {/* An open-ended session (no `endsAt`) has no wall-clock to print. "no limit" is
             * the truthful value; an em-dash would read as "unknown", which it is not. */}
            {endsAtLabel ?? 'no limit'}
          </span>
        </div>
      )}

      {/* spacer — the file's own 98px gap between the readout and the controls */}
      <span aria-hidden="true" className="flex-1" />

      {/* THE CONTROLS BELONG TO THE STOPWATCH, SO THEY EXIST ONLY WHILE IT IS THE SUBJECT.
          Resetting or pausing a countdown you did not start (and cannot pause) is a control
          that lies about what it does; the FocusManager owns the session and the app owns its
          controls. When no session runs, these are exactly the board-2 buttons. */}
      {!session && (
        <>
      {/* ── button/reset: 44x44 r=999, OUTLINE #2e2e33, icon #a1a1aa ─────────── */}
      <button
        type="button"
        onClick={onReset}
        aria-label="Reset timer"
        title="Reset timer"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: 'transparent',
          border: '1px solid var(--halo-border)',
          color: 'var(--halo-muted)',
          cursor: 'pointer',
        }}
      >
        <RotateCcw size={13} strokeWidth={2} aria-hidden="true" />
      </button>

      {/* ── button/pause: 44x44 r=999, SOLID accent, icon #09090b (dark on accent) ─ */}
      <button
        type="button"
        onClick={onTogglePause}
        aria-label={paused ? 'Resume timer' : 'Pause timer'}
        title={paused ? 'Resume' : 'Pause'}
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          /* the file's only solid fill, and only while live: paused it takes the outline
           * treatment so the state is legible without reading the label. */
          background: paused ? 'transparent' : 'var(--halo-accent)',
          border: paused ? '1px solid var(--halo-border)' : '1px solid transparent',
          /* `--halo-on-accent`, not a hardcoded ink. The glyph sits on the accent FILL, and
           * the fill changes per theme while the glyph did not: dark ink was 8.07:1 on the
           * dark sage accent but only 3.71:1 on the light teal one — a real AA body-text
           * failure that was invisible in the theme the island was designed in. The token is
           * white-on-accent in light and near-black-on-accent in dark. */
          color: paused ? 'var(--halo-muted)' : 'var(--halo-on-accent)',
          cursor: 'pointer',
        }}
      >
        {paused ? (
          <Play size={13} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Pause size={13} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
        </>
      )}
    </div>
  );

---

## 4. THE ISLAND ROOT — `src/features/halo/OverlayRoot.tsx`

### 4.1 The ambient edge ring (lines 1526-1545)

            /* PRODUCTIVITY AMBIENCE — the edge ring the user asked for.
             *
             * `prefs.ambient === 'edge'` tints a 1px ring (plus a faint halo) with the CURRENT
             * ACTIVITY's tier — green productive, red distracting, neutral otherwise. See
             * `ambientTier` above for why that is `currentApp.tier` and not the stopwatch's.
             * The base `--halo-shadow` is preserved as the FIRST layer, so the ring ADDS to the
             * designed elevation instead of replacing it (in the light theme that variable
             * is `none`, and the ring is the only shadow — correct there too).
             *
             * Deliberately a ring, not a fill: a fill would compete with the numeral for
             * the pill's 32px of height, and LAMINAR §7.2 bans a decorative glow on chrome. */
            ...(prefs.ambient === 'edge'
              ? {
                  boxShadow: `var(--halo-shadow), 0 0 0 1px var(--tier-${ambientTier}), 0 0 14px color-mix(in srgb, var(--tier-${ambientTier}) 30%, transparent)`,
                }
              : {}),
          }}
          /* Stop a click on the island from also reading as a "click outside" (HALO §51).
           * Without this the pin button's own click would bubble to the document listener
           * and immediately unpin what it just pinned — a toggle that could never latch. */

### 4.2 How the ambient tier is chosen (lines 1384-1400)


  /* WHICH TIER TINTS THE AMBIENT EDGE.
   *
   * The user's wording: "the productivity / neutral / distracting category that is supposed to
   * give the scent, or like ambient colour". That is the CATEGORY OF WHAT YOU ARE DOING RIGHT
   * NOW — `NowPayload.tier`, classified by the tracker per app/domain — not the stopwatch's
   * `activeTier`. `stopwatchStore.setTier()` only accepts 'productive' | 'distracting' and is
   * never set by the tracker at all, so tinting from it meant the ring was neutral almost
   * always and flipped only when the user manually cycled a tier: an ambience that never
   * reacted to the app in front of you.
   *
   * `currentApp.tier` is the live reading. The stopwatch tier stays the fallback for the one
   * case the reading cannot cover — no foreground app at all (`currentApp` is the fixture, whose
   * tier is the honest 'neutral'). */
  const ambientTier = currentApp.tier ?? swPayload.tier;

  /* ONE ERROR FOR THE SCHEDULE PAGE. Two producers read the same `deadlines` table — the

### 4.3 The Schedule page, in full (lines 1837-2037)

This is the block the Schedule design replaces. Note the 22px rows, the wheel
`stopPropagation`, and the three top-level states (error / loading / empty-or-list).

        {/* ══ THE SCHEDULE PAGE — a compact LIFE → SCHEDULE view ══════════════════
         *
         * WHAT THIS REPLACED. The page used to print ONE deadline as three labelled figures —
         * NEXT DEADLINE | STATUS | OPEN — which is why the user could only ever see one thing:
         * `halo:get-next-deadline` returns a single row by design, and there was no list behind
         * it. The remaining width was a divider and empty space, and adding a second deadline
         * changed nothing on screen.
         *
         * WHAT IT IS NOW. The Life page's two live facts, in one scrollable column that is
         * exactly `size.rowHeight` tall:
         *   - the NEAREST CLASS BLOCK (from `schedule_entries`, recurring weekday + HH:MM), and
         *   - EVERY open DEADLINE, each with the ALARM the user set on it (`remind_at`).
         *
         * WHY A SCROLLER AND NOT A TALLER PAGE. The expanded surface is a fixed preset
         * (134px on Medium = 1 + 12 + 56 + 8 + 44 + 12 + 1), so a page may never exceed
         * `rowHeight`. A list that grows with the data would push the tab rail out of the
         * window — the "adding new stuff breaks the UI" report. The height is fixed, the rows
         * are fixed, and the overflow scrolls: adding the twentieth deadline cannot move
         * anything outside the panel.
         *
         * The wheel is STOPPED here on purpose. The surface's own handler treats a wheel as
         * "next page", so without this one flick over the list would flip to Tools instead of
         * scrolling the deadlines the user was trying to reach. */}
        {expanded && tab === 'deadlines' && (
          <div style={{ height: size.rowHeight, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {scheduleError ? (
              /* FAILED — we could not read the tables. Not the same as "nothing due". */
              <div className="flex items-center" style={{ gap: 8, width: '100%', height: '100%' }}>
                <span style={{ fontSize: 'var(--halo-t-value)', color: 'var(--halo-text)' }}>{scheduleError}</span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => void pullRef.current?.()}
                  aria-label="Retry loading the schedule"
                  style={{
                    width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--halo-hairline)', background: 'transparent',
                    color: 'var(--halo-muted)', cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : !life ? (
              /* WAITING — no reading has arrived yet. Skeletons, never a fabricated zero. */
              <div
                className="flex items-center"
                aria-busy="true"
                style={{ gap: 'var(--halo-gap-loose)', width: '100%', height: '100%' }}
              >
                <SkeletonBlock label="Next class" width={132} />
                <span aria-hidden="true" style={DIVIDER} />
                <SkeletonBlock label="Deadlines" width={168} />
              </div>
            ) : life.schedule || life.deadlines.length > 0 ? (
              <div
                data-halo-life-list="true"
                onWheel={(e) => e.stopPropagation()}
                style={{
                  height: '100%',
                  width: '100%',
                  minWidth: 0,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  paddingRight: 2,
                  scrollbarWidth: 'thin',
                }}
              >
                {/* ── THE NEAREST CLASS BLOCK ──────────────────────────────────────
                 * `isNow` is the block that has STARTED but not finished, so the label flips
                 * from NEXT to NOW and the right side reads "until 13:00" instead of a countdown
                 * to a start that is already in the past. */}
                {life.schedule && (
                  <div
                    data-halo-life-row="class"
                    className="flex items-center"
                    style={{ gap: 8, minWidth: 0, flexShrink: 0, height: 22 }}
                  >
                    <CalendarClock
                      size={12}
                      strokeWidth={2}
                      aria-hidden="true"
                      style={{ color: 'var(--halo-accent)', flexShrink: 0 }}
                    />
                    <span style={{ ...EYEBROW, flexShrink: 0 }}>{life.schedule.isNow ? 'Now' : 'Next'}</span>
                    <span
                      className="truncate"
                      style={{ flex: '1 1 auto', minWidth: 0, fontSize: 'var(--halo-t-value)', color: 'var(--halo-text)' }}
                    >
                      {life.schedule.title || 'Untitled'}
                    </span>
                    <span
                      style={{
                        flexShrink: 0, whiteSpace: 'nowrap', fontSize: 'var(--halo-t-label)',
                        fontFamily: 'var(--font-mono, ui-monospace, monospace)', color: 'var(--halo-muted)',
                      }}
                    >
                      {formatBlockWhen(life.schedule)}
                      {' · '}
                      {life.schedule.isNow
                        ? `until ${life.schedule.endTime}`
                        : formatIn(life.schedule.startsAtMs - life.now)}
                    </span>
                  </div>
                )}

                {/* ── EVERY OPEN DEADLINE, soonest first ──────────────────────────
                 * Four facts per row, left to right: the title (the only thing that truncates),
                 * the calendar day the work is due, the ALARM the user set for it, and how long
                 * is left. The alarm is the `remind_at` column read verbatim — a deadline with
                 * no alarm shows no bell rather than a manufactured time. */}
                {life.deadlines.map((d) => {
                  const alarm = pickAlarm(d);
                  return (
                  <div
                    key={d.id || d.title}
                    data-halo-life-row="deadline"
                    className="flex items-center"
                    style={{ gap: 8, minWidth: 0, flexShrink: 0, height: 22 }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6, height: 6, borderRadius: 999, flexShrink: 0,
                        /* overdue is the ONLY signal hue on this row; on-time stays dim. */
                        background: d.isOverdue ? 'var(--halo-signal)' : 'var(--halo-dim)',
                      }}
                    />
                    <span
                      className="truncate"
                      style={{ flex: '1 1 auto', minWidth: 0, fontSize: 'var(--halo-t-value)', color: 'var(--halo-text)' }}
                    >
                      {d.title || 'Untitled'}
                    </span>
                    <span
                      style={{
                        flexShrink: 0, whiteSpace: 'nowrap', fontSize: 'var(--halo-t-label)',
                        fontFamily: 'var(--font-mono, ui-monospace, monospace)', color: 'var(--halo-dim)',
                      }}
                    >
                      {formatDueDay(d.dueAtMs)}
                    </span>
                    {alarm && (
                      <span
                        className="flex items-center"
                        title={alarm.title}
                        style={{ gap: 4, flexShrink: 0, color: 'var(--halo-muted)' }}
                      >
                        <Bell size={11} strokeWidth={2} aria-hidden="true" />
                        <span
                          style={{
                            whiteSpace: 'nowrap', fontSize: 'var(--halo-t-label)',
                            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                          }}
                        >
                          {alarm.label}
                        </span>
                      </span>
                    )}
                    <span
                      style={{
                        flexShrink: 0, whiteSpace: 'nowrap', fontSize: 'var(--halo-t-label)',
                        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                        color: overdueColor(d.isOverdue ?? undefined),
                      }}
                    >
                      {formatDeadlineDue(d.deltaMs ?? undefined)}
                    </span>
                  </div>
                  );
                })}
              </div>
            ) : (
              /* MEASURED ZERO — both tables answered and both said none. Distinct from the
                 failure above: this one is actionable, so it offers the way to fix it. */
              <>
                <span style={{ fontSize: 'var(--halo-t-value)', color: 'var(--halo-muted)' }}>
                  No classes scheduled and no open deadlines.
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => bridge?.navigate?.('/life')}
                  aria-label="Open Schedule"
                  style={{
                    width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--halo-hairline)', background: 'transparent',
                    color: 'var(--halo-muted)', cursor: 'pointer',
                  }}
                >
                  <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        )}

### 4.4 AFK is currently SUPPRESSED on the pill (lines 1615-1632)

The owner is asking for the opposite: the pill should stay and go red.

        {/* COMPACT PIP: the live state's value inside the 232px capsule, plus trailing
            identity dots for activities with no compact content of their own. */}
        {/* `compactStyle: 'off'` — no pip, no dots. The hero numeral is the whole pill. */}
        {/* `composed.live?.kind !== 'afkGap'` — the afk/coffee pip overflows the pill's
            right edge into the identity dots: it is an interrupt, not a "live value", and
            HALO_STATES.html gives it no board-1 pill design. The card still appears in
            the expanded strip's live+rail row, so no information is lost — only the
            mis-placement inside the capsule is. */}
        {prefs.compactStyle !== 'off' && !expanded && showPill && composed.live && composed.live.kind !== 'afkGap' && (
          /* CENTRED ON THE REAL PILL HEIGHT, not `top: 4`.
           *
           * `top: 4` and the dots' `top: 18` were both written for the old fixed 40px pill.
           * The pill is now 28 / 32 / 40 by preset, so a hardcoded offset put the pip high and
           * the dots near the bottom edge at Small — which is the "stopwatch looks shifted"
           * report. Deriving the offset from `size.compactHeight` makes them centred at every
           * size, and the padding scales with the preset too. */
          <div
            style={{

### 4.5 The AFK producer (lines 1095-1112)

/* `afkGap` needs "how long since the user was last here". The store tracks that on its
       * INTERNAL `Store` interface (`lastInteractionAtMs`) and did not publish it on
       * `StopwatchSnapshot`, so this had no honest source: inferring AFK from
       * `runningSinceMs === 0` would also fire on a deliberate PAUSE and would have to report
       * `awayMs: 0`, which is a measurement dressed as a lie.
       *
       * So the field is published instead — it is the store's own interaction heartbeat, which
       * is precisely what the AfkGapPayload doc calls for ("heartbeat-fed, because
       * getSystemIdleTime() returns 0 on Linux"). Read-only; it changes no behaviour. */
      if (snap && snap.lastInteractionAtMs > 0) {
        const awayMs = t - snap.lastInteractionAtMs;
        /* Well above the store's own (user-configurable) idle threshold: the pill must not
         * flicker into an AFK state in the gap between two keystrokes. */
        if (awayMs > IDLE_GAP_SHOW_MS) {
          out.push(
            mk('afkGap', { awayMs, since: new Date(snap.lastInteractionAtMs).toISOString() }, { persistent: false }),
          );
        }

---

## 5. AFK — `src/lib/afk.ts`

### 5.1 Preferences and defaults (lines 28-80)


export type AfkAction = 'pause-only' | 'reset-stopwatch' | 'reset-streak' | 'reset-both';

export interface AfkPrefs {
  /** Idle minutes before AFK behaviour kicks in. */
  thresholdMinutes: number;
  action: AfkAction;
  /** Master switch. Off = never cut, whatever the threshold. */
  enabled: boolean;
  /**
   * Absences shorter than this are discarded silently instead of prompting.
   * Hardcoded to 60s in App.tsx until now, so there was no way to stop a
   * coffee-cup bump from opening a dialog.
   */
  minPromptSeconds: number;
  /**
   * Absences up to this many minutes open with "I wasn't AFK" pre-selected.
   * Hardcoded to 15 in App.tsx.
   */
  notAfkBelowMinutes: number;
  /**
   * Categories where being idle is the POINT — watching a film, playing a game.
   * Hardcoded to Entertainment + Gaming in App.tsx.
   */
  passiveCategories: string[];
  /**
   * A new absence must persist this long before it counts as "away".
   *
   * The threshold is a single crossing, but real use is noisy: you brush the
   * trackpad, glance at another window, come back. Requiring the absence to
   * HOLD before anything happens means those never interrupt you. Raising the
   * threshold alone does not help, because the moment you move the mouse the
   * absence is over — the two knobs solve different halves of the problem.
   */
  holdSeconds: number;
}

/** THE default AFK threshold. Five minutes of no input before AFK is even
 *  considered — anything shorter is not an absence, it is a coffee cup, and
 *  prompting for it is what made people stop trusting the prompt.
 *  Asserted by agent/probes/afk-prefs.probe.ts so it cannot silently drift. */
export const AFK_DEFAULT_THRESHOLD_MINUTES = 5;

export const AFK_DEFAULTS: AfkPrefs = {
  thresholdMinutes: AFK_DEFAULT_THRESHOLD_MINUTES,
  action: 'pause-only',
  enabled: true,
  minPromptSeconds: 60,
  notAfkBelowMinutes: 15,
  passiveCategories: ['Entertainment', 'Gaming'],
  holdSeconds: 90,
};


### 5.2 AFK in the slot model — `src/shared/halo/slotModel.ts` (lines 255-270, 660-672)

    unknown: 'No focus session',
    error: 'Focus state unavailable',
    retry: 'Retry',
  },
  afkGap: {
    loading: 'static_skeleton',
    zero: '0m',
    unknown: 'No gap recorded',
    error: 'Tracking offline',
    retry: 'Retry',
  },
  aiUsage: {
    loading: 'static_skeleton',
    zero: '0 sessions',
    unknown: 'No AI sessions yet',
    error: 'AI stats unavailable',
  route: string | null;
}

export const SURFACES: CuratedSurface[] = [
  { kind: 'stopwatch', lane: 'resident', icon: 'timer', compactChars: 8, liveOnly: false, route: '/' },
  { kind: 'now', lane: 'resident', icon: 'target', compactChars: 12, liveOnly: false, route: '/activity' },
  { kind: 'dictation', lane: 'live', icon: 'mic', compactChars: 5, liveOnly: false, route: null },
  { kind: 'focus', lane: 'live', icon: 'target', compactChars: 6, liveOnly: false, route: null },
  { kind: 'afkGap', lane: 'live', icon: 'coffee', compactChars: 6, liveOnly: true, route: '/activity' },
  { kind: 'aiUsage', lane: 'resident', icon: 'sparkles', compactChars: 6, liveOnly: false, route: '/ai' },
  { kind: 'hud', lane: 'toast', icon: 'terminal', compactChars: 7, liveOnly: false, route: '/penguin-console' },
  { kind: 'nextDeadline', lane: 'resident', icon: 'calendar-clock', compactChars: 6, liveOnly: false, route: '/life' },
  { kind: 'tierBreakdown', lane: 'resident', icon: 'layers', compactChars: 7, liveOnly: false, route: '/reports' },

---

## 6. THE STOPWATCH — `src/lib/stopwatchStore.ts` (lines 96-128)

export interface StopwatchSnapshot {
  productiveMs: number;
  /** Neutral time. The default tier; without this readout the timer showed 0 forever. */
  neutralMs: number;
  distractingMs: number;
  paused: boolean;
  /** tier the timer is currently attributing to */
  activeTier: StopwatchTier;
  /**
   * THE number every surface displays. Derived here, once, so the sidebar and
   * the dashboard hero are reading the same value from the same clock rather
   * than each reimplementing "which total applies right now".
   */
  displayMs: number;
  /** which total `displayMs` came from — used for labels/colour */
  displaySource: StopwatchSource;
  /** bumps only on a REAL reset, so the reset overlay cannot lie */
  resetCount: number;
  externalLabel: string;
  /**
   * Epoch ms of the last recorded user interaction.
   *
   * Published here because the Halo island's `afkGap` widget needs to know how long the user has
   * been away, and this IS that heartbeat — `getSystemIdleTime()` returns 0 on Linux, so the
   * store's own interaction tracking is the only real idle signal the app has. It was already
   * tracked on the internal `Store` interface; only the read path was missing, which left
   * `afkGap` registered in the slot model with no honest producer.
   *
   * Read-only. 0 means "no interaction recorded yet", which is UNKNOWN and not the same as idle.
   */
  lastInteractionAtMs: number;
}


**What this means for the design:** `paused` is a REAL user pause. An AFK freeze does
NOT set it, so the pill cannot use `paused` to detect "away". `lastInteractionAtMs` is
the only honest idle signal (`getSystemIdleTime()` returns 0 on Linux). `displaySource`
tells you which total `displayMs` came from.

---

## 7. PAYLOADS

### 7.1 Focus — `halo:get-focus` reads `FocusManager.getPublicState()`

Declared at `src/features/halo/FocusPageRow.tsx:70-82`:

```ts
export interface HaloFocusState {
  ok: boolean;
  active?: boolean;
  paused?: boolean;
  endsAt?: number | null;      // null = open-ended -> counts UP
  remainingSec?: number | null;
  startedAt?: number | null;
  strictness?: 'distracting' | 'non_allowed';
  allowedApps?: string[];
  allowedDomains?: string[];
  allowedTiers?: string[];
  error?: string;
}
```

### 7.2 Life / Schedule — `halo:get-life` (declared in `OverlayRoot.tsx:315-355`)

```ts
interface HaloLifeDeadline {
  id: string;
  title: string;
  dueAtMs: number | null;
  deltaMs: number | null;
  isOverdue: boolean | null;
  remindAtMs: number | null;   // legacy single column, fallback ONLY
  alarms?: Array<{
    mode: 'relative' | 'absolute';
    leadMin: number;
    atMs: number | null;       // null for relative: the moment is due-minus-lead
    fired: boolean;
  }>;
}

interface HaloLifeSchedule {
  id: string; title: string; location: string | null;
  dayOfWeek: number; startTime: string; endTime: string;
  category: string | null; startsAtMs: number; endsAtMs: number;
  isNow: boolean;              // started, not finished
}

interface HaloLifePayload {
  ok: boolean;
  now: number;                 // ONE clock for both queries
  schedule: HaloLifeSchedule | null;
  deadlines: HaloLifeDeadline[];
  error?: string;
}
```

### 7.3 Next deadline (pill) — `halo:get-next-deadline`

```ts
interface NextDeadlinePayload {
  title: string | null;
  deltaMs?: number | null;
  dueAtMs?: number | null;
  isOverdue?: boolean;
}
```

---

## 8. IPC WIRING (end to end, the real convention)

```
renderer  window.haloBridge.getLife()        (src/preload.ts ~2462)
   -> ipcRenderer.invoke('halo:get-life')
main      ipcMain.handle('halo:get-life')    (src/main.ts ~24582)
   -> sqlite reads: schedule_entries + deadlines + deadline_reminders
   -> returns HaloLifePayload
```

`halo:get-focus` is handled at `src/main.ts` ~24664 and calls
`focusManager.getPublicState()`. `focusManager` is declared `let` at `src/main.ts:5385`
and assigned at ~7088.

Types for both bridges: `src/types/deskflow-api.d.ts` (`HaloBridge`, ~377+).

---

## 9. DATABASE SCHEMA (actual `CREATE TABLE`, read from the live DB)

```sql
CREATE TABLE deadlines (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  course TEXT,
  due_date TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',          -- 'pending' = OPEN
  description TEXT,
  reminder_sent INTEGER DEFAULT 0,
  notified_at TEXT DEFAULT '{}',
  snoozed_until TEXT,
  recurrence TEXT,
  recurrence_end TEXT,
  category TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  remind_at TEXT,                          -- LEGACY single alarm, fallback only
  goal_id TEXT,
  habit_id TEXT,
  due_time TEXT
);

CREATE TABLE deadline_reminders (           -- the table the reminder UI writes
  id TEXT PRIMARY KEY,
  deadline_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'relative',   -- 'relative' | 'absolute'
  lead_min INTEGER NOT NULL DEFAULT 0,
  remind_at TEXT,                          -- absolute moment; NULL for relative
  fired INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE schedule_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,                -- 'HH:MM'
  end_time TEXT NOT NULL,
  category TEXT DEFAULT 'class',
  color TEXT DEFAULT '#22d3ee',
  is_recurring INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  goal_id TEXT, series_id TEXT,
  exceptions TEXT DEFAULT '[]',
  archived INTEGER DEFAULT 0,
  instructor TEXT, linked_phase_id TEXT,
  linked_goal_ids TEXT DEFAULT '[]',
  start_date TEXT, end_date TEXT
);
```

⚠ **Known backend bug (do NOT fix in this brief, design as if fixed):**
`add-deadline-reminder` stores `remind_at = NULL` for `mode='relative'`, but
`reminderTicker.fireDueDeadlineReminders` requires `remind_at IS NOT NULL`. Relative
reminders therefore never fire today.

⚠ **No per-deadline time tracking table exists.** If R17 needs persistence, it is a
backend gap that must be named.

---

## 10. THE SETTINGS CONTROL — `src/pages/SettingsPage.tsx` (lines 7378-7390)

```
      ['off',  'Off',        'No ring; the pill keeps its plain shadow'],
      ['edge', 'Edge glow',  'Green / red ring by tier'],
```

The ambient pref itself — `src/features/halo/HaloPreferences.ts:336-345`:

```
   * The user asked for exactly this ("ambience of like the red blue green depending on
   * the productivity") and chose the EDGE treatment over a background tint ...
   * DEFAULT IS `edge`, and that is a USER DECISION, not a design flourish.
   */
  ambient: 'off' | 'edge';
```

Default: `ambient: 'edge'` (`HaloPreferences.ts:441`).

---

## 11. LIVE DATA (measured from the real DB, 2026-10-20, not fixtures)

```
NEAREST BLOCK   ALGO PROG   Wed 21 Oct 09:20   (in 10.77 h)
                (today's finished Data & Statistics rolled to Tue 27 Oct)

OPEN DEADLINES  C Programming BNCC   due 21 Aug   OVERDUE 61.9 d
                alarm: 1 day before (relative)
                NAR                  due 19 Oct   OVERDUE 1 d
                no alarm

deadline_reminders: EMPTY       reminders: EMPTY
```

This is what the row actually renders today:

```
[cal] NEXT  ALGO PROG                    Wed 09:20 · in 10h
[dot] C Programming BNCC       21 Aug  [bell] 1d before   61d overdue
[dot] NAR                      19 Oct                     1d overdue
```

---

## 12. FILE MAP (what the design will touch)

| File | Role |
|---|---|
| `src/features/halo/OverlayRoot.tsx` | the island root: pages, ambient ring, Schedule markup, AFK suppression |
| `src/features/halo/FocusPageRow.tsx` | the Focus page row: stopwatch state + running-session state |
| `src/features/halo/halo.css` | every island token, every text role |
| `src/shared/halo/sizes.ts` | the three presets and their fixed dimensions |
| `src/shared/halo/slotModel.ts` | which activity owns the pill, and its priority |
| `src/features/halo/AmbientCard.tsx` | the legacy ambient card bodies (not the Figma layout) |
| `src/features/halo/HaloPreferences.ts` | `ambient`, page order, drag offsets |
| `src/lib/stopwatchStore.ts` | `displayMs`, tiers, `paused`, `lastInteractionAtMs` |
| `src/lib/afk.ts` | AFK threshold, hold, pause-vs-reset |
| `src/pages/SettingsPage.tsx` | the ambient radio group (one control only) |
| `design/design.md` | LAMINAR, the law |
