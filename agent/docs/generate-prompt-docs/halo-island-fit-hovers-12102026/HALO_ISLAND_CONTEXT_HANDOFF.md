# HALO Island Context Handoff

**Purpose:** attach this uniquely named file beside a future prompt. Do not refer to a generic `CONTEXT_BUNDLE.md`: this repository reportedly contains 197 files with that basename, and a previous run used an unrelated bundle. Read the exact file attached to the prompt; never search by bare filename and silently select a match.

## Source boundary

The most recent self-contained prompt plus `HALO_ISLAND_CURRENT_STATE.md` is the authoritative source for this task. The repo itself was not mounted into the assistant environment, so any code not quoted in that prompt is not verified. Do not claim files were edited, builds were run, or source lines were inspected unless those actions actually happened.

## Verified project facts provided by the user

- App Tracker / RHEO uses Electron + React + TypeScript. Halo is a separate renderer entry (`src/halo.tsx`, `halo.html`) with an existing `BrowserWindow` host in `src/main/halo/haloIsland.ts`.
- Governing spec: `agent/docs/HALO_ISLAND.md`, 4,195 lines / 226 sections. Visual authority: `agent/docs/halo/HALO_STATES.html`, five boards. Settings reference: `agent/docs/HALO_SETTINGS.html`.
- A byte-identical spec copy is reported at `agent/docs/halo_cross_platform_agent_spec_compact(1).md`, md5 `135e2c74b283ceb7a835359b319debf2`.
- Environment: Fedora 44 KDE Plasma native Wayland; `XDG_SESSION_TYPE=wayland`, `XDG_CURRENT_DESKTOP=KDE`; the main Electron app is forced into XWayland with `--ozone-platform=x11` at `start-dev.sh:368`.
- `zwlr_layer_shell_v1` protocol v5 is available on this compositor. `kdotool` / `hyprctl` / `wlrctl` cursor detection has been tested 6/6.
- `setAlwaysOnTop` on the XWayland client is an advisory X11 stacking hint and loses to some native Wayland application windows. `setShape([])` resets an Electron window to a rectangle; it does not create an empty input region. `setShape` throws on macOS and all uses must remain guarded.
- Existing geometry is measured and must not be changed:

| Preset | Expanded canvas | Compact pill | fBody | typeScale |
|---|---:|---:|---:|---:|
| Small | 480×118 | 182×28 | 11 | 0.85 |
| Medium | 560×134 | 198×32 | 12 | 1.0 |
| Large | 680×154 | 227×40 | 14 | 1.2 |

- Existing work reported as implemented/probed: five Figma boards; all ten compact kinds in `CompactPill.tsx`; S/M/L presets and `fitToCanvas`; click-region fix in this session; Wayland cursor detection; stacking reassert; settings for size/shape/radius/margin/resident.
- Existing seven probes / 255 assertions (all reported green): `halo-fit` 34; `halo-board-coverage` 40; `halo-core` 33; `halo-slot` 63; `halo-spec-fundamentals` 54; `halo-renderer-placement` 11; `halo-click-region-growth` 20. New work must preserve them.

## Relevant file map supplied by user

| File | Responsibility |
|---|---|
| `src/main/halo/haloIsland.ts` | BrowserWindow lifecycle, geometry, click region, hover polling, stacking |
| `src/shared/halo/geometry.ts` | `computeGeometry`, `computeSurfaceRect`, hot zones |
| `src/shared/halo/sizes.ts` | S/M/L presets, `fitToCanvas` |
| `src/shared/halo/hoverMachine.ts` | pure FSM: cursor sample → open/close intent |
| `src/shared/halo/types.ts` | payloads and ActivityKind |
| `src/features/halo/OverlayRoot.tsx` | renderer root, boards, producers, `showPill` |
| `src/features/halo/CompactPill.tsx` | ten board-1 compact kinds |
| `src/features/halo/FocusPageRow.tsx` | expanded Focus board |
| `src/features/halo/DictationActivity.tsx` | expanded Tools board and waveform |
| `src/features/halo/AmbientCard.tsx` | ambient cards and `DOMAIN_CLASS` |
| `src/features/halo/halo.css` | design tokens, scaling, reduced motion |
| `start-dev.sh` | forces X11 backend at line 368 |

