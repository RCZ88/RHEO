# Collaboration Request: Halo Island — Settings screen (selection, drag-reorder, spot, size)

## Your Role

You are the **Specialist AI** — the designer and architect. I am the **Project Owner AI**: I
hold the codebase and supply context. I have **no design authority** over this, and CZ has
asked that you do the design rather than me settling it. You have **no codebase access**, so
every file you need is embedded below.

## The Idea (verbatim from CZ, the human)

> "settings to be able to select and adjust the size of everything that is included on the island"

> "it should have like UI that is draggable and like change the spot and like size adjust"

> "where's the request of how to do it smoothly and all the UI design like the speech too
> text. the current UI that we have, how does it fit on the fucking new island design?"

In short: a settings screen where CZ can **select** which widgets the island shows, **drag** to
rearrange them, **change the spot**, **adjust the size** — designed smoothly, with all the UI
design and all the text/copy specified, and reconciled against the UI that already exists.

---

# PART 1 — THE GOVERNING SPEC (embedded in full)

`HALO_HANDOFF.md` is authoritative: *"the rules, numbers and behavior that a picture cannot
show."* Figma is the visual truth. This is the whole file:

> # Halo: design handoff
>
> Give this file to your coding agent together with the Figma link. The Figma file is the
> visual truth. This file is the rules, numbers and behavior that a picture cannot show.
>
> Figma file: https://www.figma.com/design/2PQLHEUjBBvyajmbS4DdMr
> File key: `2PQLHEUjBBvyajmbS4DdMr`
>
> ## 1. What the Halo is
>
> A separate, always-on-top, transparent window pinned top-centre of the screen, outside the
> app navigation. It is one single instance, even when RHEO has several windows. It works
> while any other app has focus and it never steals keyboard focus.
>
> It has two forms:
> - **Compact:** a small pill, the default.
> - **Expanded:** a wide, short panel with 4 switchable pages.
>
> It must work in Electron on Windows, Linux and macOS.
>
> ## 2. Figma map (node ids)
>
> Open with `https://www.figma.com/design/2PQLHEUjBBvyajmbS4DdMr?node-id=<id with : replaced by ->`
>
> | What | Node id | Use it for |
> |---|---|---|
> | 1 / Sizes | 9:124 | Small, Medium, Large side by side |
> | 2 / Pages | 9:304 | The 4 pages at Medium |
> | 3 / Placement | 9:692 | macOS, Windows, Linux positions |
> | 4 / States | 9:693 | Tab and button states |
> | 5 / Electron notes | 9:782 | Window behavior |
> | 6 / Warm Paper | 9:790 | Light theme |
> | Compact component set (Dark) | 7:930 | Variants `size=S/M/L, kind=...` |
> | Expanded component set (Dark) | 7:931 | Variants `size=S/M/L, page=...` |
> | Compact set (Warm Paper) | 7:1206 | Medium only |
> | Expanded set (Warm Paper) | 7:1207 | Medium only |
>
> Boards named "Archive ..." are old versions. Ignore them.
>
> ## 3. Tokens
>
> Two collections with identical variable names. Dark is the default. Warm Paper is the light theme.
>
> | Token | Dark | Warm Paper |
> |---|---|---|
> | bg/base | #09090b | #f7f4ec |
> | bg/raised | #18181b | #fffdf8 |
> | bg/hover | #27272a | #efeadd |
> | border/hairline | #2e2e33 | #e0d9c8 |
> | text/primary | #fafafa | #1c1917 |
> | text/secondary | #a1a1aa | #57534e |
> | text/muted | #71717a | #8a847a |
> | signal | #6fb38f | #2f7d5b |
> | signal/on | #09090b | #fffdf8 |
>
> Rules:
> - One signal hue only (the green). No second accent color.
> - Radii: 12 (expanded panel), 8 (inner strips, tab highlights), pill (compact, buttons).
> - Fonts: Inter (UI) and JetBrains Mono (numbers and micro labels). No third family.
> - No blur, no glass. The shape is solid with a 1px hairline.
> - No raw hex or rgba in `.tsx`. Use the theme variables.
>
> Known problem: `text/muted` fails the 4.5:1 contrast rule on both themes (about 4.1:1 on
> Dark, about 3.7:1 on Warm Paper). Suggested fix: Dark #8b8b94, Warm Paper #6f695f. Apply
> before shipping.
>
> ## 4. Sizes (user setting)
>
> | | Small | Medium (default) | Large |
> |---|---|---|---|
> | Expanded width | 480 | 560 | 680 |
> | Expanded height (hug) | about 116 | about 132 | about 152 |
> | Padding | 8 | 12 | 16 |
> | Content row height | 48 | 56 | 64 |
> | Compact height | 28 | 32 | 40 |
> | Type scale | 85% | 100% | 120% |
> | Tabs | icon only | icon + label | icon + label |
>
> Type sizes at Medium: stopwatch time 26 mono medium, large value 20, body 12 to 14, micro
> label 11 mono uppercase with 8% letter spacing. Minimum font size is 11 at every size.
>
> Touch targets are 44x44 at every size. Tabs and round buttons never shrink below 44.
>
> ## 5. Pages (expanded form)
>
> A tab bar at the bottom (44px tall, `bg/raised`, radius 8) switches pages. The selected tab
> uses `bg/hover` and primary text with medium weight. Keyboard: Ctrl+Left and Ctrl+Right.
> Scroll also switches pages.
>
> 1. **Focus:** stopwatch (hours dimmed with `text/muted`, rest `text/primary`), label with
>    task name, "today" total, reset and pause buttons.
> 2. **Now:** current app name and time in it, AI usage percent with a 4px bar.
> 3. **Deadlines:** next deadline name, "N days overdue", open count, an arrow button that
>    navigates to the route.
> 4. **Tools:** dictation button with idle waveform, console button with session count.
>
> Each page is one row. No page may grow taller than the content row height.
>
> ## 6. Compact form
>
> One pill, one kind at a time: stopwatch, now, dictation, aiUsage, hud, nextDeadline. The
> hero is the stopwatch. Which kind shows is decided by the existing promotion logic, not by
> the user.
>
> Kinds with no data source (focus, critical) are not designed. Finance, browser, health,
> brain, covenant and learn widgets stay rejected.
>
> ## 7. Behavior (proposed defaults, change if your spec says otherwise)
>
> - Expand on hover, on click, or on Cmd/Ctrl+Shift+H.
> - Collapse when the pointer leaves, or on Esc.
> - It never takes keyboard focus. Use `focusable: false`.
> - Outside the shape, clicks pass through: `setIgnoreMouseEvents(true, { forward: true })`,
>   switched off while the pointer is over the shape.
> - The window is fixed at the Large expanded size and never resizes. The shape morphs inside
>   it. This avoids flicker on every OS.
>
> ## 8. Placement per OS
>
> - **macOS:** docked flush to the top edge and centered on the notch. Top corners square,
>   bottom corners 12.
> - **Windows:** floats 8px below the top edge. All corners rounded.
> - **Linux (GNOME):** floats below the top bar (top bar is 32px) so the clock stays visible.
>   Needs a compositor for transparency. If transparency fails, fall back to a solid rounded
>   window.
>
> ## 9. States
>
> For tabs and buttons: default, hover, pressed, selected (tabs only), focus-visible,
> disabled. See board 4 / States.
>
> - Focus-visible: 2px ring in `signal` (tabs) or `text/primary` (buttons).
> - Pressed: slight shrink, not a color change alone.
> - Disabled: `text/muted` color with a text hint. Never use `opacity` on text.
> - Never use color as the only state signal. Pair with weight, a ring or text.
>
> Data states still to design: empty, loading, error for every page (see section 12).
>
> ## 10. Motion
>
> - Expand and collapse: 200 ms, ease-out, transform and opacity only.
> - Page change: 150 ms fade with an 8 px slide.
> - No spring, no bounce, no infinite decorative loops.
> - Reduced motion: no movement, 0 ms, one global check (not per component).
>
> ## 11. Out of scope
>
> - The screens each tool opens already exist as app routes. The Halo only navigates to them.
> - No quick-note panel.
> - Do not redesign any page of the main app.
>
> ## 12. Open items (not done in Figma)
>
> - All values are placeholders: "3:12:40 today", "Halo redesign", "Figma, 18 min", "62%",
>   "penguin-console, 3 sessions". Replace with real fields.
> - Empty, loading and error states per page.
> - The `text/muted` contrast fix (section 3).
> - A prototype of the expand and page-change transitions.
> - A settings screen for size, page order and page visibility.

