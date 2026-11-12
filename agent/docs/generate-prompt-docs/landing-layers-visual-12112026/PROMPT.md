# RHEO landing — LAYERS figure redesign: clickable per-layer visualization, plain-language (new brief, standalone)

You are the design/spec AI on the RHEO landing thread. You spec; an opencode agent implements; CZ builds and deploys. LAMINAR design law: monochrome zinc (no hue on data surfaces), radii 8/12/16 only, ONE easing `cubic-bezier(0.16,1,0.3,1)`, transform/opacity motion only, `prefers-reduced-motion` honored, JetBrains Mono for labels, Space Grotesk for display. Live site: https://rheooo.netlify.app.

CZ's brief, verbatim intent: **"a proper dedicated visual with the SAME STYLE as what is currently (if something is better, change it to that), but for each of the layers I should be able to click and see the visualization details of it. And the text shouldn't be abstract"** — the current layer copy is confusing for non-technical people. **Everything needs to be visualized properly.**

## What exists today (Download section, `landing/src/components/rheo/Download.tsx`)

A tabbed figure (`role="tablist"`, VAULT | LAYERS) driving `@lucasmarkes/hairline` figures through synthetic pointer events (this works — verified mechanism, geometry runtime-verification still pending):

- **VAULT tab** — hairline "Vault": a dial safe. Sweep the dial to 40° → bolts draw back → open. Metaphor: your data is locked, the combination is yours. CZ likes this. Keep it.
- **LAYERS tab** — hairline "Exploded": 4 layers separate on horizontal sweep (GAP4 rest ≈0.18 → open ≈1.0).
- Below the stage, a "read" line + 5 fact lines (the text CZ calls abstract):

```
Layer 1: Renderer — React UI in Electron's renderer process.
Layer 2: Main — Electron main process, IPC handlers, tracking, DB access.
Layer 3: SQLite file — deskflow-data.db + -wal + -shm on your disk.
Layer 4: Disk — local filesystem. No server in the stack.
Every outbound call listed at /docs/network — only api.github.com and api.exchangerate-api.com.
```

## The ask — spec a redesign of the LAYERS experience

**L1 — The visual.** A dedicated, authored layers visualization (hand-built SVG is fine; hairline is not mandatory for this side if a hand-built instrument is better — CZ explicitly allows replacing it if better). Same visual language as the vault (zinc plates, hairline strokes, 1px edges, small mono labels). The 4 layers must be **distinct, nameable objects** — not abstract rectangles. Suggest per-layer visual identities that read at a glance, e.g.: renderer = the app window/UI glyphs; main = the engine/heart with tick marks; SQLite = the file drawer/cabinet; disk = the physical storage platter/folder. You pick — but each layer needs a visual metaphor a non-technical person recognizes.

**L2 — Clickability.** Each layer is clickable (and keyboard-focusable, Enter/Space). Clicking a layer opens its **detail state**: the selected layer comes forward (e.g. slight scale/translate, brightness lift), the others recede (dim), and a detail panel shows that layer's explanation. One layer active at a time; active state persisted visually. Also clicking the already-active layer returns to overview.

**L3 — The detail panel, plain-language.** For each of the 4 layers + one "connections" panel, write the copy yourself. Rules: no jargon without an immediate plain-language gloss; short sentences; concrete nouns. Audience test: someone who has never opened a terminal understands it. Structure per panel: one headline line (what it is, in plain words), one "what it does for you" line, one "where it lives" line. Then the **plain-language rewrite of the 5 fact lines** (they stay as a separate facts row or fold into the panels — your call).

**L4 — Truth constraint.** Every sentence must map to an auditable fact: renderer = the part you see (React UI inside Electron's renderer process); main = the engine that records activity + writes to the DB (Electron main process, IPC); SQLite = the record itself, one file `deskflow-data.db` plus its two live companions `-wal`/`-shm` on disk; disk = local filesystem; outbound network = **only** `api.github.com` (update check) and `api.exchangerate-api.com` (rates), full table at `/docs/network`; audit key is a file (`deskflow-audit-key.bin`); no account, no cloud, no subscription. Do not invent new claims; if a layer needs a fact I haven't listed, mark it `[VERIFY]` and I'll check the codebase.

**L5 — Relationship to the VAULT tab.** Keep the tab pair (VAULT | LAYERS) and the existing sweep narrative. Spec how the new layers instrument integrates: does the click interaction replace the pointer sweep, coexist (sweep opens the stack, click inspects a layer), or resequence? Give exact interaction order and whether the GAP4 sweep stays as the "open" gesture.

**L6 — Motion.** Per LAMINAR: state changes on the single easing; give exact ms durations (40ms grid) for: layer select (coming forward), others receding, detail panel swap, return to overview. Reduced-motion: instant state swap. No springs/bounce.

**L7 — Acceptance gates.** Define the checklist I can verify statically (rg/markers) and the ones needing runtime. Include the accessibility bar: `role="tab"`/`aria-selected` or `role="button"` + `aria-pressed` (pick one, justify), focus ring (`.instrument` class exists), labels read correctly by a screen reader.

## Answer format

Exact values only — layout numbers, type sizes, colors from the existing token set, durations, copy strings ready to paste. Structure your reply as L1–L7 answers. No file edits; the agent implements. If a better interaction pattern than click-to-detail exists for this content (e.g. hover-preview + click-pin), you may propose it — one alternative max, clearly marked.
