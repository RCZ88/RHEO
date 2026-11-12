# RESULT.md — RHEO LAYERS redesign

**Decision:** Replace only the LAYERS `Exploded` figure with a custom clickable SVG instrument. Keep VAULT, the VAULT | LAYERS tabs, and the existing sweep. The sweep opens the stack; clicks inspect it. Do not redesign VAULT or turn the layers into generic cards.

## L1 — Visual

Four vertically exploded, recognizable zinc objects: **01 RENDERER** = miniature app window (title bar, sidebar, content rows); **02 MAIN** = compact control/engine housing (central mechanism, radial ticks, two connections); **03 SQLITE FILES** = three separate folded documents labelled `DB`, `WAL`, `SHM`; **04 LOCAL DISK** = physical drive (housing, platter, spindle, folder/file mark). Add a separate `CONNECTIONS / 2 DESTINATIONS` control below the stack; it is not a fifth layer.

**LAMINAR tokens only:** page `#050506`, panel `#0a0a0c`, raised `#101014`, primary `#f4f4f5`, secondary `#a1a1aa`, tertiary `#8a8a94`, metadata `#63636b`, hairlines `rgba(255,255,255,0.08–0.16)`, active white `#ffffff`; JetBrains Mono labels 10–11px, Space Grotesk display/body, SVG stroke `0.9px`, radii **8/12/16px only**. No hue, gradients, glow, glass, decorative shadows, emoji, new library, bespoke palette, or raw component colors. Existing figure max-width `560px`; stage min-height `220px`, padding `8px`, border `1px rgba(255,255,255,0.12)`, radius `12px`, background `rgba(255,255,255,0.02)`. Four targets: width 100%, min-height `44px`, gap `6px`, horizontal padding `10px`; no overflow.

## L2 — Interaction and accessibility

Use native buttons in `role="group"`, not a nested tablist. Each layer and Connections button gets `aria-pressed`, `aria-controls="layer-detail-panel"`, an accurate accessible name, and `.instrument`. Enter/Space work natively. Decorative SVGs: `aria-hidden="true"`, `focusable="false"`. Remove `aria-hidden` from the stage. Detail panel: `aria-live="polite"`, `aria-atomic="true"`.

One selection at a time. Default: none selected, all objects visible, overview facts shown. Select an item: bring it forward, recede others, show its detail. Select another: switch directly. Select the active item again: clear selection and restore overview. Inactive items remain clickable. Selected object `translateX(4px) scale(1.015)`, full illustration opacity and stronger hairline; others `translateX(-2px) scale(0.985)`, illustration opacity `0.55`. Keep all labels readable; do not dim the whole button.

## L3 — Exact copy

**Renderer:** `The part of RHEO you see.` / `It draws RHEO's screens and the controls you use.` / `Inside the app window. Electron calls this the renderer process.`

**Main:** `The part that records your activity.` / `It records which app or website is in front and for how long, then writes that record to the database.` / `In RHEO's background process. Electron calls this the main process.`

**SQLite:** `The files that hold your activity record.` / `The record is stored in deskflow-data.db, with two helper files: deskflow-data.db-wal and deskflow-data.db-shm.` / `In RHEO's app-profile folder on your computer.`

**Disk:** `Your computer's own storage.` / `It keeps RHEO's database files as ordinary files on your computer.` / `On your computer's local storage. There is no RHEO server in this storage path.`

**Connections:** `The two addresses RHEO contacts online.` / `api.github.com is used for update checks. api.exchangerate-api.com is used for currency rates.` / `The full list of outbound requests and their purposes is at /docs/network.` Make `/docs/network` a real link.

**Overview facts (only when none selected):** `The window on your screen is the part of RHEO you see and use.` · `RHEO records which app or website is in front and for how long.` · `Your record is in deskflow-data.db, with deskflow-data.db-wal and deskflow-data.db-shm beside it.` · `Those files stay in RHEO's app folder on your computer. There is no server in this storage path.` · `RHEO connects to api.github.com for update checks and api.exchangerate-api.com for currency rates. See /docs/network for every request.`

Preserve existing trust facts: `The audit key is a file named deskflow-audit-key.bin.` and `No account. No cloud. No subscription. Close RHEO before copying its folder.` Never claim fully offline, all-data encryption, or that data can never leave the computer.

## L4 — Truth and provenance

Declare `data-motion="layers-stack"` in `MOTION_MANIFEST.ts`: tier `AFFORDANCE`; component `Download.tsx`; description `Four recognizable objects representing RHEO's local activity-record path.`; provenance `DIAGRAM, not a live system view. Represents renderer, main, SQLite files and local disk. Outbound destinations are documented at /docs/network.`; reduced motion `Static diagram. Selection remains functional without animation.` These are illustrations, not live processes, disk activity, or captures.

Only claim: renderer is the visible React UI in Electron's renderer process; main records foreground app/site and duration, then writes to DB over IPC; SQLite files are `deskflow-data.db`, `deskflow-data.db-wal`, `deskflow-data.db-shm`; storage is local filesystem; outbound hosts are only `api.github.com` (update check) and `api.exchangerate-api.com` (rates); audit key is `deskflow-audit-key.bin`; no account, cloud, or subscription. Anything else requires `[VERIFY]`.

## L5 — Sweep integration

Keep synthetic-pointer GAP4 and existing coordinate scaling. Opening: X `40→360`, Y `162`, `32` steps × `20ms` = `640ms`; map progress to object separation, rest `~0.18` → open `~1.0`. Objects become selectable after the sweep; never replay it on layer selection. Preserve VAULT→LAYERS `2,360ms` = dial `640` + open settle `320` + crossfade `520` + GAP4 `640` + settle `240`; LAYERS→VAULT `2,000ms` = collapse `480` + hold `240` + crossfade `520` + dial `640` + settle `120`. Clear selection when a mode transition begins; keep existing re-entry lock.

## L6 — Motion

One easing: `cubic-bezier(0.16,1,0.3,1)`. Select/recede `200ms`. Detail swap: outgoing opacity `1→0` over `120ms`; incoming opacity `0→1`, Y `4px→0` over `160ms`, delay `40ms` (one `200ms` window). Return to overview `200ms`. Transform/opacity only; no layout animation, spring, or bounce. Under OS reduced motion or MOTION OFF, all durations/delays `0ms`, state swaps synchronously, no transform/opacity transition; controls remain functional. Use existing `useShouldAnimate()`.

## L7 — Acceptance gates

**Static:** old abstract `LAYERS_FACTS` removed; four named glyphs + separate Connections + five overview facts + five detail states present; native buttons, `aria-pressed`, `aria-controls`, `aria-live`, `.instrument`; stage not `aria-hidden`; decorative SVG hidden; AFFORDANCE manifest entry; no forbidden colors, raw TSX colors, spring/bounce, old claims; correct radii/easing/reduced-motion.

**Runtime:** verify all five panels, active-click-to-overview, direct item switching, inactive clickability, keyboard, focus ring, screen-reader labels/state/details, GAP4 open/collapse, and exact mode timings. Test widths `320/375/430/768/1280px` for clipping, overflow, and 44px targets. Test OS reduced motion and MOTION OFF: instant state changes, functional controls.