---

# PART 2 — THE STATES REFERENCE (the visual/behavior truth)

`agent/docs/HALO_STATES.html` is the companion states document. Its own header says *"Read the
CSS, not the picture."* It is a working HTML file where every number is the real value.

## 2.1 Tokens and the size table (verbatim CSS)

```css
[data-theme="dark"]{--base:#09090b;--raised:#18181b;--hover:#27272a;--hair:#2e2e33;
  --t1:#fafafa;--t2:#a1a1aa;--muted:#8b8b94;--signal:#6fb38f;--on:#09090b;--stage:#3b4252}
[data-theme="warm"]{--base:#f7f4ec;--raised:#fffdf8;--hover:#efeadd;--hair:#e0d9c8;
  --t1:#1c1917;--t2:#57534e;--muted:#6f695f;--signal:#2f7d5b;--on:#fffdf8;--stage:#c9c3b4}

[data-size="S"]{--w:480;--pad:8;--gap:8;--ct:48;--pg:14;--vd:36;--fl:11;--time:22;
  --f-track:14;--f-now:15;--f-dead:17;--f-stat:12;--f-body:11;--ic:12;--ch:28;--cp:12;
  --bar:61;--cbar:34;--tabtxt:0;--maxn:160}
[data-size="M"]{--w:560;--pad:12;--gap:8;--ct:56;--pg:16;--vd:44;--fl:11;--time:26;
  --f-track:16;--f-now:18;--f-dead:20;--f-stat:14;--f-body:12;--ic:14;--ch:32;--cp:14;
  --bar:72;--cbar:40;--tabtxt:12;--maxn:200}
[data-size="L"]{--w:680;--pad:16;--gap:12;--ct:64;--pg:19;--vd:52;--fl:12;--time:31;
  --f-track:19;--f-now:22;--f-dead:24;--f-stat:17;--f-body:14;--ic:17;--ch:40;--cp:17;
  --bar:86;--cbar:48;--tabtxt:14;--maxn:240}
```

