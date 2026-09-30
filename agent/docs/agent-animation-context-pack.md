# Context Pack: Employree-Style Agent Animation for RHEO Terminal Workspace

> Give this entire document to the AI that will build the animation.
> It has NO prior knowledge of this project — everything it needs is below.

---

## 1. WHAT ARE YOU BUILDING?

**Style reference:** "Employree-style" = typographic/ASCII-art terminal animation aesthetic. Think:
- Character-based scene composition using text glyphs, box-drawing chars, block elements
- Animated typing effects, blinking cursors, character idle loops
- Terminal-flavored atmosphere: monospace, dark background, deliberate pacing
- NOT a literal re-creation of any specific existing animation — use the *feel* as direction

**Where it lives:** Inside the RHEO Terminal Workspace (`/terminal` route), as a decorative/ambient element visible in the workspace sidebar or as a workspace-level ambient decoration. NOT a new app route. NOT a standalone page.

**What it animates:** The agent workforce — the AI agent sessions that run inside the workspace. The animation should evoke: agents being alive, typing, thinking, working, in a terminal-flavored typographic style.

---

## 2. THE PROJECT — RHEO (NOT TURGO)

**Product:** RHEO — a desktop productivity time-tracker app (Electron + React + Vite).
**Repo path:** `/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker`
**Package.json name:** `rheo`, version `1.1.0`
**Build:** `node scripts/build.mjs` (after `vite build`). NEVER build while app runs.
**Model of agent who will build this:** Another AI with zero context about RHEO.

---

## 3. WHERE THE ANIMATION GOES — TERMINAL WORKSPACE

### Route + file
- **Route:** `/terminal`
- **File:** `src/pages/TerminalPage.tsx` (~6303 lines — the largest file in the project)
- **Wrapper:** `PageShell` → `TerminalPage`

### What the workspace IS
The Terminal Workspace is a multi-pane terminal environment (xterm.js + node-pty) with:
- A **sidebar** with 5 groups, each with its own accent color and subtabs:
  | Group | Accent | Subtabs |
  |---|---|---|
  | Setup | orange/cyan | Presets, Configs |
  | Work | green/emerald | Sessions, Map, Files, Workspaces |
  | Insights | purple/violet | Analytics, Issues, Bugs |
  | Studio | indigo | Skills, Design |
  | Context | amber | Context, Maintenance, Page Context |
- **Terminal panes** (N-ary tree split layout, multiple PTYs)
- **Agent sessions** — each terminal can host an AI agent (opencode, claude, codex, gemini, aider)

### The animation placement options (pick one or more)
1. **Sidebar ambient** — a small animated element in the workspace sidebar (e.g., in the Sessions subtab header, or as a group-icon decoration)
2. **Terminal header decoration** — above or beside the terminal layout
3. **Workspace idle animation** — plays when no terminal is active / workspace is idle
4. **Agent status ambient** — reflects the collective state of all agent sessions

The animation should NOT disrupt terminal functionality. It is decorative/ambient.

---

## 4. THE AGENT SYSTEM — WHAT'S BEING ANIMATED

### Known agents
```ts
const KNOWN_AGENTS: Record<string, { launch: string; resumeFlag: string }> = {
  opencode:  { launch: 'opencode',  resumeFlag: '--resume' },
  claude:    { launch: 'claude',    resumeFlag: '--resume' },
  codex:     { launch: 'codex',     resumeFlag: '--resume' },
  gemini:    { launch: 'gemini',    resumeFlag: '--resume' },
  aider:     { launch: 'aider',     resumeFlag: '--resume' },
};
```

### Agent phases (lifecycle state machine)
`launching → ready → busy → attention → error`

Detected via:
- Prompt regex (per-agent patterns like `/^(?:opencode)?\s*>\s*$/i`)
- TUI settle heuristic (150B + 500ms silence)
- Shell rejection
- Write verification (2.5s timer)

