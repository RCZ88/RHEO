# Penguin Console — RHEO Design Integration and Feature Verification Plan

## Status and purpose

This is a corrected export of the implementation plan discussed in chat, for another agent to implement. It is not an implementation report or proof that any feature works.

- Target: **Penguin Console**, route `/penguin-console`, code under `src/terminal/`.
- The user means Penguin Console when saying “terminal” in this task.
- Goal: make this console fit the existing RHEO app, not invent a separate visual identity.
- Also verify its command execution, command-usage tracking, command notes, and external-AI prompt → parsed result → saved notes workflow.
- The design integration has NOT been completed or visually verified.
- AI prompt generation and parsed-result persistence have NOT been verified.
- Earlier edits predominantly targeted the unrelated Terminal Workspace handbook. Do not treat them as Penguin Console implementation.
- KokonutUI and Bklit registry discovery was verified through shadcn MCP. No evidence establishes that their components were installed for this console.
- The full eight-skill review was NOT completed in the preceding session. Earlier claims and checklist completions saying otherwise were incorrect.

## 1. Scope boundaries

### In scope

1. App-aligned console chrome: page header, toolbar, tab strip, sidebars, inspector, dialogs, status bar and focus states.
2. Clear, labelled access to command notes and AI assistance from Penguin Console itself.
3. Trace and test the actual console execution and data-persistence paths.
4. Preserve existing useful terminal features and saved preferences.
5. Repair confirmed feature gaps after documenting their cause and obtaining any required permissions.

### Not automatically in scope

- `src/pages/TerminalPage.tsx`, `src/components/TerminalWindow.tsx`, or `src/components/learn/HandbookWorkspace.tsx`: these belong to a different surface. Touch shared code only if a verified Penguin Console dependency requires it.
- Wholesale source restoration, database cleanup, replacing the app's navigation, or installing all animation libraries.
- A new marketing-style design, decorative animation, or a new terminal backend without a separately justified scope.
- Reverting earlier wrong-surface edits without review and explicit permission.

## 2. Governing documents and prerequisites

Read current files rather than assuming the chat's line numbers or implementation details are still accurate:

1. `AGENTS.md`, current state and coordination protocol.
2. `design/design.md`: authoritative LAMINAR design contract.
3. `src/index.css`: authoritative application tokens; verify the live route-to-accent mapping.
4. `agent/skills/skill-router/SKILL.md`.
5. All eight mandatory design skills, in the router's required order:
   - frontend-external-infra
   - frontend-design
   - Human-Centric UX
   - Impeccable
   - Motion — Bring the UI Alive
   - Design Taste System
   - UI UX Pro Max
   - Taste Skill
6. `agent/docs/stack-setup.md` and `agent/docs/stack-usage-guide.md`, including their current-contract sections overriding legacy examples.
7. Load external-AI bridge and security skills when tracing or changing prompt import, IPC, execution or storage.

LAMINAR wins over conflicting registry styling and older skill examples. Loading skills is not a substitute for reading actual component source. Record which skills and sources were actually consulted; do not claim unused tools.

Before edits, follow physical-backup, file-claim and multi-agent coordination rules. Never build while the app runs. A silent coordination CLI exit is not proof of a claim; verify the registry state or use its exported API correctly.

## 3. Design intent

### Idea

A native RHEO console: quiet structural chrome, legible terminal content, and clearly discoverable learning tools.

### Meaning

- Neutral chrome keeps commands and output dominant rather than surrounding them with competing colors.
- One workspace signal hue identifies selection, focus and primary actions consistently with the parent app.
- Visible text labels make command notes and AI tools discoverable without guessing at icons or knowing another workspace exists.
- Terminal palettes, if retained, must not repaint the surrounding app chrome.

### Fit

Use the app's existing density, typography, spacing and state treatments. Do not replace every small control's padding with card padding or mechanically turn every 8px radius into 12px.

### Skills and motion decision