**Note the gap:** `--gap` is 8 at S and M, **12 at L**. The expanded height is derived, not
stated: `pad*2 + contentRow + gap + tabs(44)` → 116 / 132 / 152.

## 2.2 Component CSS (verbatim) — this is the UI design language to match

```css
.halo{width:calc(var(--w)*1px);padding:calc(var(--pad)*1px);border:1px solid var(--hair);
  border-radius:12px;background:var(--base);display:flex;flex-direction:column;gap:calc(var(--gap)*1px)}
.content{height:calc(var(--ct)*1px);padding:0 4px;display:flex;align-items:center;gap:calc(var(--pg)*1px)}
.blk{display:flex;flex-direction:column;gap:2px;min-width:0}
.lab{font:400 calc(var(--fl)*1px)/1.2 "JetBrains Mono",monospace;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted);white-space:nowrap}
.vd{width:1px;height:calc(var(--vd)*1px);background:var(--hair);flex:none}
.sp{flex:1}
.time{font-family:"JetBrains Mono",monospace;font-weight:500;font-size:calc(var(--time)*1px);
  line-height:1.1;color:var(--t1);white-space:nowrap}
.time i{font-style:normal;color:var(--muted)}   /* hours dimmed */
.val{font-family:"JetBrains Mono",monospace;font-weight:500;color:var(--t1)}
.dot{width:6px;height:6px;border-radius:50%;background:var(--signal);flex:none}.dot.off{background:var(--muted)}
.btn{width:44px;height:44px;border-radius:999px;border:1px solid var(--hair);background:none;
  color:var(--t2);display:grid;place-items:center;cursor:pointer;flex:none}
.btn.fill{background:var(--signal);border-color:transparent;color:var(--on)}
.btn:hover{background:var(--raised)}.btn.fill:hover{outline:1px solid var(--t1)}
.btn:active{transform:scale(.96)}
.btn:focus-visible,.tab:focus-visible{outline:2px solid var(--signal);outline-offset:0}
.usage{height:4px;border-radius:999px;background:var(--hover);overflow:hidden;width:calc(var(--bar)*1px)}
.usage b{display:block;height:100%;background:var(--signal)}
.tabs{height:44px;display:flex;border-radius:8px;background:var(--raised)}
.tab{flex:1;height:44px;border:0;border-radius:8px;background:none;color:var(--muted);
  display:flex;align-items:center;justify-content:center;gap:6px;
  font:400 calc(var(--tabtxt)*1px) Inter,sans-serif;cursor:pointer}
.tab:hover{background:var(--hover);color:var(--t2)}
.tab[aria-selected="true"]{background:var(--hover);color:var(--t1);font-weight:500}
[data-size="S"] .tab span{display:none}          /* S hides tab labels entirely */
.pill{display:inline-flex;align-items:center;gap:8px;height:calc(var(--ch)*1px);
  padding:0 calc(var(--cp)*1px);border:1px solid var(--hair);border-radius:999px;
  background:var(--base);font-size:calc(var(--f-body)*1px);white-space:nowrap;color:var(--t1)}
.pill.crit{border-color:var(--signal)}
.wave{display:flex;align-items:center;gap:2px;height:20px}
.wave s{display:block;width:2px;border-radius:1px;background:var(--signal)}
.wave.q s{background:var(--muted)}
.sk{display:block;height:calc(var(--f-now)*1px);border-radius:4px;background:var(--hover)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
```

