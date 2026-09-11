Got it — I over-indexed on *slide output*.  
Correct task: **design the system that generates / ingests / validates / previews / manages the slides**, not design the slide deck itself.

Below is the system design for the **DeskFlow Presentation Slide Generator** based on `PROMPT.md` + `CONTEXT_BUNDLE.md`.

---

# DeskFlow Presentation System

## 1. Product Goal

Build a system inside **DeskFlow** that lets a user:

1. Enter content / topic / mode / slide count / theme.
2. Generate a complete, copyable prompt for an external AI.
3. Paste back AI-generated HTML slides.
4. Parse and validate those slides against the design contract.
5. Preview them safely in sandboxed iframes.
6. Repair invalid slides through guided remediation.
7. Save / version / export the final deck.

The system is **not a slide editor**.  
It is a **prompt compiler + HTML ingestion pipeline + contract validator + sandbox renderer**.

---

# 2. Core Architectural Principle

## The slide is an artifact, not a React component

Each generated slide is a standalone HTML file:

- 1080×960
- self-contained
- iframe-safe
- vanilla HTML/CSS/JS
- no app-level React dependency

Therefore DeskFlow should treat each slide as an **untrusted artifact**.

The system must:

- generate the prompt,
- accept raw HTML back,
- normalize it,
- validate it,
- sandbox it,
- store it,
- preview it.

---

# 3. High-Level System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        DeskFlow App                         │
│                                                             │
│  ┌─────────────┐      ┌──────────────┐      ┌────────────┐  │
│  │ Deck Editor │─────▶│ Prompt       │─────▶│ Clipboard  │  │
│  └─────────────┘      │ Composer     │      └────────────┘  │
│         │             └──────────────┘                      │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ Generation  │                                            │
│  │ State Store │                                            │
│  └─────────────┘                                            │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐      ┌──────────────┐      ┌────────────┐  │
│  │ Paste /     │─────▶│ HTML Parser  │─────▶│ Validator  │  │
│  │ Import UI   │      └──────────────┘      └────────────┘  │
│  └─────────────┘                              │             │
│                                               ▼             │
│                                        ┌────────────┐       │
│                                        │ Slide Store│       │
│                                        └────────────┘       │
│                                               │             │
│         ┌─────────────────┬───────────────────┤             │
│         ▼                 ▼                   ▼             │
│  ┌────────────┐    ┌────────────┐      ┌─────────────┐      │
│  │ Sandbox    │    │ Repair     │      │ Export /    │      │
│  │ Preview    │    │ Assistant  │      │ Versioning  │      │
│  └────────────┘    └────────────┘      └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

# 4. Primary User Flow

## Flow A: Generate prompt

1. User creates a new presentation.
2. User enters:
   - topic / raw content
   - desired slide count
   - generation mode
   - theme
3. System builds a **slide plan**.
4. System compiles the final prompt.
5. User copies prompt to external AI.

## Flow B: Import result

1. User pastes AI output.
2. System extracts HTML slides.
3. System parses and validates each slide.
4. System shows:
   - valid slides
   - invalid slides
   - exact contract violations
5. User can:
   - preview valid slides
   - generate a repair prompt for invalid slides
   - re-import corrected output

## Flow C: Finalize

1. User approves deck.
2. DeskFlow stores:
   - prompt metadata
   - slide HTML artifacts
   - validation report
   - deck manifest
3. User exports:
   - `.zip` of standalone HTML slides
   - deck manifest JSON
   - optionally a single offline viewer HTML

---

# 5. System Subsystems

## 5.1 Deck Project Manager

Responsible for deck lifecycle.

### Responsibilities
- create deck
- duplicate deck
- rename deck
- store deck metadata
- track status
- version history

### Deck states
- `draft`
- `plan_ready`
- `prompt_ready`
- `awaiting_ai_output`
- `parsing`
- `validating`
- `invalid`
- `ready`
- `export_ready`

---

## 5.2 Prompt Composer

This is the “compiler” stage.

### Inputs
- raw content
- slide count
- generation mode
- selected theme
- optional user constraints

### Outputs
- fully assembled prompt string
- prompt hash
- prompt metadata

### Responsibilities
- normalize user content
- enforce slide count limits
- inject mode-specific structure
- inject theme tokens
- inject output contract
- inject anti-slop rules
- produce deterministic prompt text

