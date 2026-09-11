# Learn Animation Engine — Implementation Specification

## Overview

This specification adds two first-class animated-asset block types to the Lyceum Learn OS: `animation` (browser-rendered, interactive Elucim DSL scenes) and `video_asset` (pre-rendered Manim MP4s with stored Python source). Both persist entirely inside the existing `doc_json` LDOC blob (no new tables), store binary assets on disk under `%APPDATA%/RHEO/lyceum/animations/<lessonId>/` (mirroring the existing illustration pattern at `%APPDATA%/RHEO/lyceum/illustrations/<lessonId>/`), and degrade gracefully when Elucim validation fails or Manim/Python is absent.

The pipeline stays unchanged in shape: `learn:buildPrompt` composes a system prompt that now advertises the two new block types and a tool-availability section (Manim present/absent) → external AI emits `.lmd` with `:::animation` / `:::video_asset` directives → `parseLessonMarkdown.ts` converts them into typed blocks → `importLdoc()` stores them → `BlockRenderer.tsx` dispatches to two new React components. A small scene-router (prompt-driven, with a code heuristic helper) decides Elucim vs Manim vs Three.js vs KaTeX. Three new IPC handlers (`learn:renderAnimation`, `learn:renderVideoAsset`, `learn:getAnimationPreview`) follow the existing `ipcMain.handle` pattern in `src/services/learn/index.ts`, and a new service `src/services/learn/services/animation.service.ts` owns Manim subprocess + Elucim validation, compiled per-file with the existing esbuild pattern (never `--bundle`).

---

## Phase 1: Types & Schema

**File:** `src/shared/learn/types.ts`

**Change 1 — Extend `BlockType` union (lines 24–27).** Append two members to the union:
```ts
| 'animation' | 'video_asset'
```
*Why:* The union is the single source of truth for the parser, validator, and `BlockRenderer` dispatch. *Dependencies:* none. *Verification:* `tsc --noEmit` passes; exhaustive switches over `BlockType` now flag the two new cases (expected — resolved in Phases 2/5).

**Change 2 — Add block interfaces (place adjacent to `IllustrationBlockType`, lines 564–574, following the `BaseBlock` extension pattern of `ImageBlock` at 125–133).**
```ts
interface AnimationBlock extends BaseBlock {
  type: 'animation';
  meta: {
    engine: 'elucim';
    dsl: Record<string, unknown> | null; // ElucimDocument JSON
    title?: string;
    concept?: string;
    preset?: string;          // e.g. 'createCalculusDerivativeScenePreset'
    generated: boolean;       // true when dsl present
    poster?: string;          // optional first-frame snapshot path (fallback)
    error?: string;
  };
}
interface VideoAssetBlock extends BaseBlock {
  type: 'video_asset';
  meta: {
    engine: 'manim';
    python_source: string;    // kept for re-render (mirrors illustration meta.prompt)
    scene_name?: string;      // Manim Scene class; default = first `class X(Scene)`
    quality?: 'low' | 'medium' | 'high';
    video_path?: string;      // %APPDATA%/RHEO/lyceum/animations/<lessonId>/<blockId>.mp4
    poster_path?: string;     // ffmpeg first-frame PNG
    generated: boolean;       // false until rendered
    render_status: 'pending' | 'rendering' | 'done' | 'error' | 'unavailable';
    error?: string;
    caption?: string;
  };
}
```
**Change 3 — Add both to the `LdocBlock` discriminated union** (wherever `ImageBlock | IllustrationBlockType | …` is composed in the same file).
*Why:* meta-in-`doc_json` satisfies the "no new tables" rule; on-disk paths in meta mirror `IllustrationBlockType.meta.image_path`. *Dependencies:* none. *Verification:* a hand-built LDOC JSON containing both blocks round-trips through `validateFull` once Phase 2 lands; types compile now.

---

## Phase 2: Parser Extensions

**File:** `src/services/learn/parseLessonMarkdown.ts` (857 lines)