`.sk` has **no shimmer and no animation** — the caption at line 146 says "loading (no shimmer,
no spinner)".

## 2.3 Every designed state, with its exact copy

This is the state inventory, transcribed from the file's own render functions.

**Compact pill — all 10 kinds** (HTML lines 127-138, 141):

| kind | contents |
|---|---|
| `stopwatch` | dot + `00:`(dim)`42:18` + divider + "Figma" |
| `stopwatchSite` | same but the name is the site, e.g. "github.com" |
| `now` | window icon + "Figma" + muted "18 min" |
| `website` | globe icon + "github.com" + muted "6 min" |
| `private` | lock icon + "Private window" |
| `dictation` | mic icon in signal + waveform + "Listening" |
| `aiUsage` | bot icon + 4px bar + "62%" |
| `hud` | terminal icon + "penguin-console" + muted mono "3" |
| `nextDeadline` | calendar icon + "IT DIV Test" + "34d overdue" |
| `critical` | alert icon in signal + name + "34d overdue", and `.pill.crit` = signal border |

**Focus page** — running/tracking an app; running/tracking a website; running/private window
(no name shown); stopped (dot and tracked name turn muted, play button instead of pause).
Caption at line 144: *"The third block is labeled PRODUCTIVE because the number is productive
time only. Do not label it TODAY unless it sums all tiers."*

**Now page — 6 states** (line 145):
| state | content |
|---|---|
| `ok` | app + website + AI usage |
| `nob` | app, "Not in a browser" |
| `priv` | "Private window" |
| `idle` | "No active app" + "Not in a browser", both muted |
| `waiting` | "Reading the current app..." + skeleton 90px + AI usage |
| `failed` | "App read failed: access denied. Check permissions." + Retry button + AI usage |

**Deadlines — 4 states** (line 146):
| state | content |
|---|---|
| populated | name + "34 days overdue" + open count + arrow button |
| empty | "No open deadlines. Add one in Schedule." + arrow button |
| loading | 3 skeletons — 120px, 100px, 28px |
| error | "Deadlines could not load because the database is busy. Retry." + Retry button |

**Tools — 3 states** (line 147):
| state | content |
|---|---|
| idle | waveform bars flat at 3px |
| listening | 24 bars follow real mic level |
| denied | "Mic blocked. Allow access." + retry mic button |

---

# PART 3 — THE CURRENT IMPLEMENTATION

## 3.1 The preferences model — `src/features/halo/HaloPreferences.ts`

```ts
/**
 * Kinds the user may reorder. The hero (`stopwatch`) and the interrupt kinds are NOT
 * listed: the spec's central law is that the resident is never evicted and `critical`
 * occludes it regardless of priority, so letting a user reorder the hero would silently
 * break the one invariant the whole surface rests on.
 */
export const HALO_ORDERABLE = ['now', 'aiUsage', 'hud', 'nextDeadline', 'tierBreakdown', 'afkGap'] as const;

export const HALO_DEFAULT_ORDER: string[] = [...HALO_ORDERABLE];
export const HALO_PREFS_KEY = 'haloIsland';

export interface HaloWidgetPrefs {
  /** false = the user turned this widget off. Absent = visible (default-on). */
  visible?: boolean;
  /**
   * Whether this widget may appear in the COLLAPSED pill. A second, independent axis from
   * `visible`, answering "the compact pill is only 232px — what is worth that space?".
   * Default-on, so an absent key keeps today's behaviour.
   */
  compact?: boolean;
}

export const HALO_DEFAULTS: HaloPrefs = {
  enabled: true,
  scale: 1,                    // maps onto small/medium/large presets
  edge: 'top',                 // 'top' | 'left' | 'right'
  displayId: null,             // which monitor; null = primary
  widgets: {},                 // per-widget flags
  order: [...HALO_DEFAULT_ORDER],
  maxVisible: 3,               // how many at once
  shape: 'capsule',            // 'capsule' | 'notch' | 'square' | 'custom'
  radius: 12,
  trigger: { mode: 'hover', padX: 0, padY: 0, openDelayMs: 110, closeDelayMs: 280, leaveMarginPx: 24 },
  motion: { durationMs: 250, easing: 'expo', liveliness: 'full' },
  showPin: true,
  clickShield: 'surface',
  compactStyle: 'auto',        // 'auto' | 'always' | 'off'
  uiVersion: 'figma',
};
```