### IPC events for agent state
| Event | Purpose |
|-------|---------|
| `agent:ready` | Agent signature detected — phase=`ready` |
| `agent:idle` | Agent is idle |
| `agent:timeout` | Init timed out (30s) — phase=`error` |
| `agent:init-error` | Init error |
| `agent:write-verified` | Write confirmed — phase=`idle` |
| `agent:write-failed` | Write verification failed — phase=`error` |

### Session status values (for agent session records)
`active` / `idle` / `completed` / `error` / `cancelled` / `inactive`

### Existing status indicator colors
```tsx
agent.status === 'active'  → bg-emerald-400  (pulse on live)
agent.status === 'idle'    → bg-amber-400    (pulse)
agent.status === 'error'   → bg-red-400
agent.status === 'inactive'→ bg-zinc-600
```

### Session data shape (from DB `terminal_sessions`)
- `id`, `projectId`, `agent`, `resumeId`, `terminalId`, `topic`, `workingDirectory`
- `status`, `category`, `cost`, `tokens`, `totalTokens`, `totalCost`
- `createdAt`, `updatedAt`
- `autoTags?`, `categoryConfirmed?`, `productArea?`, `description?`

### Context delta messages
When problems/requests/checklists change, a `[Context] ...` message is written to the active terminal:
```
[Context] New problem: Bug X (ID: 123)
[Context] Updated problem: Bug X → Fixed
```

---

## 5. DESIGN + ANIMATION STACK — WHAT'S AVAILABLE

### Libraries installed (all already in package.json)
| Need | Library | Import |
|---|---|---|
| UI animation | `motion` v12 | `import { motion, AnimatePresence, useScroll, useTransform } from "motion"` |
| Legacy animation | `framer-motion` | `import { motion, AnimatePresence } from "framer-motion"` |
| Timeline choreography | `gsap` | `import gsap from "gsap"` — ONLY in `src/services/design/MotionTemplates.ts` |
| Icons | `lucide-react` | `import { Play, Pause, Code2, Bot, Terminal } from "lucide-react"` |
| Charts | `chart.js` / `lightweight-charts` | — |
| 3D | `@react-three/fiber` + `drei` + `postprocessing` | — |

### What is NOT installed (do NOT install these)
- KokonutUI
- Bklit UI
- Anime.js

### Existing motion conventions (READ THIS BEFORE ANIMATING)
From `src/components/ai/lib/motion.ts` and `src/components/ai/tokens.ts`:

```ts
// Durations
MOTION.fast  = 0.15  // 150ms — micro-interactions, hover, tap
MOTION.normal = 0.25 // 250ms — standard transitions
MOTION.slow  = 0.4   // 400ms — entrances, reveals

// Eases
easeOut   = [0.16, 1, 0.3, 1]   // standard
easeInOut = [0.4, 0, 0.2, 1]    // in/out

// Rules
// - Animate transform + opacity ONLY
// - Durations 150 / 250 / 400ms
// - No spring physics
// - Everything degrades to instant under prefers-reduced-motion
// - One motion engine per element (don't mix motion + framer-motion + GSAP on same element)
```

### Existing animation components (reference patterns)
1. **`AiBuildingIndicator.tsx`** — `src/components/ai/primitives/AiBuildingIndicator.tsx`
   - Uses `aiBuildingVariants` from `motion.ts`
   - Shows "AI is building..." with progress bar
   - States: hidden → building (opacity 0.6, y:10, scale 0.95) → show (opacity 1, y:0, scale 1)
   - Uses `framer-motion` `motion.div` with `variants`

2. **`AiBuildingIndicator` variants** (from `motion.ts`):
```ts
export const aiBuildingVariants: Variants = {
  hidden:    { opacity: 0, y: 20, scale: 0.9 },
  building:  { opacity: 0.6, y: 10, scale: 0.95, transition: { duration: MOTION.slow, ease: easeOut } },
  show:      { opacity: 1, y: 0, scale: 1, transition: { duration: MOTION.slow, ease: [0.34, 1.56, 0.64, 1] } },
};
```

3. **`statusBadgePulse`** — scale pulse for status badges:
```ts
export const statusBadgePulse: Variants = {
  idle:  { scale: 1 },
  pulse: { scale: [1, 1.15, 1], transition: { duration: 0.5, ease: "easeInOut" } },
};
```