### Important design decision
The Prompt Composer should not just inject a blob of text into `{{CONTENT}}`.

It should convert the content into a **structured slide plan** first.

Example internal structure:

```ts
interface PlannedSlide {
  index: number;
  frame: 'hook' | 'value' | 'transition' | 'call_to_action' | 'visual_only';
  purpose: string;
  headlineHint?: string;
  layoutHint?: 'split-left' | 'split-right' | 'full-bleed' | 'minimal';
  visualHint?: string;
  interactivityHint?: string;
}
```

This gives the external AI better structure and reduces sloppy output.

---

## 5.3 Mode Registry

Modes are not just labels.  
They should drive prompt structure and validation expectations.

### Suggested modes

#### `youtube_shorts`
- fast hook
- high-contrast claim
- 1 core visual
- quick payoff
- CTA ending

#### `educational`
- hook
- concept breakdown
- diagram / visual grounding
- example
- recap
- CTA

#### `pitch`
- problem
- solution
- market / proof
- product
- traction
- ask

#### `technical`
- definition
- architecture
- code / equation
- tradeoffs
- summary

### Mode schema

```ts
interface GenerationMode {
  id: string;
  label: string;
  description: string;
  defaultSlideCount: number;
  minSlides: number;
  maxSlides: number;
  frameSequence: SlideFrameType[];
  promptPreset: string;
  validationOverrides?: ValidatorOverrides;
}
```

---

## 5.4 Theme Registry

Themes should be data-driven, not hardcoded in the prompt only.

### Responsibilities
- store available themes
- expose CSS variables
- inject selected theme into prompt
- validate returned HTML against selected theme

### Theme schema

```ts
interface ThemeDefinition {
  id: string;
  label: string;
  tokens: {
    bg: string;
    surface: string;
    border: string;
    fg: string;
    muted: string;
    accent: string;
    accent2: string;
    warning: string;
    accentGlow: string;
    fontHeader: string;
    fontBody: string;
    fontMono: string;
  };
}
```

### Themes from context bundle
- `vercel-dark`
- `cyberpunk`
- `minimalist-mono`
- `warm-dark`

---

## 5.5 Clipboard Bridge

Simple but important.

### Responsibilities
- copy full prompt to clipboard
- show success / failure toast
- optionally store prompt copy timestamp
- allow re-copy

### Implementation note
In Electron, use the native clipboard API through the renderer or main bridge.  
Do not rely only on browser permissions if DeskFlow runs in a webview context.

---

## 5.6 HTML Ingestion Parser

This module accepts the pasted AI output.

### Inputs
- raw pasted text
- or uploaded `.txt` / `.html` file

### Responsibilities
- extract all HTML slides
- handle output wrapped in code fences
- handle output without code fences
- split multi-slide output correctly
- preserve order
- strip surrounding commentary if present