`normalizeHaloPrefs` already validates and persists these. Order is de-duped, unknown kinds
dropped, missing kinds appended, and a hidden widget's `compact` is dropped as contradictory:

```ts
const rawOrder = Array.isArray(r.order) ? (r.order as unknown[]) : [];
const seen = new Set<string>();
const order: string[] = [];
for (const k of rawOrder) {
  if (typeof k !== 'string') continue;
  if (!(HALO_ORDERABLE as readonly string[]).includes(k)) continue;
  if (seen.has(k)) continue;
  seen.add(k);
  order.push(k);
}
for (const k of HALO_DEFAULT_ORDER) if (!seen.has(k)) order.push(k);
```

## 3.2 The island already consumes these — `src/features/halo/OverlayRoot.tsx`

```tsx
/* User layout: which widgets are on, in what order, how many at once. `visibleOrder`
 * drops hidden kinds; the model's `maxVisible` then caps the roster.
 *
 * THE COMPACT AXIS. `hidden` is a DIFFERENT set depending on the phase, and that is the
 * whole point of the per-widget `compact` flag: a widget the user marked "not in the
 * pill" is excluded only while COLLAPSED, and comes back when the island opens. */
const hiddenKinds = useMemo(() => {
  const order = prefs.order ?? HALO_DEFAULT_ORDER;
  const roster = visibleOrder(prefs);
  if (expanded) {
    return new Set(order.filter((k) => !roster.includes(k)));
  }
  return new Set(
    order.filter((k) => !roster.includes(k) || prefs.widgets?.[k]?.compact === false),
  );
}, [prefs, expanded]);

/* THE COMPACT ROSTER — the widgets allowed to appear in the 232px pill, in the user's
 * order. Under `auto` it is omitted entirely and the old data-derived behaviour is
 * preserved exactly. */
const compactRoster = useMemo<readonly string[]>(() => {
  if (prefs.compactStyle !== 'always') return [];
  return (prefs.order ?? HALO_DEFAULT_ORDER).filter(
    (k) => isWidgetVisible(prefs, k) && prefs.widgets?.[k]?.compact !== false,
  );
}, [prefs]);

const composed = useMemo<ComposedIsland>(
  () =>
    composeIsland(activities, {
      now: Date.now(),
      pointerEngaged: expanded,
      phase: expanded ? 'expanded' : 'idle',
      order: visibleOrder(prefs) as never,
      hidden: hiddenKinds as never,
      maxVisible: prefs.maxVisible,
      compactRoster: prefs.compactStyle === 'always' ? (compactRoster as never) : undefined,
    }),
  [activities, expanded, prefs, hiddenKinds, compactRoster],
);
```

## 3.3 The current Settings > Halo block — `src/pages/SettingsPage.tsx` (lines ~6330-7000)

This is the UI that already exists. CZ is asking how it fits against the new island design,
and whether any of it should be removed or merged. Inventory, in source order:

| # | Control | Type | Writes | Notes |
|---|---|---|---|---|
| 1 | Show Halo Island | `SettingsSwitch` | `enabled` | hint: "Applies on next launch or immediately via ⌘⇧H." |
| 2 | Layout | radiogroup ×2 | `uiVersion` | "figma" (4 pages) / "legacy" (2 tabs). Dual-boot escape hatch. |
| 3 | Size | radiogroup ×3 | `scale` | Small/Medium/Large, shows `preset.expandedWidth`. Already exists. |
| 4 | Shape | 4 drawn swatches | `shape` | capsule / notch / square / custom, each DRAWING its shape. Plus a radius slider for `radius`. |
| 5 | Trigger | radiogroup + sliders | `trigger.*` | mode, padX, padY, open/close delays, leave margin |
| 6 | Screen edge | radiogroup ×3 | `edge` | top / left / right |
| 7 | Display | select/list | `displayId` | fed by `listDisplays()`; degrades to "main display only" |

Supporting primitives:

```ts
const saveHaloPrefs = (patch: Partial<HaloPrefs>) => {
  const next = normalizeHaloPrefs({ ...haloPrefsRef.current, ...patch });
  haloPrefsRef.current = next;
  setHaloPrefs(next);
  // THE WRITE MUST COMPLETE BEFORE THE PUSH — a real race, not a style choice.
  ...
};
```

```tsx
function SettingsSwitch({ checked, disabled, label, onChange }: {
  checked: boolean; disabled?: boolean; label: string; onChange: (checked: boolean) => void;
}) { /* a real <input type="checkbox" role="switch"> wearing `.sf-switch` */ }
```

**Not present today:** any widget selection, any reordering UI, and any per-widget sizing.

## 3.4 The current island, expanded form — `OverlayRoot.tsx` (lines ~1000-1340)

- **Focus tab** renders `FocusPageRow` — the Figma board-2 row transcribed node by node:
  live dot, `STOPWATCH   HALO REDESIGN` eyebrow, split clock with dimmed hours, divider,
  `PRODUCTIVE` block, spacer, 44px reset button (outline) and 44px pause button (solid signal
  fill, `#09090b` glyph).
- **Now tab** — app name + minutes, divider, AI usage with a 4px bar; "No usage data yet" when
  the producer has no denominator.
- **Deadlines tab** — next deadline, status, open count; "0 deadlines" when count is a real zero.
- **Tools tab** — `DictationIsland` plus a Console button with session count.
- Bottom tab rail via `HaloTabRail`, plus a pin button.

## 3.5 Libraries available (verified in package.json)

- `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/utilities` ^3.2.2
- `framer-motion` ^12.35.0, `motion` ^12.42.2

**Existing drag usage in this codebase**, if you want the house pattern:
`src/components/ai/canvas/CanvasGrid.tsx`, `src/components/ai/canvas/CanvasCard.tsx`,
`src/components/dashboard/CardLibrary.tsx`, `src/components/dashboard/WidgetCard.tsx`.

---

# PART 4 — WHAT I NEED FROM YOU

**Design the screen.** I am not giving you a list of questions to answer — there is none here.
Ask me for whatever context you need, then produce the design. Specifically CZ wants all four:

1. **Select** — which widgets the island shows.
2. **Drag** — reorder them (CZ rejected an up/down-button draft of mine on interaction grounds).
3. **Change the spot** — placement.
4. **Adjust the size** — sizing.

And he asked for it *smoothly*, with **all the UI design and all the text/copy** written out,
and with the **existing settings reconciled** against the new island design rather than
bolted beside it.

**If you judge part of CZ's request conflicts with `HALO_HANDOFF.md`** — for example if
freeform positioning, or a per-widget size override that would break the single `--halo-scale`
type ramp and the 11px minimum — **say so in your first response.** Do not design around it
silently. CZ would rather hear the conflict now.

**Expected output — RESULT.md:**

1. The settings screen design: section order, layout, every control, and all copy.
2. The exact pref patch written for each interaction.
3. State coverage: default, empty, disabled (island off), and any conflict states.
4. Accessibility: full keyboard operation for every control, **including drag-reorder**.
5. An explicit reconciliation of the 7 existing controls in §3.3 — keep, merge, or remove, and
   why.
6. Any conflict with the handoff, with your recommended resolution.

Begin whenever you are ready.

## Conversation Protocol

1. **You ask specific questions.** Format: `REQUEST: <exact file path or question>`
2. **I fetch and respond.** Format: `CONTEXT: <file path>` — actual source code, not a summary.
3. **You refine your understanding.** Ask follow-ups or propose a design.
4. **When ready, produce RESULT.md.**

**Rules:**
- Do NOT assume context you do not have. Ask for it by exact path.
- Do NOT design for a backend that does not exist. Flag it instead.
- Do NOT produce a monolithic answer. Iterate with me.
- If a file I reference does not exist, say so rather than inventing it.

## Context Gaps

We have not provided these. **If you need any of them, ask and we will fetch them:**

- `src/shared/halo/slotModel.ts` — `composeIsland` and `visibleOrder`, the full model.
- The `dnd-kit` usage inside `CanvasGrid.tsx` — the existing drag pattern.
- `src/pages/SettingsPage.tsx` lines 6330-7000 in full, not just the inventory.
- `OverlayRoot.tsx` lines 1000-1340 in full.
- `src/features/halo/halo.css` — the island's token block and interactive states.
- `src/pages/settings/constants.ts` — the existing shortcut map.
- Screenshots of the current Settings > Halo block.