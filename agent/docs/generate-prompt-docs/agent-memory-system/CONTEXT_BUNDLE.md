# CONTEXT_BUNDLE.md — Agent Memory System Design

## Raw Request (verbatim)
"There's an existing problem with my AI system where it's sort of like, I don't know if it's evolving to this feature in the workspace or not. But the problem is that it constantly forgets the stuff. It's constantly not improved based on the mistakes. So, for example, previously it's so weird, it was a user-generated prompt skill. And it's supposed to know that gerat prompt skill is generating a prompt to a different AI. To an AI that has a context of the project whatsoever. So it needs to build a context bundle. And if I need to tell them to use the skills in MCP, it should be using the light stuff and then including it in the context bundle on the actual output of the skill in MCP. Instead of telling the AI the prompt to make the MCP and stuff. So, I've already mentioned this multiple times, but there's no mechanism where it can save it into memory. And actually learn from it, right? But the problem is with this system that is like a growing library of things to make sure that it has a memory of and needs to constantly think of those memories before anything. So it needs to be included in the prompt somewhere or something. You compile everything and it will be so long. If you talk about a V1 to 2 comps in a short term, it won't be that long, but in the long term it's a long something that it needs to be. Somehow we design so that it's not just really just simply being text of list of instructions that will be included in the system prompt or in the things that the agent will read."

## Problem Statement
The AI agent (opencode) operates amnesiac between sessions. It repeatedly makes the same mistakes, doesn't learn from corrections, and has no mechanism to persist lessons. The architecture has extensive scaffolding for memory/context/reflection, but almost none is populated or auto-loaded.

---

## FILE 1: opencode.json — The Injection Mechanism
```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "AGENTS.md",
    "agent/DEFAULT_SYSTEM_PROMPT.md",
    "agent/GENERAL_ADDITIONS.md",
    "agent/dictionary.md",
    "agent/state.md"
  ],
  "plugin": [".opencode\\plugins\\graphify.js"],
  "mcp": {
    "@21st-dev/magic": { "type": "local", "command": ["node", "scripts/mcp-launcher.mjs", "21st-dev"], "enabled": true },
    "probe": { "type": "local", "command": ["node", "C:/Users/cleme/Documents/COMPUTAH_SAYENCE/probe/dist/index.js"], "enabled": true },
    "notion": { "type": "local", "command": ["npx", "-y", "@suekou/mcp-notion-server"], "environment": { "NOTION_API_TOKEN": "REDACTED_NOTION_API_TOKEN" }, "enabled": true },
    "shadcn": { "type": "local", "command": ["npx", "-y", "shadcn@latest", "mcp"], "enabled": true },
    "magicui": { "type": "local", "command": ["npx", "-y", "@magicuidesign/mcp@latest"], "enabled": true },
    "lucide": { "type": "local", "command": ["npx", "-y", "lucide-icons-mcp"], "enabled": true },
    "unsplash": { "type": "local", "command": ["node", "scripts/mcp-launcher.mjs", "unsplash"], "enabled": true },
    "reactbits": { "type": "local", "command": ["npx", "-y", "reactbits-dev-mcp-server"], "enabled": true },
    "iconify": { "type": "local", "command": ["npx", "-y", "better-icons-mcp"], "enabled": true },
    "fragments-ui": { "type": "local", "command": ["npx", "-y", "@usefragments/mcp"], "enabled": true },
    "shadcn-ui-mcp": { "type": "local", "command": ["npx", "-y", "@jpisnice/shadcn-ui-mcp-server"], "enabled": true },
    "refero-mcp": { "type": "local", "command": ["npx", "-y", "@refero/mcp"], "enabled": false },
    "aidesigner": { "type": "url", "url": "https://api.aidesigner.ai/api/v1/mcp", "enabled": false }
  },
  "snapshot": false
}
```
**Key insight:** `instructions` array is how files get force-loaded into every agent prompt. MEMORY.md is NOT in this list. Adding a file here = auto-loaded every session.

---

## FILE 2: agent/MEMORY.md — Durable Memory (nearly empty)
```markdown
# DeskFlow — Durable Memory
- [2026-07-05] Conductor is a WORKSPACE feature, not a standalone page. It lives in the workspace sidebar (Work group → Swarm subtab). Project selection comes first (from the terminal's project dropdown), then the swarm operates on that project's path. Never build a separate repoRoot picker for it.
```
**1 entry in 210 cycles.** Not auto-loaded. The system exists but is barely used because there's no auto-write mechanism.

---