### Parsing strategy
1. Try extracting all ```` ```html ```` blocks.
2. If none found, split on `<!DOCTYPE html>`.
3. Trim each fragment.
4. Discard empty fragments.
5. Validate fragment count against expected slide count.

### Output

```ts
interface ParsedSlide {
  expectedIndex: number;
  html: string;
  hash: string;
  source: 'fence' | 'doctype-split';
}
```

---

## 5.7 Contract Validator

This is the most important system component.

The validator enforces the output contract from `PROMPT.md` and `CONTEXT_BUNDLE.md`.

## Validation layers

### Layer 1: Structural validation
Checks basic HTML completeness.

- starts with `<!DOCTYPE html>`
- has `<html>`
- has `<head>`
- has `<body>`
- has `<style>`
- has `<script>`
- includes Google Fonts imports for:
  - Inter
  - JetBrains Mono

### Layer 2: Layout contract
Checks required spatial rules.

- body fixed size:
  - `width: 1080px`
  - `height: 960px`
  - `overflow: hidden`
- no scrolling patterns detected
- uses grid/flex layout

### Layer 3: Theme contract
Checks required CSS variables.

Required variables:
- `--bg`
- `--surface`
- `--border`
- `--fg`
- `--muted`
- `--accent`
- `--accent-2`
- `--warning`
- `--font-header`
- `--font-body`
- `--font-mono`

Optional stronger check:
- compare variable values against selected theme

### Layer 4: Micro-interaction contract
Since the prompt says **all 7 micro-interactions must exist in every slide**, validator should check for evidence of each.

#### Required checks
1. **Blur-fade stagger entrance**
   - `@keyframes blurInUp`
   - `.stagger`
   - stagger delay classes or equivalent

2. **Mouse-following glow**
   - `.glow`
   - mousemove / mouseenter logic

3. **Number ticker**
   - `animateNumber`
   - `.ticker` or `data-target`

4. **Animated gradient text**
   - `.gradient-text`
   - `@keyframes gradShift`

5. **Custom slider**
   - `.slider-track`
   - `.slider-thumb`
   - no `input[type="range"]`

6. **Custom dropdown**
   - `.dropdown-trigger`
   - `.dropdown-menu`
   - no `<select>`

7. **Spring easing / micro transitions**
   - `cubic-bezier(0.16, 1, 0.3, 1)`
   - hover / active transitions

### Layer 5: Anti-slop checks
These can be heuristic.

- avoid native form controls where custom required
- detect overuse of generic pill + hero cliché patterns
- detect emoji used as UI icons
- detect repeated identical layout patterns across deck
- detect filler copy patterns if needed
- detect forbidden external dependencies

### Layer 6: Security / dependency checks
Allowed external domains should be allowlisted.

### Allowed by default
- `https://fonts.googleapis.com`
- `https://fonts.gstatic.com`

### Conditional allowance
- `https://cdn.jsdelivr.net/npm/katex@...`  
  only if math rendering is required

### Disallowed
- other CDNs
- remote scripts
- remote iframes
- analytics
- fetch to arbitrary endpoints
- parent-window access attempts

### Layer 7: Runtime smoke test
Static checks are not enough.

DeskFlow should run the slide in a hidden sandboxed frame and verify:
- no JS runtime errors
- body computed dimensions are correct
- expected classes exist in DOM
- no infinite animation / hang
- no blocked external requests causing failure

---

## 5.8 Validation Report

Every imported slide should produce a report.

```ts
interface ValidationReport {
  slideIndex: number;
  status: 'valid' | 'warning' | 'invalid';
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  runtimeErrors: string[];
  hash: string;
}
```

Example issues:
- missing `blurInUp` keyframes
- missing theme variables
- body height not 960px
- uses native `<select>`
- external script not allowed
- missing Google Fonts import

This report powers:
- UI error panel
- repair prompt generation
- import rejection / acceptance

---

## 5.9 Repair Assistant

When slides fail validation, the system should not just say “invalid”.

It should generate a targeted repair prompt.

### Repair prompt inputs
- original slide index
- failed rules
- missing selectors
- incorrect dimensions
- forbidden elements
- exact contract excerpt

### Repair prompt output example structure
```text
Slide 3 failed validation.
Fix only this slide and output a complete standalone HTML file.

Errors:
- Missing @keyframes blurInUp
- Missing .glow interaction script
- Body height is not 960px

Return only one corrected HTML file in a ```html fence.
```

This makes the external correction loop much more reliable.

---

## 5.10 Sandbox Renderer / Preview Engine

Since slide HTML contains arbitrary JS, it must be isolated.

### Rendering requirements
- render at exact 1080×960 coordinate space
- scale down responsively in app UI
- isolate from main app
- prevent navigation
- prevent access to DeskFlow state
- block unauthorized network access

### Recommended approach
Use sandboxed iframes with `srcdoc`.

```html
<iframe
  sandbox="allow-scripts"
  srcdoc="...">