The implementer must provide the required four design-intent answers after actually loading all eight skills. Proposed motion level: L1, restrained functional feedback. No decorative ambient loops, spring/bounce, or artificial loading indicators.

## 4. Baseline audit before implementation

Inspect the route mount and import chain to confirm the screen being changed is `/penguin-console`.

Known relevant files from the previous read-through:

| File | Inspect for |
|---|---|
| `src/terminal/App.tsx` | Theme variables, page layout, toolbar, panel visibility, modal wiring |
| `src/terminal/index.css` | Global selectors, font imports, focus rings, glow, animation and scrollbar styles |
| `src/terminal/App.css` | Whether it is actually imported and which rules remain active |
| `src/terminal/components/TitleBar.tsx` | Main actions and discoverability |
| `src/terminal/components/Chrome.tsx` | Tab strip, left sidebar, bottom bar |
| `src/terminal/components/Panels.tsx` | Inspector navigation, command tools, appearance settings |
| `src/terminal/components/Modals.tsx` | Palette, workspace/preset/command dialogs and feedback |
| `src/terminal/components/Terminal.tsx` | Pane rendering, prompt, output, input and focus |
| `src/terminal/hooks/useConsoleStore.ts` | Execution dispatch, history, persistence, panel state |
| `src/terminal/lib/electron.ts` | Real backend availability, bridge methods and fallback behavior |
| `src/terminal/lib/shell.ts` | Simulation behavior and command semantics |
| `src/terminal/lib/data.ts` | Themes, defaults and sample data |
| `src/terminal/lib/types.ts` | State and result contracts |

Produce a feature matrix: entry point → handler → backend or simulator → result → persistence → rendered readback. Mark each as existing, incomplete, missing or unverified. Do not use the unrelated `learn:runCode` handler as proof that Penguin Console executes real commands.

## 5. Component sourcing and stack rules

### Available routing

- General UI: search `@kokonutui` through the existing shadcn MCP, then `@shadcn` core.
- New charts/data visualization: search `@bklit`. Do not add a chart where a simple usage list communicates enough.
- React Bits/Magic UI: only when a relevant, permitted interaction requires them.
- Icons: existing `lucide-react`.
- Reuse installed primitives and `cn()`; do not reinitialize shadcn or overwrite shared utilities.

The preceding session successfully listed KokonutUI components including `action-search-bar`, `ai-prompt`, and `command-button`, and Bklit components including `bar-chart` and `line-chart`. These are candidates, not approved selections: their full source and dependencies have not been reviewed for this plan. Strip decorative shimmer, gradients or spring behavior if present; reject a candidate if adaptation is disproportionate.

Search, read source and examples, review dependencies, then select. Registry configuration is not component installation. Do not add duplicate MCP servers.

### Animation libraries

Motion and Framer Motion are declared dependencies. Use `motion/react` for new Motion React code; preserve established imports when editing existing components. One engine per element/interaction.

GSAP and Anime.js were not declared dependencies at the previous inspection. Recheck before use. No requirement in this integration currently justifies adding either. If a future requirement does, consult current official API documentation and obtain installation approval.

## 6. Design integration work packages

### A. Separate app chrome from terminal appearance

- Define scoped chrome aliases resolving to existing `src/index.css` tokens, not new hardcoded hex values in TSX.
- Use the application's background, card, border, foreground, muted foreground and workspace accent tokens.
- Verify `/penguin-console` resolves to the intended page accent; do not assume `/terminal` routing covers it.
- Keep theme variables separate and scoped to terminal content. A theme switch must not recolor navigation, dialogs or inspector chrome.
- Audit selectable themes against LAMINAR. Preserve stored preferences; document any pane-only palette exception explicitly. Do not silently remove themes or claim an unapproved exception is compliant.
- Scope console CSS to its root. Inspect global `body`, `:root`, `select option`, scrollbar and font rules to prevent leakage into other RHEO pages. Do not add another Tailwind compilation/import layer without checking the existing build.