## FILE 3: agent/DEFAULT_SYSTEM_PROMPT.md — What the Agent Reads (full, 93 lines)
```markdown
# DeskFlow AI Agent — System Prompt (v3)

## 0. Who you are
You are a coding agent (opencode / claude / aider / codex) running **inside the DeskFlow Terminal Workspace**. DeskFlow is an Electron + React + better-sqlite3 desktop productivity tracker. You are the **Hands & Eyes** of a two-AI relay loop:
- **Architect** (external) writes patches and Fix Packets.
- **You** apply changes, build, run the app, verify in the real UI, and report.
- **CZ** relays between you and the Architect, and is the only human tester.
Execute precisely, verify honestly, report in the exact format in §8. Never invent results.

## 1. Startup ritual (do this BEFORE acting, every session)
These files are force-loaded into your context via `opencode.json` "instructions": `AGENTS.md`, `MEMORY.md`, `agent/state.md`, `agent/dictionary.md`, `agent/FEATURE_TRACKER.md`, `agent/context.md`, `agent/PROBLEMS.md`.
1. Read `MEMORY.md` and `agent/state.md` FIRST. Recover the current cycle number, your role, and in-flight work. NEVER ask CZ for status you can read there.
2. Read `agent/dictionary.md` to resolve project terminology (see §2).
3. Identify the active problem/request (`agent/problems.json` / `agent/requests.json`).
Do not start coding until state is recovered.

## 4. Memory discipline (anti-amnesia)
`MEMORY.md` is durable cross-session memory, loaded every prompt.
- At cycle END, append a durable lesson ONLY when it is: a correction CZ/Architect made, a non-obvious root cause, or a confirmed invariant. One or two lines each.
- Do NOT log one-off trivia. If a lesson recurs across sessions, mark it kept; if stale, it can be archived.
- Update `agent/state.md` (cycle number, current focus, changelog) at cycle end.
- When the redesigned memory layer ships, emit `[save-memory] <scope> | <tags> | <lesson>` and let the app score/dedupe/promote it; until then append to `MEMORY.md` directly.

## 8. Cycle report format (END every cycle with EXACTLY this)
CYCLE: <n>
BUILD: OK | main.cjs <ts> | preload.cjs <ts>
GATE A  <what>
FEATURE: <name>
STEPS: <steps>
EXPECTED: <expected>
ACTUAL: <observed>
VERDICT: PASS | FAIL | PARTIAL
```
**Key insight:** §4 mentions `[save-memory] <scope> | <tags> | <lesson>` — a planned but never implemented memory emission format. The agent is SUPPOSED to emit structured memory commands but there's no engine to process them.

---

## FILE 4: agent/COMMON_ERRORS_FIXED.md — Error Patterns (464 lines, full first 100 lines)
```markdown
## Entry 1 — App won't launch: "Cannot find module dist-electron/main.cjs"
Symptom: Unable to find Electron app + Cannot find module 'dist-electron/main.cjs'
Root cause: package.json points "main" at dist-electron/main.cjs but file was never built.
Fast fix: node scripts/build.mjs (NOT electron-vite build — that's broken on Windows)
Prevention: Never run electron-vite build. Always node scripts/build.mjs.

## Entry 2 — App launches but DB shows all zeros
Symptom: App opens, every number is 0, no error in app.
Root cause: better-sqlite3 native binary built for wrong runtime, or wrong DB path.
Fast fix: Read npm start terminal. Fix DB path: path.join(app.getPath('userData'), 'deskflow.db')

## Entry 4 — Preload not loading (window.deskflowAPI undefined)
Symptom: window.deskflowAPI is undefined, IPC calls fail.
Root cause: preload.cjs not built or not referenced in electron config.
Fast fix: npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs

## Entry 12 — NEVER run `git clean -fdx`
git clean -fdx deletes ALL untracked files — including .ts source files that exist only in the working directory. NEVER recoverable from git.

## Entry 13 — CYCLE REPORT format for ALL status responses
For ANY status query, response MUST be the EXACT cycle report format. Documented 3+ times because it keeps being violated.

## Entry 14 — NEVER invent service/provider names
Every name, URL, and label for external services must be verified against real documentation.
```
**NOT auto-loaded.** Agent must remember to read it.

---

## FILE 5: agent/skills/agent-reflect/problem.md — Debugging Rules (full, 98 lines)
```markdown
# Durable Debugging Rules
1. Tailwind v4 CSS — NEVER use v3 directives (v3 silently breaks v4)
2. Package pinning — NEVER run npm install tailwindcss@latest
3. Jest config — testEnvironment: "jsdom" NOT "node"
4. Do NOT use git checkout/restore/reset/stash
5. Identifiers colliding with DOM globals — use specific names
6. CSS calc with Tailwind — prefer flex/grid over manual width calcs
7. Empty states in components — loading, error, empty, normal states needed
8. IPC handler naming consistency — kebab-case, verify both sides
9. Form state reset — check if default exists before resetting
10. Console errors = reject — fix all before considering task complete
11. Raw Request in prompts = verbatim user messages (do NOT rephrase)
12. NEVER run git clean -fdx
13. CYCLE REPORT format for ALL status responses
14. NEVER invent service/provider names
```
**NOT auto-loaded.** Agent must remember to read it.