</iframe>
```

Do **not** use:
- `allow-same-origin`
- `allow-top-navigation`
- `allow-forms`
- `allow-popups`

### Scaling model
The app renders a stage wrapper:

- actual slide container: `1080px × 960px`
- apply CSS transform scale to fit preview pane
- use `ResizeObserver` to maintain aspect ratio

Example:
```css
.slide-stage {
  width: 1080px;
  height: 960px;
  transform: scale(var(--zoom));
  transform-origin: top left;
}
```

---

# 6. Data Model

## 6.1 Deck

```ts
interface PresentationDeck {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  themeId: string;
  modeId: string;
  slideCount: number;
  rawContent: string;
  plan: SlidePlan;
  prompt?: GeneratedPrompt;
  importedSlides: ImportedSlide[];
  status: DeckStatus;
}
```

## 6.2 Slide plan

```ts
interface SlidePlan {
  goal: string;
  audience?: string;
  tone?: string;
  slides: PlannedSlide[];
}
```

## 6.3 Generated prompt

```ts
interface GeneratedPrompt {
  text: string;
  hash: string;
  createdAt: number;
  modeId: string;
  themeId: string;
  slideCount: number;
}
```

## 6.4 Imported slide

```ts
interface ImportedSlide {
  id: string;
  index: number;
  html: string;
  hash: string;
  status: 'pending' | 'valid' | 'warning' | 'invalid';
  validation: ValidationReport;
}
```

---

# 7. State Machine

A deck should move through explicit states.

```text
DRAFT
  → PLAN_READY
  → PROMPT_READY
  → AWAITING_EXTERNAL_OUTPUT
  → PARSING
  → VALIDATING
  → INVALID
  → REPAIR_PROMPT_READY
  → VALID
  → READY_TO_EXPORT
```

This prevents the UI from pretending a deck is usable before validation passes.

---

# 8. UI Design

## 8.1 Main workspace layout

Use a 3-panel layout:

### Left panel
- deck list
- slide thumbnails
- deck status

### Center panel
- sandbox preview stage
- slide navigation
- zoom controls

### Right panel
- generation settings
- prompt copy panel
- import panel
- validation inspector

---

## 8.2 Generate tab

### Fields
- content textarea
- mode selector
- theme selector
- slide count stepper
- optional constraints input

### Actions
- “Build Prompt”
- “Copy Prompt”

### Shown metadata
- expected slide count
- selected mode
- selected theme
- prompt hash / timestamp

---

## 8.3 Import tab

### Fields
- large paste area
- file dropzone

### Actions
- “Parse Slides”
- “Validate”

### Result UI
- list of detected slides
- status badge for each
- expandable error list
- “Generate Repair Prompt”

---

## 8.4 Preview tab

### Features
- selected slide preview
- previous / next navigation
- thumbnail strip
- validation badge overlay
- toggle:
  - fit to screen
  - actual size

---

## 8.5 Inspector panel

Shows:
- slide index
- validation errors
- warnings
- runtime console errors
- hash
- repair action

---

# 9. Suggested File Structure

Since DeskFlow is Electron + React + TypeScript + Vite + Tailwind v4, a feature-based structure makes sense:

```text
src/
  features/
    presentation/
      components/
        DeckList.tsx
        DeckEditorPanel.tsx
        GeneratePromptPanel.tsx
        ImportPanel.tsx
        PreviewStage.tsx
        SlideThumbnailStrip.tsx
        ValidationInspector.tsx
        RepairPanel.tsx
        ExportPanel.tsx
      state/
        presentationStore.ts
      services/
        promptComposer.ts
        modeRegistry.ts
        themeRegistry.ts
        clipboardService.ts
        htmlParser.ts
        slideValidator.ts
        runtimeValidator.ts
        repairPromptBuilder.ts
        deckStorage.ts
        exportService.ts
      types.ts
      constants.ts