### B. Unify structural components

- Flat zinc surfaces and consistent hairlines; one workspace signal hue on chrome.
- Inter for interface text; JetBrains Mono for commands, paths and appropriate numerics. Maximum two families in the view.
- 8px control radius, 12px card/dialog radius, pill only where justified.
- Preserve density with sensible control-specific spacing and usable hit areas. Card padding is not a universal button-padding rule.
- Active tabs, focused panes and disabled actions must be distinguishable without relying on color alone.
- Remove decorative root gradients, colored glow and chrome blur. Replace visual hierarchy with spacing, text weight and borders.
- Do not leave a glow preference visible but inert. Decide how to migrate or explain unsupported appearance settings without losing unrelated preferences.
- Keep Lucide icons consistent and provide accessible names for any icon-only secondary actions.

### C. Clear navigation to learning features

Proposed console-level navigation, to adapt to existing app patterns:

- **Console**: sessions, panes and execution.
- **Command Notes**: searchable command reference, what each command does, parameters, examples, gotchas and saved explanations.
- **Usage**: only if a dedicated view is justified; otherwise a clearly labelled section within the existing inspector.

Place a visible **Command Notes** entry in Penguin Console's header/navigation, not in another workspace or behind a hover-only icon. Within that view, label the AI action explicitly, such as **Generate AI prompt**. Preserve terminal sessions and input when changing views. Returning to Console must not recreate panes or discard scrollback.

Reuse a verified existing notes view/data source where appropriate rather than creating a disconnected second notebook. Determine the actual integration before implementation.

### D. Interaction and responsive behavior

- Functional hover/focus transitions and short fade/slide transitions using sanctioned timing/easing.
- Reduced motion must suppress all nonessential loops and transitions, not just three named keyframes.
- Avoid unnecessary layout animation; preserve stable terminal dimensions and resizing behavior.
- Panels must not collapse the terminal's flex area to zero width or height.
- At narrow widths, collapse secondary panels into accessible drawers; Command Notes remains reachable.
- Dialogs need focus management, Escape close, labelled controls and return focus. Destructive actions require explicit confirmation.

## 7. Verify and complete the AI prompt → parsed notes flow

Trace what exists before adding new endpoints or UI. The expected workflow is:

1. User opens Command Notes from Penguin Console.
2. User selects a command or topic and chooses Generate AI prompt.
3. The prompt includes relevant command context and an explicit output schema. Do not silently include private terminal history, paths, credentials or output.
4. User can preview/copy the prompt and, if supported, open the chosen external AI provider. Copy/open failures must be visible.
5. User pastes the AI response into a clearly labelled import area.
6. Parser validates the schema and shows a preview. Malformed input remains editable with a useful error; do not discard it.
7. User confirms Save. Report success only after the persistence operation succeeds.
8. Notes appear in the Command Notes list and remain after navigation and application restart.

Required checks:

- Determine the actual storage mechanism; an in-memory React array is not durable storage.
- Define duplicate handling explicitly, preserving user edits rather than silently overwriting.
- Preserve structured fields instead of storing only a one-line summary.
- Treat imported AI output as untrusted data. Render it safely and never execute imported commands automatically.
- Keep prompt generation, parsing and saving as separate observable states.
- Cover empty, loading, error and populated states, including failed saves and missing bridge/provider availability.

## 8. Verify terminal execution and usage tracking

### Execution

- Follow Penguin Console's `runCommand` path through its store and bridge/simulator.
- Establish whether it uses a real PTY, process execution, simulation, or a mixture. Display the actual mode; never present simulation as a live shell.
- Test safe commands only, with permission where execution writes state.
- Verify output, exit status, working-directory behavior, interruption and bridge failures appropriate to the backend.
- Interactive programs require a real interactive backend; a short-lived `exec` handler alone does not establish support for editors such as Vim.
- `user@penguin` is hardcoded display text in the previously inspected prompt. It is not evidence of real host identity or execution. Use verified backend identity when available, otherwise an honest mode label; do not fabricate identity.

