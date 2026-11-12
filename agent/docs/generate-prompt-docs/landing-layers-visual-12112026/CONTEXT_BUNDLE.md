# CONTEXT_BUNDLE — layers visual brief

## Current component (`landing/src/components/rheo/Download.tsx`, FigureInstrument)

- Tab pair VAULT | LAYERS (`role="tablist"`, mono 11px pills, active = white bg / dark text)
- Stage: `stageRef` div, border `1px rgba(255,255,255,0.12)`, radius 12, bg `rgba(255,255,255,0.02)`, hairline CSS vars:
  `--hairline-plate:#050506; --hairline-hi:#f4f4f5; --hairline-edge:#a1a1aa; --hairline-mid:#52525b; --hairline-lo:#27272a; --hairline-stroke:0.9`
- AnimatePresence crossfade between `<Vault label="Locked by default; the combination is yours" onRead={setReadout} />` and `<Exploded label="The four layers: renderer, main, SQLite file, your disk" onRead={setReadout} />` — exit 320ms always, enter 400ms @ delay 120
- `sweepTimed` narrative drives pointer: VAULT→LAYERS 2,360ms (lap 640 · settle 320 · crossfade 520 · GAP4 sweep 640 · settle 240); LAYERS→VAULT 2,000ms; re-entry lock on tabs + tour; prm → synchronous dispatch
- "run the tour" button + read line (`read {readout ?? defaultReadout}`) + facts block (motion.p stagger 60ms, mono 11px #63636b, maxWidth 400)

## The 5 fact lines being replaced (current text)

```
Layer 1: Renderer — React UI in Electron's renderer process.
Layer 2: Main — Electron main process, IPC handlers, tracking, DB access.
Layer 3: SQLite file — deskflow-data.db + -wal + -shm on your disk.
Layer 4: Disk — local filesystem. No server in the stack.
Every outbound call listed at /docs/network — only api.github.com and api.exchangerate-api.com.
```

## Auditable facts (everything the copy may claim)

- Renderer: React UI in Electron's renderer process — what the user sees.
- Main: Electron main process — records foreground activity (what app/site is in focus, how long), writes to the DB over IPC.
- SQLite: `deskflow-data.db` + `-wal` + `-shm` — the entire record, ordinary files in the app's profile folder.
- Disk: local filesystem. No server in the stack.
- Outbound network: ONLY `api.github.com` (update check) and `api.exchangerate-api.com` (currency rates); full per-call table at `/docs/network`.
- Audit key: `deskflow-audit-key.bin` — a file, not a keystore secret.
- No account. No cloud. No subscription. Close RHEO before copying the folder.
- VAULT metaphor: locked by default; the combination (the audit key) is yours.

## Design tokens in play

- Surfaces `#050506/#0a0a0c`, text `#f4f4f5/#a1a1aa/#8a8a94/#63636b`, hairlines `rgba(255,255,255,0.08–0.16)`
- Radii 8/12/16 (`--radius-xs/sm/md`, `--panel-radius: 12px`)
- Easing `[0.16,1,0.3,1]`; mono = JetBrains Mono; display = Space Grotesk
- Focus ring: global `.instrument:focus-visible { outline: 2px solid #f4f4f5; outline-offset: 3px }`
- prm handled per-component via `useShouldAnimate()`

## Sibling pattern for reference (ActUnderstand has a tablist figure too)

The layers figure should stay visually consistent with the ActUnderstand tablist pattern and the ActRecord instrument stack (chart panel radius 12, border `rgba(138,138,148,.16)`, mono axis labels 9px, playhead/readout pattern).
