# HALO_ISLAND_CURRENT_STATE.md — attach this alongside PROMPT.md

**Why this file exists:** the previous attempt's bundle was referenced by the bare filename
`CONTEXT_BUNDLE.md`. There are **197** files with that exact name in this repo, so the target AI
received an unrelated file and stated so in its own output: *"the matching file available in the
accessible file library was unrelated to Halo."* It then produced a plan against a codebase it
had never read.

This file has a unique name. **Paste it into the same message as `PROMPT.md`.**

Note: `PROMPT.md` is deliberately self-contained and works alone. This file adds the source
detail.

---

## 1. File map (the island subsystem)

| File | Lines | Role |
|---|---|---|
| `src/main/halo/haloIsland.ts` | ~1392 | Window lifecycle, geometry, click region, hover poll, all stacking |
| `src/shared/halo/geometry.ts` | 503 | `computeGeometry`, `computeSurfaceRect`, hot zones |
| `src/shared/halo/sizes.ts` | ~250 | S/M/L presets, `fitToCanvas` |
| `src/shared/halo/hoverMachine.ts` | 155 | Pure FSM — cursor sample → open/close intent |
| `src/shared/halo/types.ts` | — | `NowPayload`, `StopwatchPayload`, `DictationPayload`, `ActivityKind` |
| `src/features/halo/OverlayRoot.tsx` | ~1890 | Renderer root, 5 boards, producers, `showPill` |
| `src/features/halo/CompactPill.tsx` | ~349 | All 10 board-1 compact kinds |
| `src/features/halo/FocusPageRow.tsx` | — | Expanded Focus board |
| `src/features/halo/DictationActivity.tsx` | ~325 | Expanded Tools board + waveform |
| `src/features/halo/AmbientCard.tsx` | 455 | Activity cards, `DOMAIN_CLASS` hues |
| `src/features/halo/halo.css` | ~790 | Tokens, `--halo-scale`, reduced-motion |
| `src/halo.tsx` + `halo.html` | 75 / 83 | Separate renderer entry (separate Vite build) |
| `start-dev.sh:368` | — | Forces `--ozone-platform=x11` |

---

## 2. Governing spec

- `agent/docs/HALO_ISLAND.md` — 4,195 lines, 226 numbered sections
- `agent/docs/halo_cross_platform_agent_spec_compact(1).md` — **byte-identical** (md5 `135e2c74b283ceb7a835359b319debf2`)
- `agent/docs/halo/HALO_STATES.html` — 5 boards + tokens (the visual authority)
- `agent/docs/HALO_SETTINGS.html` — settings reference

### §8 — the separate window is mandated

```ts
const win = new BrowserWindow({
  width: canvasWidth, height: canvasHeight, x: initialX, y: initialY,
  frame: false, transparent: true, backgroundColor: "#00000000",
  resizable: false, movable: false, minimizable: false, maximizable: false,
  fullscreenable: false, hasShadow: false, skipTaskbar: true, show: false,
  focusable: false,
  webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true }
});
```

Other relevant sections: §13 click-through · §14 focus (never `win.focus()`) · §47 poll rates ·
§63 top-edge expansion · §72 *"Do not shrink the entire expanded dashboard into compact mode"* ·
§83 compact hit targets · §175 density principle · §181 no full-screen transparent canvas.

---

## 3. Board 1 — compact kinds (verbatim from `HALO_STATES.html:127-137`)

```js
stopwatch:     dot + <i>00:</i>42:18 + vd() + <span class="t2 n">Figma</span>
stopwatchSite: dot + <i>00:</i>42:18 + vd() + <span class="t2 n">github.com</span>
now:           <span class="t2">ic(win)</span> + <span class="n">Figma</span> + <span class="mut">18 min</span>
website:       <span class="t2">ic(globe)</span> + <span class="n">github.com</span> + <span class="mut">6 min</span>
private:       <span class="t2">ic(lock)</span> + <span class="n">Private window</span>
dictation:     <span style="color:var(--signal)">ic(mic)</span> + wave(0) + <span class="t2">Listening</span>
aiUsage:       <span class="t2">ic(bot)</span> + usage bar(--cbar) + <span class="val">62%</span>
hud:           <span class="t2">ic(term)</span> + <span class="n">penguin-console</span> + <span class="mut mono">3</span>
nextDeadline:  <span>ic(cal)</span> + <span class="t2">IT DIV Test</span> + <span class="n">34d overdue</span>
critical:      <span style="color:var(--signal)">ic(alert)</span> + <span class="t2">IT DIV Test</span> + <span class="n">34d overdue</span>
```

Relevant CSS literals:

```css
.pill .vd  { height: var(--f-body) }   /* divider is BODY-sized in the pill, not --vd */
.pill .n   { max-width: 140px }
.pill .time{ font-size: var(--f-body) }
.wave s    { width:2px }
```

Waveform generator (line 93) — **idle is a flat 3px**, live is `3 + round(14 * …)`, 24 bars:

```js
var a = q ? 3 : 3 + Math.round(14 * Math.abs(Math.sin(i*.7) * Math.cos(i*.3)));
```

## 4. Board 2 — Focus (verbatim from `HALO_STATES.html:105-106`)

```js
'<div class="blk"><div class="row"><span class="dot'+(o.stopped?' off':'')+'"></span>'
 +lab('Stopwatch')+'</div>'+clock('00')+'</div>'
 + vd()
 + blk('Tracking', trk, 160)
 + vd()
 + blk('Productive','<span class="val t2 f-track">3:12:40</span>')
 + '<span class="sp"></span>'
 + btn('reset','Reset') + btn(stopped?'play':'pause', stopped?'Start':'Pause', 1);
```

`.btn` is **44×44** (line 43). `.lab` is `letter-spacing:.08em; text-transform:uppercase`.

**The user is asking to merge the `Tracking` block into the `Stopwatch` block, which departs
from this spec.** The design must say so.

---

## 5. Current Focus layout as implemented

```
[ ● STOPWATCH        ] │div│ [ TRACKING  Figma ] │div│ [ PRODUCTIVE 3:12:40 ]  spacer  [reset 44] [pause 44]
        clock
```

Row budget at Medium: `padding 12 + max(rowHeight 56, hero 26) + gap 8 + rail 44 = 132` vs
window `134` → 2px slack. **There is almost no vertical room; a layout change must not add a row.**

---

## 6. Palette — current state after this session's fix

```css
/* dark */
--halo-surface: #09090b   --halo-raised: #18181b   --halo-tab: #27272a
--halo-border:  #2e2e33   --halo-text:   #fafafa   --halo-muted: #a1a1aa
--halo-dim:     #8b8b94   --halo-accent: #6fb38f   /* the only accent */
--halo-signal:  #d97706   /* warning only */

/* light (Warm Paper / LAMINAR §11) */
--halo-surface: #fcfbf8   --halo-text: #1c1917    --halo-accent: #0e7490
--halo-signal:  #a8500a   /* 4.6:1 on the light surface */
```

`--halo-signal` carries an overdue deadline. `--halo-accent` carries live/recording/active.

### Design rule in force

> On a data surface **colour means TIER, never identity.**

`AmbientCard.DOMAIN_CLASS` still maps kinds to `sky` / `sage` / `amber` / `accent`. Whether the
remaining identity hues should survive that rule is an open question for the design.

---

## 7. Window behaviour as implemented

```ts
// haloIsland.ts, collapsed branch of applyClickRegion
setClickThrough(win, true);                    // setIgnoreMouseEvents(true, {forward:true})
win.setShape([ { x, y, width, height } ]);      // was setShape([]) — BUG, see below
```

`setShape([])` is documented by Electron as **resetting the window to a rectangle**, not as an
empty input region. That made the entire 480×118 window clickable while the pill is 182×28 —
**11.1× too big** (medium 11.8×, large 11.5×). Fixed by shaping to
`computeSurfaceRect(canvas, compactSize, edge)`, shared with placement and the hot zone.

Stacking:

```ts
isLinux  → win.setAlwaysOnTop(true, 'screen-saver', 1)   // top of Electron's enum
reassertStacking() runs AFTER showInactive() and in reconcileHaloGeometry()
focusable: true   // deviates from §8's `false`; §14 honoured via never calling focus()
```

---

## 8. Existing probes — 255 assertions, all green

`halo-fit` (34) · `halo-board-coverage` (40) · `halo-core` (33) · `halo-slot` (63) ·
`halo-spec-fundamentals` (54) · `halo-renderer-placement` (11) · `halo-click-region-growth` (20)

These are source-level and numeric probes under `agent/probes/`, run with `npx tsx`. **Keep them
green.** New work ships as new probes in the same style.

---

## 9. What is explicitly REJECTED

A previous design round proposed **deleting the Halo `BrowserWindow`** and rendering the island
in-app. Do not propose it again:

- it removes cross-application presence, which is the entire purpose of the feature;
- it proposed a `360×220` panel, contradicting the measured 480×118 / 560×134 / 680×154;
- it invalidated 80 of the then-246 passing assertions.

If your design requires a separate compositor surface, that is acceptable. Removing the feature's
cross-application behaviour is not.