---

## FILE 6: agent/skills/agent-reflect/logs/ — Reflection Logs (18 files, NOT auto-loaded)
```markdown
Files:
- 2026-06-18_idiot_trigger_streaming_no_stream_true.md
- 2026-06-18_idiot_trigger_graphify_generate_prompt.md
- 2026-06-20_idiot_trigger.md
- 2026-06-20_idiot_trigger_new_session_context.md
- 2026-06-21_idiot_trigger_amnesia_pipeline_context.md
- 2026-06-21_idiot_trigger_design_polish.md
- 2026-06-21_idiot_trigger_fake_provider_names.md
- 2026-06-21_idiot_trigger_false_crash_fix.md
- 2026-06-21_idiot_trigger_features_sidebar_not_popup.md
- 2026-06-21_idiot_trigger_no_cycle_report_status.md
- 2026-06-21_idiot_trigger_verbose_report_format.md
- 2026-06-21_idiot_trigger_wrong_format_again.md
Plus 6 older logs in log/ subdirectory (May-June 2026)
```
Each contains a specific lesson from a real mistake. **NOT auto-loaded.**

---

## FILE 7: src/services/ContextConfig.ts — Token Budget System (full, 98 lines)
```typescript
export type ModelTier = 'top' | 'mid' | 'low';

export interface ContextConfig {
  total_token_budget: number;
  model_tier: ModelTier;
  systems: {
    llm_wiki: { enabled: boolean; files: string[]; max_tokens: number };
    obsidian_skills: { enabled: boolean; skills: string[]; max_tokens: number };
    graphify: { enabled: boolean; include_graph: boolean; include_summary: boolean; max_tokens: number };
    para: { enabled: boolean; areas: string[]; max_tokens: number };
    qmd: { enabled: boolean; templates: string[]; max_tokens: number };
    automations: { enabled: boolean; max_tokens: number };
    design_skills: { enabled: boolean; max_tokens: number; skills: string[]; levels: { design_variance: number; motion_intensity: number; visual_density: number }; include_references: boolean };
  };
  summarization: { enabled: boolean; message_threshold: number; max_recent_messages: number; summary_style: 'brief' | 'detailed' };
  deep_memory: { enabled: boolean; pattern_detection: boolean; max_patterns: number; retention_days: number };
}

export const TIER_PROFILES: Record<ModelTier, Partial<ContextConfig>> = {
  top: { total_token_budget: 10000, deep_memory: { enabled: true, pattern_detection: true, max_patterns: 30, retention_days: 120 } },
  mid: { total_token_budget: 7000, deep_memory: { enabled: true, pattern_detection: true, max_patterns: 20, retention_days: 90 } },
  low: { total_token_budget: 4000, deep_memory: { enabled: true, pattern_detection: false, max_patterns: 10, retention_days: 30 } },
};
```
**Key insight:** `deep_memory` config ALREADY EXISTS with `pattern_detection`, `max_patterns`, `retention_days`. The scaffolding is there — just needs implementation.

---

## FILE 8: src/services/ContextService.ts — Context Assembly (485 lines, key section)
```typescript
export async function assembleContext(projectPath: string, config: ContextConfig, opts?: AssembleOptions): Promise<string> {
  const budget = config.total_token_budget || 7000;
  let prompt = '';
  let usedTokens = 0;

  const add = async (content: string) => {
    const tokens = estimateTokens(content);
    if (usedTokens + tokens <= budget) {
      prompt += content;
      usedTokens += tokens;
    }
  };

  const forceAdd = (content: string) => {
    prompt += content;
    usedTokens += estimateTokens(content);
  };

  // LAYER 0: RULES COMPACT (always injected, top priority)
  const rulesCompact = await readRulesCompact(projectPath, opts);
  if (rulesCompact.trim()) {
    forceAdd(`[LAYER 0 — IDENTITY & CONSTRAINTS]\n${rulesCompact}\n`);
  }

  // LAYER 1: STATE SNAPSHOT (always injected regardless of budget)
  const stateContent = await readFileUncapped(projectPath, 'agent/state.md');
  if (stateContent.trim()) {
    const truncated = stateContent.length > 2000 ? condenseStateMd(stateContent, 500) : stateContent.slice(0, 2000);
    forceAdd(`[LAYER 1 — CURRENT STATE SNAPSHOT]\n${truncated}\n`);
  }

  const patternsContent = await readFileUncapped(projectPath, 'agent/patterns.md');
  if (patternsContent.trim()) {
    const truncated = patternsContent.slice(0, 1500);
    forceAdd(`[LAYER 2 — PATTERNS & CONVENTIONS]\n${truncated}\n`);
  }

  // ... more layers for each knowledge system ...
}
```
**Key insight:** The context assembly already has a layered architecture with token budgets. A new "Layer" for memories could be added here.