**Change 1 — Register `:::animation` directive.** Locate the directive dispatch (search for the `:::chart` / `:::quiz` case handling). Add a case that reads the fenced JSON payload and emits:
```ts
{ type: 'animation', meta: { engine: 'elucim', dsl: parsed.dsl ?? parsed, title: parsed.title, concept: parsed.concept, preset: parsed.preset, generated: !!(parsed.dsl ?? parsed), render_status: undefined } }
```
Wrap `JSON.parse` in try/catch → on failure emit the block with `dsl: null, generated: false, error: 'animation payload failed to parse'` (never abort the whole lesson; mirrors the parser's lenient handling of malformed `:::chart` payloads).

**Change 2 — Register `:::video_asset` directive.** Grammar (follows the `:::annotated-code python` raw-code pattern):
```
:::video_asset
```python
<manim source>
```
scene: SlopeScene
quality: low
caption: The secant line approaches the tangent
:::
```
Extract the fenced python via the existing fenced-block extractor; parse optional `scene:`/`quality:`/`caption:` trailer lines; default `scene_name` by regex `/class\s+(\w+)\s*\(\s*Scene/`; emit `VideoAssetBlock` with `generated: false, render_status: 'pending'`.
*Why:* raw-code directives already exist (`annotated-code`), so no new fencing machinery. *Dependencies:* Phase 1 types. *Verification:* unit-parse a sample `.lmd` string containing both directives; assert block types, `meta.python_source` non-empty, and that a corrupted `:::animation` payload yields `generated:false` + `error` rather than throwing.

---

## Phase 3: Elucim Integration

**Step 1 — Install (allowed by constraints):** `npm install @elucim/core @elucim/dsl`.

**Step 2 — Validation helper.** In the new `src/services/learn/services/animation.service.ts` (Phase 4), export `validateElucimDsl(dsl): { ok: boolean; issues: string[] }` calling `lintMotion(dsl)` and `evaluateSceneForAgent(dsl)` from `@elucim/dsl` (both are pure and Node-safe). Used by `learn:renderAnimation` (Phase 6) and by the renderer component on mount.

**Step 3 — Scene Router.** Prompt-driven primary (Phase 7) + code heuristic `routeScene(description: string): 'elucim' | 'manim' | 'three' | 'katex'` in `animation.service.ts`: contains `3d|camera|surface|rotation|zoom through` → `manim`; `plot|slope|derivative|vector field|graph|2d|tangent` → `elucim`; `interactive|drag|rotate yourself` → `three` (existing Three.js path); `equation only|inline` → `katex` (existing `math` block). `learn:buildPrompt` (index.ts:370–551) calls this only to inject *availability* (see Phase 7), never to override the AI.

**Step 4 — Agent presets.** Where a lesson is generated programmatically (future tooling), prefer `createCalculusDerivativeScenePreset` et al. from `@elucim/dsl` to seed `meta.dsl`; store the preset name in `meta.preset`.
*Dependencies:* npm install before Phase 5 compiles. *Verification:* `node -e "require('@elucim/dsl')"` resolves; `lintMotion` returns issues for a deliberately broken DSL.

---

## Phase 4: Manim Integration

**New file:** `src/services/learn/services/animation.service.ts` (follow `imageGen.service.ts` structure and the per-file esbuild compile pattern).

- `manimAvailable(): Promise<{ ok: boolean; python?: string; ffmpeg?: boolean }>` — probe `python -m manim --version` then `manim --version` via `child_process.execFile`; probe `ffmpeg -version`; cache results in-module. Missing → `{ ok:false }` (graceful path).
- `renderVideoAsset({ lessonId, blockId, python_source, scene_name, quality })`:
  1. `dir = path.join(app.getPath('appData'), 'RHEO', 'lyceum', 'animations', lessonId)`; `fs.mkdirSync(recursive)`.
  2. Write `<blockId>.py`; resolve quality flag (`-ql|-qm|-qh`).
  3. Spawn `python -m manim render <q> --format mp4 --media_dir <dir>/media <blockId>.py <SceneName>` with 5-min timeout; capture stderr tail (last ~2KB) for `meta.error`.
  4. On success, copy the produced MP4 to `<dir>/<blockId>.mp4`; if ffmpeg present, generate `<blockId>.png` poster (`-vf select=eq(n\,0) -vframes 1`), else `poster_path` undefined.
  5. Return `{ ok, video_path, poster_path, status }`; on missing Python return `{ ok:false, status:'unavailable' }` — never throw.
- `getAnimationPreview({ lessonId, blockId })` → poster path if on disk, else `null`.
*Why:* subprocess + on-disk storage + path-in-meta exactly mirrors the illustration service contract. *Dependencies:* none at code level (Python optional at runtime). *Verification:* with Manim installed, render a 3-line scene → file exists; with Python renamed/absent, returns `status:'unavailable'` without exception.

---

## Phase 5: Block Components

**New file:** `src/components/learn/blocks/AnimationBlock.tsx`
Props: `BlockRendererProps` (37–52). On mount run `validateElucimDsl` via `window.deskflowAPI.learnRenderAnimation`. States: **loading** (skeleton while validating), **ready** (render the Elucim player component exported by `@elucim/core` — confirm exact export name in package docs; pass `document={block.meta.dsl}`), **error** (`meta.error` or lint failure → card with `TriangleAlert`, the `concept` text, error detail, and `poster` image if present), **empty** (`dsl:null` → "Animation not generated" + hint to regenerate lesson). Never let a bad DSL crash the node.

**New file:** `src/components/learn/blocks/VideoAssetBlock.tsx`
States: **pending** (`render_status:'pending'` → summary card + "Render animation" button calling `learnRenderVideoAsset`), **rendering** (spinner + "Rendering with Manim… may take a minute"), **done** (`<video controls poster={poster_path} src={video_path}>` + caption), **error/unavailable** (show `python_source` in a read-only `<pre>` styled like `annotated-code`, plus message "Manim not installed — pip install manim to render"). Local state mirrors `meta.render_status`; after render, persist updated meta by calling existing `learnUpdateLessonDoc`.
*Why:* 4-state coverage matches the app's UX contract and the illustration block's error semantics. *Dependencies:* Phases 1, 6 (IPC), 3/4 (engines). *Verification:* open a lesson whose `doc_json` contains each state; toggle Manim availability and confirm fallback.

**File:** `src/components/learn/blocks/BlockRenderer.tsx` — inside the dispatch switch (63–129) add:
```ts
case 'animation': return <AnimationBlock {...props} />;
case 'video_asset': return <VideoAssetBlock {...props} />;
```

---

## Phase 6: IPC Handlers

**File:** `src/services/learn/index.ts` (follow the `learn:generateLdoc` handler pattern shown in the bundle):
- `learn:renderAnimation` `{ dsl }` → `validateElucimDsl(dsl)` → `{ ok, issues }`.
- `learn:renderVideoAsset` `{ lessonId, nodeId, blockId }` → load `learn_lessons.doc_json`, locate block, call `renderVideoAsset`, write back updated `meta` into `doc_json` (single `UPDATE learn_lessons SET doc_json=?`), return `{ ok, video_path, poster_path, status, error? }`.
- `learn:getAnimationPreview` `{ lessonId, blockId }` → `getAnimationPreview`.

**File:** `src/preload.ts` (learn bridge region 1373–1516) — add `learnRenderAnimation`, `learnRenderVideoAsset`, `learnGetAnimationPreview` invoking the three channels.

**Compile (CRITICAL, per-file, never `--bundle`):**
```
npx esbuild "src/services/learn/index.ts" --outfile="dist-electron/services/learn/index.js" --format=cjs --platform=node --target=node22
npx esbuild "src/services/learn/services/animation.service.ts" --outfile="dist-electron/services/learn/services/animation.service.js" --format=cjs --platform=node --target=node22
```
*Dependencies:* Phase 4 service. *Verification:* devtools console — all three invokes resolve; with Manim absent, `learnRenderVideoAsset` returns `status:'unavailable'`.

---

## Phase 7: Prompt Updates

**File:** `src/services/learn/promptLibrary.ts` + the Format-layer prompt file (`author-guide.md` in the 8-layer assembly).
1. Add `animation` and `video_asset` to the available-block list with the exact `:::` grammars from Phase 2 and one worked example each (e.g., `:::animation` DSL for "derivative as limiting slope"; `:::video_asset` Manim scene `TangentLimitScene`).
2. Add routing guidance: inline equation → `math` (KaTeX); 2D plots/slopes/vector fields → `animation`; complex 3D/camera choreography → `video_asset`; learner-driven 3D exploration → existing Three.js block; and "prefer `animation` when interactivity helps mastery, `video_asset` only when 3D motion is the point."
3. **Availability injection:** in `learn:buildPrompt` (index.ts:370–551), await `manimAvailable()` and append a Guardrails-layer line: if unavailable, "Do NOT emit `video_asset` blocks; use `animation` or `math` instead." This keeps AI output renderable on this machine.
*Dependencies:* Phase 4 (`manimAvailable`). *Verification:* run `learnBuildPrompt` and inspect the composed system prompt contains both block entries and the correct availability line in both Manim-present and absent runs.

---

## Phase 8: Type Declarations

**File:** `src/types/deskflow-api.d.ts` — extend the learn API surface (region mirrored by preload 1373–1516):
```ts
learnRenderAnimation: (args: { dsl: Record<string, unknown> }) => Promise<{ ok: boolean; issues: string[] }>;
learnRenderVideoAsset: (args: { lessonId: string; nodeId: string; blockId: string }) =>
  Promise<{ ok: boolean; video_path?: string; poster_path?: string; status?: string; error?: string }>;
learnGetAnimationPreview: (args: { lessonId: string; blockId: string }) => Promise<{ ok: boolean; poster_path?: string | null }>;
```
*Verification:* renderer code using these compiles with strict TS.

---

## Implementation Order

1. Phase 1 (types) → 2. Phase 2 (parser) → 3. `npm install @elucim/core @elucim/dsl` → 4. Phase 4 (animation.service.ts) → 5. Phase 6 (IPC + preload) + Phase 8 (d.ts) → 6. Phase 5 (components + BlockRenderer dispatch) → 7. Phase 7 (prompts) → 8. esbuild compiles + full verification. Types→parser first so every downstream change type-checks; service before handlers; handlers before components.

## Verification Steps

- **P1:** `tsc --noEmit` green; hand-built LDOC with both blocks passes `validateFull`.
- **P2:** parser unit test: both directives parse; corrupted animation payload → `generated:false` + `error`, no throw.
- **P3:** `lintMotion` flags a broken DSL; router heuristic returns expected engines for 4 sample descriptions.
- **P4:** Manim present → MP4 + poster on disk; Manim absent → `status:'unavailable'`, no exception.
- **P5/6:** app run — lesson with `animation` (valid) renders player; (invalid DSL) shows error card; `video_asset` cycles pending → rendering → done; absent-Manim shows source fallback; all three IPC invokes logged OK.
- **P7:** composed prompt lists new blocks; availability line flips with Manim presence.
- **Regression:** existing `illustration`, `chart`, `annotated-code` lessons render unchanged; `rebuild-main.mjs` untouched; no new DB tables.