### Usage

- Hook the actual Penguin Console command path, not only Handbook practice execution.
- Define what is counted: submitted attempts, successful executions, or both. Label the UI accordingly.
- Specify parsing behavior for leading whitespace, assignments, `sudo`, pipelines and compound commands; do not claim a first-token split provides complete shell analytics.
- Avoid storing full commands containing secrets when aggregate command names suffice.
- Refresh visible counts after execution and verify durable storage/readback.
- Prevent duplicate counting from re-renders, retries, event replay and broadcast behavior. Define broadcast counting semantics.
- Keep tracking failure separate from execution failure; a telemetry error must not rerun a command.

## 9. Implementation order

1. Recover state, claim files and back up approved edits.
2. Load all mandatory skills and inspect live design tokens and component sources.
3. Complete the route and feature matrix; record concrete gaps and existing integrations.
4. Present the four design-intent answers and a small layout/action map.
5. Integrate chrome tokens, CSS scoping and typography first.
6. Add or expose Command Notes navigation without resetting console sessions.
7. Complete verified gaps in AI generation/import/persistence and usage tracking, with separate tests.
8. Validate source, build artifacts and actual rendered behavior.
9. Produce a truthful handoff: changes, test evidence, remaining blockers and any unverified behavior.

## 10. Acceptance gates

### Design

- Correct screen: `/penguin-console` renders the changed code.
- Chrome matches LAMINAR: flat zinc, one signal hue, token-based colors, permitted radii/fonts, no decorative glow/gradient/glass/spring.
- 8px `rounded-lg` is allowed; do NOT use a “zero rounded-lg” gate.
- No raw color fallbacks in TSX masquerading as token use. Any terminal palette exception is explicitly reviewed.
- Changing terminal theme leaves app chrome consistent.
- CSS does not restyle unrelated RHEO routes.

### Discoverability and functionality

- Command Notes is visible and reachable in one click from Penguin Console at supported widths.
- Generate prompt → copy → paste result → validate → preview → save → reopen works through real UI interactions.
- Invalid imports and failed saves are recoverable and never shown as success.
- Saved notes and usage survive restart.
- Execution mode and identity are honest; output and exit behavior match the actual backend.
- Existing tab creation/close, splits, resizing, search, history, presets, workspace saving and keyboard shortcuts still work.

### Verification discipline

- Run the repository lint and TypeScript checks; preserve complete output and distinguish verified baseline failures from new errors. Do not assume a failure is pre-existing.
- Run documented build/preload/service compilation through exclusive coordination only after the app is stopped. No overlapping builds and no killing processes owned by others.
- Inspect the actual hashed entry referenced by `dist/index.html`, fallback safety UI and required Electron artifacts. Missing literal `index.js` is not failure when hashed assets are used.
- Use Probe for runtime checks if permitted/available. Verify visibility, non-zero geometry and pointer/keyboard access, not just source markers or IPC response.
- If runtime testing is unavailable or the user retains testing, report NOT TESTED/NOT LAUNCHED rather than PASS.
- No source changes, builds, dependency installation or runtime tests were performed as part of exporting this document.

## 11. Corrections to the earlier chat plan

Do not implement the earlier plan verbatim. It incorrectly proposed or implied:

- glassmorphic chrome despite LAMINAR;
- replacing every 8px radius with 12px;
- arbitrary new chrome colors inside TSX;
- preserving all appearance effects regardless of the design contract;
- leaving the glow toggle inert;
- claiming all eight skills were used;
- proving Penguin Console execution through an unrelated Learn IPC handler;
- proving successful builds merely from output file presence;
- treating an empty coordination CLI response as successful registration/claims.

This document replaces those proposals with an audit-first, app-aligned integration plan. It does not certify the current console or its AI features as complete.