4. **`automationPulseVariants`** — violet glow pulse for executing automations:
```ts
export const automationPulseVariants: Variants = {
  idle: { boxShadow: '0 0 0px 0px rgba(139,92,246,0)' },
  active: {
    boxShadow: [
      '0 0 0px 0px rgba(139,92,246,0)',
      '0 0 16px 3px rgba(139,92,246,0.15)',
      '0 0 0px 0px rgba(139,92,246,0)',
    ],
    transition: { duration: 1.5, ease: 'easeInOut', repeat: Infinity },
  },
};
```

5. **`glowPulseVariants`** — emerald glow pulse:
```ts
export const glowPulseVariants: Variants = {
  idle: { boxShadow: "0 0 0px 0px rgba(16,185,129,0)" },
  glow: {
    boxShadow: ["0 0 0px 0px rgba(16,185,129,0)", "0 0 12px 2px rgba(16,185,129,0.25)", "0 0 0px 0px rgba(16,185,129,0)"],
    transition: { duration: 1.2, ease: "easeInOut" },
  },
};
```

6. **Tailwind `animate-pulse`** — used in App.tsx for live indicators:
```tsx
<div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
```

### Design tokens (from `src/index.css` + `src/components/ai/tokens.ts`)
- **Background:** zinc-900 (`#111111` approx), surfaces zinc-800/900
- **Text:** zinc-400/300/200, white for primary
- **Accent per workspace group:**
  - Setup: cyan (`#22d3ee`)
  - Work: emerald (`#34d399`)
  - Insights: violet (`#a78bfa`)
  - Studio: indigo (`#6366f1`)
  - Context: amber (`#fbbf24`)
- **Font:** Inter for UI, JetBrains Mono for terminal/mono contexts
- **LAMINAR constraints:** no spring/bounce, no decorative glow/gradients, no glass chrome (backdrop-blur on chrome). Flat zinc + one signal hue.

---

## 6. EXISTING TERMINAL WORKSPACE COMPONENT TREE

From `agent/PAGE_CONTEXT.md` (Terminal/Workspace section), condensed:

```
PageShell
├── TerminalWindow (@xterm/xterm + node-pty)
│   └── TerminalLayout (N-ary tree split panes)
│       └── TerminalPane x N
├── Sidebar (5 groups, 12+ subtabs)
│   ├── Presets (saved commands)
│   ├── Sessions (AI chat history)
│   ├── Map (layout visualization, drag-and-drop)
│   ├── Analytics (AI usage)
│   ├── Problems (issue tracker)
│   ├── Requests (feature requests)
│   ├── Files (agent directory browser)
│   ├── Checklists
│   ├── Skills (DSL forms)
│   ├── Configs (model config, cross-session sync)
│   ├── History (prompt history)
│   ├── Context Maintenance (memory management)
│   └── Prompts (system prompt editing)
├── InstructionPanel
├── NewSessionDialog
├── ImportSessionsDialog
├── GeneralistDialog
├── RoutingDisambiguationDialog
├── RoutingToast
├── SessionEditDialog
├── ContextSidebar
├── AnalyticsDashboard
└── DesignWorkspacePage (embedded)
```

### Terminal pane component (`src/components/TerminalWindow.tsx`)
- Uses `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links`
- Uses `node-pty` for PTY process spawning
- Each pane has: `terminalRef`, `fitAddonRef`, `terminalReadyStates`, `inputBuffers`
- Status dot in pane header: `w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse` (cyan = ready/active)

---

## 7. KEY FILES THE BUILDER CAN READ