## Compact kinds from board 1

`stopwatch`, `stopwatchSite`, `now`, `website`, `private`, `dictation`, `aiUsage`, `hud`, `nextDeadline`, `critical`.

Board 1 shows stopwatch dot + elapsed time + divider + app/site name. Other kinds use icons and short labels/metrics. Current CSS history included `.pill .n { max-width: 140px }`, which overflowed the 182/198/227px pill. The supplied fix makes names flex-shrinkable (`flex:0 1 auto; min-width:0`) and bounds the row (`width/max-width:100%; min-width:0; overflow:hidden`). Required next step: verify every truncating child across all ten kinds and presets, not only stopwatch.

## Palette rules and supplied latest state

- Dark: surface `#09090b`, raised `#18181b`, tab `#27272a`, border `#2e2e33`, text `#fafafa`, muted `#a1a1aa`, dim `#8b8b94`, accent `#6fb38f`, signal `#d97706`.
- Light: surface `#fcfbf8`, text `#1c1917`, accent `#0e7490`, signal `#a8500a` (reported contrast 4.6:1).
- Accent means live/recording/active. Signal means warning/overdue/error.
- `DictationActivity` was changed from clay to `--halo-accent`/`--halo-dim`; `--halo-focus` removed; `AmbientCard.DOMAIN_CLASS` lost clay but still maps `sky` / `sage` / `amber` by kind.
- Binding design law: **on a data surface colour means TIER, never identity**. Audit/removal of activity-kind hue mapping is still required.
- LAMINAR: no spring/bounce, no decorative gradients/glow, one accent per surface, radii 8/12/pill only, Inter + JetBrains Mono, reduced motion honoured.

## Focus grouping request

Current layout has three separate groups: `[dot · STOPWATCH + clock] |divider| [TRACKING · Figma] |divider| [PRODUCTIVE · 3:12:40] … [reset][pause]`. User explicitly requests Figma/app name to be grouped with the stopwatch. Merge dot, STOPWATCH label, app/site name, elapsed timer into the left group; remove standalone Tracking block and its divider; keep one divider between left stopwatch group and Productive; retain two 44×44 controls at right. Do not add another row.

Supplied vertical budget: medium `12 + max(rowHeight 56, hero 26) + gap 8 + controls 44 + 12 = 132px`, in 134px with 2px slack. Small canvas is 118px, large 154px. Do not change dimensions.

## Cross-app overlay constraint

The user explicitly rejects rendering Halo only inside RHEO because it removes cross-app presence. A separate compositor surface is acceptable. Candidate directions previously considered:

- Regular Electron Wayland toplevel: does not itself provide the layer-shell overlay role; `setPosition()` / `screen.getCursorScreenPoint()` have Wayland restrictions; shortcut/screen-capture APIs differ.
- Native layer-shell helper: compositor exposes `zwlr_layer_shell_v1` v5 here. A GTK4 `gtk4-layer-shell` helper is a viable Linux KDE Wayland host; it is a separate native layer surface, not a second Electron BrowserWindow. It needs a real IPC bridge and packaged native runtime. It must set an empty input region in pass-through mode and only arm the actual visible island rectangle after pointer entry is intentional.
- Never intercept input on the transparent canvas. Be explicit about the product boundary: the island can only receive a click on its own visible controls; if even those clicks must pass through, the island has to be display-only or use another activation method.

Keep `stepHover()`, 120ms idle / 40ms expanded polling, and existing Wayland pointer tools. Do not invent reliable global cursor APIs for Electron Wayland.

## Required deliverable form

The result is Markdown with sections in order: **Diagnosis → Decision → Implementation → Migration → Regression tests → Spec deltas**. Include assumptions and falsifiers. Provide a real file download only after verifying that exact path exists in the active runtime. Do not claim repo changes or tests passed when only a specification was generated.