```

---

# 10. Prompt Composer Design Details

The prompt composer should be deterministic and modular.

## Composition order

1. Base role prompt
2. Content section
3. Slide count
4. Generation mode
5. Theme variables
6. Mandatory design system
7. Micro-interaction requirements
8. Visual grounding rules
9. Layout rules
10. Equation / code rules
11. Anti-slop checklist
12. Output contract

## Important
The final prompt should include:

- exact theme values
- exact slide count
- exact slide frame plan
- explicit “output only HTML”
- explicit “one complete HTML file per slide”
- explicit “no explanations”

This reduces hallucination and formatting failures.

---

# 11. Parser Design Details

## Expected AI output formats

### Best case
```html
<!DOCTYPE html>
...
```

```html
<!DOCTYPE html>
...
```

### Messy case
Some explanatory text before or after code fences.

### Worst case
No fences, multiple `<!DOCTYPE html>` documents concatenated.

## Parser rules
- prefer fenced extraction
- fallback to doctype splitting
- preserve original order
- reject if zero slides detected
- warn if count mismatches expected count
- warn if duplicate hashes detected

---

# 12. Validator Design Details

The validator should be split into **static** and **runtime** checks.

## Static validator
Fast, synchronous, source-level checks.

Good for:
- missing tags
- missing CSS selectors
- forbidden elements
- missing font imports

## Runtime validator
Runs in hidden sandbox.

Good for:
- actual computed layout size
- script errors
- broken animation setup
- blocked external requests

## Severity model
- `error`: violates mandatory contract
- `warning`: suspicious or non-ideal, but not blocking
- `info`: advisory only

---

# 13. Security Model

This is critical because the app executes pasted HTML/JS.

## Mandatory isolation
- sandboxed iframe
- no same-origin access
- no navigation
- no forms
- no popups
- no top-level navigation

## CSP policy
A restrictive CSP should be applied to slide execution.

### Suggested CSP baseline
```text
default-src 'none';
script-src 'unsafe-inline' https://cdn.jsdelivr.net;
style-src 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com;
img-src data: blob:;
connect-src 'none';
frame-src 'none';
base-uri 'none';
form-action 'none';
```

## Electron-specific protections
- block `will-navigate`
- block `window.open`
- use separate session/partition for slide previews
- enforce resource timeouts
- optionally throttle CPU/network in preview partition

---

# 14. Storage & Export Model

## Storage
For each deck, store:

```text
/decks/{deckId}/deck.json
/decks/{deckId}/prompt.txt
/decks/{deckId}/slides/slide-01.html
/decks/{deckId}/slides/slide-02.html
...
/decks/{deckId}/validation/report.json
```

## Export options
1. **ZIP export**
   - all slide HTML files
   - manifest.json

2. **Single-file deck export**
   - optional local viewer HTML with navigation

3. **Prompt bundle export**
   - prompt text
   - plan JSON
   - validation report

---

# 15. Recommended Implementation Phases

## Phase 1 — Core data + prompt generation
Build:
- deck model
- mode registry
- theme registry
- prompt composer
- clipboard copy

## Phase 2 — Import pipeline
Build:
- paste input
- fence extraction
- doctype splitting
- slide ordering

## Phase 3 — Static validator
Build:
- contract checks
- error reporting
- repair prompt generation

## Phase 4 — Sandbox preview
Build:
- iframe renderer
- scaling stage
- thumbnail list
- runtime error capture

## Phase 5 — Persistence/export
Build:
- deck storage
- versioning
- zip export
- validation report export

---

# 16. Major Design Risks

## Risk 1: “All 7 interactions in every slide” creates bloat
The current prompt demands all micro-interactions on every slide.  
That can force unnecessary UI into slides.

### Recommendation
Keep strict mode for now if required, but introduce mode-based interaction budgets:
- hook slide: entrance + gradient text only
- value slide: glow + slider or dropdown if relevant
- visual slide: diagram interactivity only

This would reduce slop and improve quality.

---

## Risk 2: External AI output is unstable
The system must assume failure.

### Mitigation
- robust parser
- strong validation
- repair prompt loop
- clear error messages

---

## Risk 3: Security exposure from arbitrary HTML/JS
### Mitigation
- sandbox only
- strict CSP
- no same-origin
- network restrictions

---

## Risk 4: Validation false positives
Some generated slides may satisfy intent but use slightly different class names.

### Mitigation
Use:
- strict mode for contract enforcement
- warning mode for heuristic checks
- optional “accept with warnings”

---

# 17. Best System Decision: Treat This as a Compiler Pipeline

The strongest design is:

```text
User Intent
  → Structured Plan
  → Compiled Prompt
  → External AI Output
  → Parsed Artifacts
  → Validated Artifacts
  → Sandboxed Preview
  → Stored / Exported Deck
```

That makes the system resilient, testable, and not dependent on perfect AI output.

---

# 18. What I Would Build First

If implementing this in DeskFlow, I’d build in this order:

1. **Presentation types + store**
2. **Theme registry + mode registry**
3. **Prompt composer**
4. **Paste/import parser**
5. **Static validator**
6. **Sandbox preview**
7. **Repair prompt generator**
8. **Export**

---

If you want, next I can do one of these:

1. **Turn this into a formal engineering spec** with TypeScript interfaces and module contracts.  
2. **Design the validator rule engine in detail**.  
3. **Produce a file-by-file implementation plan for DeskFlow**.