| File | What it contains |
|---|---|
| `src/pages/TerminalPage.tsx` | Main workspace page — agent init, session management, sidebar, terminal layout |
| `src/components/TerminalWindow.tsx` | Terminal layout + panes + xterm.js wiring |
| `src/components/ai/primitives/AiBuildingIndicator.tsx` | Existing "AI building" animation — reference pattern |
| `src/components/ai/lib/motion.ts` | All motion variants — copy easing/duration conventions |
| `src/components/ai/tokens.ts` | MOTION durations + eases |
| `src/index.css` | Global design tokens, LAMINAR rules, fonts |
| `agent/PAGE_CONTEXT.md` | Page-by-page breakdown of every route |
| `agent/dictionary.md` | Terminology — esp. "workspace" = `/terminal`, NOT app sidebar |
| `agent/docs/stack-setup.md` | What libraries are installed + how to use them |
| `agent/docs/stack-usage-guide.md` | Which library does what + restraint rules |
| `agent/state.md` | Active sessions, protocol |
| `agent/ACTIONS_SCHEMA.md` | How agents report actions |
| `package.json` | Full dependency list |

---

## 8. DATA THE ANIMATION CAN READ (IPC + props)

### IPC endpoints relevant to agent state
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `get-terminal-sessions` | read | List all terminal sessions with status |
| `get-ai-usage-summary` | read | AI token/cost per tool |
| `getAISyncStatus` | read | AI sync state |
| `terminal:create` | write | Create terminal pane |
| `terminal:write` | write | Write to terminal |
| `spawn-terminal` | write | Spawn PTY process |
| `save-terminal-session` | write | Save session state |
| `get-terminal-session-resume-id` | read | Resume session |
| `agent:status` / `agent:ready` / `agent:idle` | event | Agent phase changes |

### Props available in TerminalPage
TerminalPage is **self-contained** — it fetches its own data. No props from App.tsx.
- sessions, terminalInstances, activeTab, activeSessionId, layout (N-ary tree)
- projectId, projectPath (from IDE page launch)

### What the animation can observe
- Number of active agent sessions
- Agent type of each session (opencode/claude/codex/gemini/aider)
- Session status (active/idle/completed/error)
- Whether terminals are running
- Context delta messages arriving

---

## 9. CONSTRAINTS THE BUILDER MUST HONOR

1. **One motion engine per element.** If `motion` is already animating the parent, don't GSAP the child.
2. **No spring/bounce on UI elements.** Settings toggles, buttons — 150-300ms ease-out only.
3. **Respect `prefers-reduced-motion`.** Use `useReducedMotion()` from framer-motion or CSS `@media (prefers-reduced-motion: reduce)`.
4. **LAMINAR chrome rules:** flat zinc, one signal hue, no glass blur on chrome, radii 8/12, no decorative gradients.
5. **No new dependencies.** Only use what's already in `package.json`.
6. **Animation must not disrupt terminal functionality.** It's ambient/decorative.
7. **Don't touch files unrelated to the animation.**
8. **Build with `node scripts/build.mjs`** after making changes — never `npm run build` directly.
9. **Never build while the app is running.**

---

## 10. DELIVERABLE EXPECTATIONS

The builder should produce:
1. **A new component file** (e.g., `src/components/terminal/AgentAmbientAnimation.tsx` or similar) — the Employree-style animation
2. **Integration point** — where it's mounted in `TerminalPage.tsx` or `TerminalWindow.tsx` (clearly marked)
3. **Uses existing motion stack** — `motion` v12 or `framer-motion` (matching what's already used in the vicinity), no new deps
4. **Reflects agent state** — the animation should respond to: agent sessions existing, agent status, activity
5. **Terminal-flavored aesthetic** — monospace, typographic, dark, deliberate pacing, character-based or glyph-based visual language
6. **Reduced-motion safe** — degrades gracefully

---

## 11. QUICK START FOR THE BUILDER

```bash
# From repo root
cd /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App\ Tracker

# Read these first
cat src/components/ai/primitives/AiBuildingIndicator.tsx   # existing animation pattern
cat src/components/ai/lib/motion.ts                         # motion conventions
cat src/pages/TerminalPage.tsx                              # where to mount
cat agent/PAGE_CONTEXT.md                                   # workspace layout
cat agent/dictionary.md                                     # terminology

# Build after changes
node scripts/build.mjs
```

---

*End of context pack. Everything below this line is metadata for the human.*