---

## FILE 9: src/main/ai/memoryExtractor.ts — Memory Extraction (full, 92 lines)
```typescript
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  goal: [/goal|objective|target|aim/i, /set a goal|new goal|goal for/i],
  preference: [/prefer|like|don't like|favorite|instead of/i, /i want|i would rather/i],
  decision: [/decided|choose|picked|went with|settled on/i, /decision|conclusion/i],
  context: [/project|client|team|deadline|meeting/i, /working on|assigned to/i],
  habit: [/every day|daily|routine|habit|usually|typically/i],
}

export interface MemoryEntry {
  id: string
  threadDate: string
  content: string
  category: "goal" | "preference" | "decision" | "context" | "project" | "habit"
  importance: number
  createdAt: number
}

export function extractMemoriesFromMessages(
  threadDate: string,
  messages: Array<{ content: string; parsed?: any }>
): MemoryEntry[] {
  const memories: MemoryEntry[] = []
  for (const msg of messages) {
    const content = msg.content
    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      for (const pattern of patterns) {
        const match = content.match(pattern)
        if (match) {
          const sentenceStart = content.lastIndexOf(".", match.index) + 1
          const sentenceEnd = content.indexOf(".", match.index! + match[0].length)
          const sentence = content.slice(sentenceStart, sentenceEnd > -1 ? sentenceEnd + 1 : undefined).trim()
          if (sentence.length > 10 && sentence.length < 200) {
            const importance = calculateImportance(sentence, category, msg.parsed)
            memories.push({
              id: crypto.randomUUID(),
              threadDate,
              content: sentence,
              category: category as any,
              importance,
              createdAt: Date.now(),
            })
          }
          break
        }
      }
    }
  }
  const seen = new Set<string>()
  return memories.filter(m => {
    const key = m.content.toLowerCase().slice(0, 40)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function calculateImportance(sentence: string, category: string, parsed?: any): number {
  let score = 0.5
  if (category === "goal") score += 0.2
  if (category === "decision") score += 0.15
  if (sentence.includes("important") || sentence.includes("critical")) score += 0.15
  if (parsed) score += 0.1
  return Math.min(1, Math.max(0, score))
}
```
**Key insight:** This has deduplication (content prefix matching), importance scoring, and category patterns. It's designed for Lyceum Learn chat but the LOGIC is reusable for agent memories.

---

## FILE 10: Empty Scaffolding
- `agent/context/deep-memory.json` — Empty `{"patterns":[],"preferences":[],"insights":[]}`
- `agent/context/session-summaries.json` — Empty `{"summaries":[]}`
- `agent/automations/automations.json` — Empty `[]`
- `graphify-out/` — Directory doesn't exist
- `CZVault/` — Directory doesn't exist

---

## EXISTING IPC ENDPOINTS (relevant)
```typescript
// preload.ts
readProjectFile: (relativePath: string, projectPath?: string) => ipcRenderer.invoke('read-project-file', relativePath, projectPath),
getPreferences: () => ipcRenderer.invoke('get-preferences'),
setPreference: (key: string, value: any) => ipcRenderer.invoke('set-preference', key, value),

// main.ts — preference storage
ipcMain.handle('get-preferences', async () => {
  return prefs; // returns the full preferences object
});
ipcMain.handle('set-preference', async (_, key, value) => {
  prefs[key] = value;
  // persists to SQLite or file
});
```
**Key insight:** Preferences system exists and persists to SQLite. A new `agentMemories` preference key could store memories without a new DB table.

---

## THE GAP SUMMARY
1. **MEMORY.md exists but is not auto-loaded** — adding it to opencode.json instructions = instant auto-load
2. **deep_memory config exists** — `pattern_detection`, `max_patterns`, `retention_days` already in ContextConfig.ts
3. **Memory extraction logic exists** — memoryExtractor.ts has importance scoring and deduplication
4. **Context assembly has layered architecture** — a new memory layer can be added to ContextService.ts
5. **Reflection logs exist but aren't injected** — 18 genuine lessons, not auto-loaded
6. **COMMON_ERRORS_FIXED.md exists but isn't injected** — 10 high-quality entries, not auto-loaded
7. **No auto-write mechanism** — agent must manually append to MEMORY.md
8. **No cross-session memory for coding agents** — deep-memory.json is empty
