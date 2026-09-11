<aside>
📌

Lead Architect audit of DeskFlow's system-prompt composition. Every issue below has an **exact** fix — real code, real UI copy, real prompt text. Hand this to a developer and implement top-to-bottom. Source of truth: `CONTEXT_BUNDLE.md`.

</aside>

## 1. Executive Summary

The composition system is **two parallel, non-overlapping pipelines** that were never unified: the **new-session path** (`initializeTerminal`) sends *only* the per-agent-type string, while the **compose path** (`generatePrompt`) sends the *3-layer* stack. The single most important finding is a **correctness bug, not just a design smell**: in the new-session path the **Default system prompt is never sent for non-opencode agents** (claude/aider/codex), and `generalAdditions`/`projectPrompt` are never sent at all — so an agent started from "New Session" behaves differently from the identical agent started via "Compose." The fix is one shared, pure assembler (`buildPromptLayers` + `renderSystemPrompt`) called by **both** paths, plus a namespaced project key, a single-source Default prompt (Vite `?raw`), and the missing Settings UI for the General and Project scopes. Everything is backward-compatible with the frozen `initializeTerminal` signature and the `DEFAULT_SYSTEM_PROMPT` export.

---

## 2. How prompts come together today (the logic, mapped end-to-end)

This answers “how does the system prompt combine with the workspace, and is it configured properly?” — short answer: **it is not, because the two paths disagree.**

```
PATH A — NEW SESSION (initializeTerminal, TerminalPage 756-884)
  NewSessionDialog / restore / resume
    -> initializeTerminal(..., systemPrompt?, ...)
    -> if systemPrompt: send systemPrompt verbatim
       else: send  prompts[agent] || prompts['claude']      (per-agent-type ONLY)
    -> + initContent + thoughtProcess
    -> agentSend(terminalId, combined, agent)
  RESULT: Default NOT prepended (except opencode, which loads it via opencode.json).
          generalAdditions / projectPrompt IGNORED.

PATH B — COMPOSE (InstructionPanel.generatePrompt 193-274)
  systemPromptLayers useMemo (TerminalPage 1005-1017):
    [ Default ] + [ General=generalAdditions ] + [ Project=systemPrompts[projectId] ]
    (+ per-layer toggles, master include toggle)
    + skills + problems + requests + custom instruction
  -> onSend({ prompt }) -> handleInstructionPanelSend -> agentSend
  RESULT: 3 layers sent. Per-agent-type string IGNORED. Default DUPLICATED for opencode.

SEPARATE — ContextAssemblyService (main, 366 lines)
  assembleContext(): project systems + RAG + decisions + problems/requests + compaction
  Used by /sync only. NOT wired into Compose. Token budget 7K.
```

**Configured properly? No.** The same agent gets different instructions depending on entry point; two scopes (`generalAdditions`, `projectPrompt`) are readable but unsettable; the dynamic context service is disconnected from the compose flow; and project prompts share a flat key namespace with reserved keys.

---

## 3. Issue Inventory

| ID | Sev | Issue | Location | Fix |
| --- | --- | --- | --- | --- |
| H1 | HIGH | Default prompt **never sent** for non-opencode agents in new-session path | TerminalPage 756-884 | Route through shared assembler |
| H2 | HIGH | Two disjoint paths produce different prompts for the same agent | 756-884 vs 1005-1017/193-274 | One `buildPromptLayers`/`renderSystemPrompt` |
| H3 | HIGH | `generalAdditions` & `projectPrompt` ignored on session creation | TerminalPage 756-884 | Same assembler (H2) |
| H4 | HIGH | Project keys collide with reserved keys (flat namespace) — a project named “claude” corrupts data | systemPrompts schema | Namespace `project:&lt;id&gt;`  • migration |
| H5 | HIGH | No sync guard: `defaults.ts` vs `agent/DEFAULT_SYSTEM_PROMPT.md` drift silently | defaults.ts 11-97 / .md | Single source via Vite `?raw` |
| M1 | MED | `generalAdditions` has no Settings UI | SettingsPage 2819-2882 | Add General section |
| M2 | MED | Per-project prompts have no Settings UI | SettingsPage 2819-2882 | Add Project section + selector |
| M3 | MED | Default duplicated for opencode in compose (token waste ~1.5-2K/compose) | 1005-1017 | `loadedExternally` skip |
| M4 | MED | Misleading label: “General prompts apply to all projects” over per-agent fields | SettingsPage prompts tab | Relabel per scope |
| M5 | MED | No conflict/precedence rule between layers | assembler + Default prompt | `PRECEDENCE_NOTE`  • prompt § |
| M6 | MED | `layerToggles` keyed by array index — breaks when a layer appears/disappears | InstructionPanel 94-108/193-274 | Key by layer `id` |
| M7 | MED | ContextAssemblyService not wired into compose — agents miss RAG/problems/state | ContextAssemblyService | Append as `dynamicContext` |
| M8 | MED | No session-scope binding: agent isn’t told it’s bound to one page/problem or how to report status | compose/init send | Inject scope block |
| L1 | LOW | opencode AI never receives `generalAdditions` | opencode.json | Generate `GENERAL_ADDITIONS.md` |
| L2 | LOW | Layer labels not origin-specific in compose UI | InstructionPanel 314-388 | Scoped labels |
| L3 | LOW | No single place to view which prompt is app- vs project-scoped | SettingsPage | Scoped section layout |

---

## 4. Exact Fixes

### F-H5 — Single-source Default prompt (do this first; everything imports it)

Make `agent/DEFAULT_SYSTEM_PROMPT.md` the **only** copy. `defaults.ts` imports it raw, so the export name/value contract is preserved and drift is impossible.

**`src/lib/defaults.ts`** — replace the inline literal (lines 11-97) with:

```tsx
// SINGLE SOURCE OF TRUTH: agent/DEFAULT_SYSTEM_PROMPT.md
// Vite inlines this at build time; opencode.json loads the same file at runtime.
import promptMd from "../../agent/DEFAULT_SYSTEM_PROMPT.md?raw"

/** Do NOT rename: imported elsewhere. Value now sourced from the .md file. */
export const DEFAULT_SYSTEM_PROMPT: string = promptMd
```

**`src/vite-env.d.ts`** — add the type shim:

```tsx
declare module "*.md?raw" {
	const content: string
	export default content
}
```

**CI / pre-commit guard** (belt-and-suspenders for anyone editing the wrong file) — `scripts/check-default-prompt.mjs`:

```jsx
import { readFileSync } from "node:fs"
// Fails if defaults.ts ever reintroduces an inline prompt literal instead of importing the .md.
const src = readFileSync("src/lib/defaults.ts", "utf8")
if (!src.includes('DEFAULT_SYSTEM_PROMPT.md?raw')) {
	console.error("defaults.ts must import agent/DEFAULT_SYSTEM_PROMPT.md?raw (single source of truth).")
	process.exit(1)
}
console.log("OK: Default prompt single-sourced.")
```

Add to `package.json`: `"scripts": { "check:prompt": "node scripts/check-default-prompt.mjs" }` and run it in CI / Husky pre-commit.

<aside>
⚠️

If the **main process** (electron main, separate bundler) ever needs `DEFAULT_SYSTEM_PROMPT`, it cannot use `?raw`; read the file directly: `fs.readFileSync(path.join(app.getAppPath(), "agent/DEFAULT_SYSTEM_PROMPT.md"), "utf8")`. Per the bundle, only the renderer imports it today, so `?raw` is sufficient.

</aside>

### F-H4 — Namespace project keys + migration

**New shared module `src/lib/promptAssembly.ts`** owns the key contract:

```tsx
import { DEFAULT_SYSTEM_PROMPT } from "./defaults"

export type AgentType = "claude" | "opencode" | "custom" | string

export interface SystemPromptsPrefs {
	claude?: string
	opencode?: string
	custom?: string
	generalAdditions?: string
	__v?: string
	[key: string]: string | undefined // project:<id>
}

export const RESERVED_PROMPT_KEYS = ["claude", "opencode", "custom", "generalAdditions", "__v"]
export const PROJECT_KEY_PREFIX = "project:"
export const projectKey = (projectId: string) => `${PROJECT_KEY_PREFIX}${projectId}`

/** Idempotent. Moves legacy bare projectId keys under project:<id>. Run once on load. */
export function migrateSystemPrompts(sp: SystemPromptsPrefs | undefined): SystemPromptsPrefs {
	if (!sp) return { __v: "2" }
	if (sp.__v === "2") return sp
	const reserved = new Set(RESERVED_PROMPT_KEYS)
	const out: SystemPromptsPrefs = {}
	for (const [k, v] of Object.entries(sp)) {
		if (reserved.has(k) || k.startsWith(PROJECT_KEY_PREFIX)) out[k] = v
		else out[projectKey(k)] = v // legacy bare projectId -> namespaced
	}
	out.__v = "2"
	return out
}
```

**`SettingsPage.tsx` load (1091-1101)** — migrate before set, and persist the migration once:

```tsx
const prefs = await window.deskflowAPI.getPreferences()
const migrated = migrateSystemPrompts(prefs?.systemPrompts)
setSystemPrompts({ claude: "", opencode: "", custom: "", generalAdditions: "", ...migrated })
if (prefs?.systemPrompts?.__v !== "2") {
	await window.deskflowAPI?.setPreference?.("systemPrompts", migrated)
}
```

### F-H1 / F-H2 / F-H3 / F-M3 / F-M5 / F-M6 — The unified assembler (the core fix)

Add to **`src/lib/promptAssembly.ts`**:

```tsx
export interface PromptLayer {
	id: "default" | "general" | "agent" | "project"
	label: string
	scope: "app" | "agent" | "project"
	content: string
	color: string
	/** true => already in the agent's context (e.g. opencode.json), do not resend. */
	loadedExternally?: boolean
}

export interface AssembleInput {
	systemPrompts: SystemPromptsPrefs
	agentType: AgentType
	projectId?: string | null
	projectName?: string | null
	/** opencode loads DEFAULT (+ GENERAL_ADDITIONS) via opencode.json at launch. */
	agentLoadsAppLayersExternally?: boolean
}

export function buildPromptLayers(input: AssembleInput): PromptLayer[] {
	const { systemPrompts: sp, agentType, projectId, projectName } = input
	const ext = !!input.agentLoadsAppLayersExternally
	const layers: PromptLayer[] = []

	layers.push({ id: "default", label: "Default (app baseline)", scope: "app",
		content: DEFAULT_SYSTEM_PROMPT || "", color: "text-cyan-400", loadedExternally: ext })

	const general = (sp.generalAdditions || "").trim()
	if (general) layers.push({ id: "general", label: "General (all projects · all agents)",
		scope: "app", content: general, color: "text-blue-400", loadedExternally: ext })

	const agentAdd = (sp[agentType] || "").trim()
	if (agentAdd) layers.push({ id: "agent", label: `Agent: ${agentType}`, scope: "agent",
		content: agentAdd, color: "text-emerald-400" })

	if (projectId) {
		const proj = (sp[projectKey(projectId)] || "").trim()
		if (proj) layers.push({ id: "project", label: `Project: ${projectName || projectId}`,
			scope: "project", content: proj, color: "text-purple-400" })
	}
	return layers
}

export const PRECEDENCE_NOTE =
	"When instructions conflict, the most specific scope wins: Project > Agent-type > General > Default."

const SECTION_SEP = "\n\n---\n\n"

export interface RenderOptions {
	/** keyed by layer id (stable). Missing = on. */
	layerToggles?: Partial<Record<PromptLayer["id"], boolean>>
	/** include layers already in the agent context. Default false. */
	includeExternallyLoaded?: boolean
	includePrecedenceNote?: boolean // default true when >1 active layer
}

export function renderSystemPrompt(layers: PromptLayer[], opts: RenderOptions = {}): string {
	const { layerToggles = {}, includeExternallyLoaded = false, includePrecedenceNote = true } = opts
	const active = layers.filter((l) => {
		if (layerToggles[l.id] === false) return false
		if (l.loadedExternally && !includeExternallyLoaded) return false
		return (l.content || "").trim().length > 0
	})
	const blocks = active.map((l) => l.content.trim())
	if (includePrecedenceNote && active.length > 1) blocks.unshift(`> ${PRECEDENCE_NOTE}`)
	return blocks.join(SECTION_SEP)
}
```

**F-H1/H3 — `initializeTerminal` (TerminalPage 756-884)** — signature unchanged; explicit `systemPrompt` still wins. Replace only the else-branch block:

```tsx
const parts: string[] = []
if (systemPrompt) {
	parts.push(systemPrompt) // explicit override (NewSessionDialog) — unchanged
} else {
	const prefs = await window.deskflowAPI?.getPreferences?.()
	const layers = buildPromptLayers({
		systemPrompts: migrateSystemPrompts(prefs?.systemPrompts),
		agentType: agent,
		projectId: selectedProject,
		projectName: selectedProject,
		agentLoadsAppLayersExternally: agent === "opencode",
	})
	const rendered = renderSystemPrompt(layers) // Default+General skipped for opencode (already loaded)
	if (rendered) parts.push(rendered)
}
// ...initContent / thoughtProcess unchanged...
```

This fixes H1 (Default now sent for claude/aider/codex), H3 (General/Project now included), and unifies with Path B.

**F-H2/M3 — `systemPromptLayers` useMemo (TerminalPage 1005-1017)** — replace body:

```tsx
const systemPromptLayers = useMemo(
	() =>
		buildPromptLayers({
			systemPrompts: migrateSystemPrompts(preferences?.systemPrompts),
			agentType: activeAgentType || "claude",
			projectId: selectedProject,
			projectName: selectedProject,
			agentLoadsAppLayersExternally: (activeAgentType || "claude") === "opencode",
		}),
	[preferences, selectedProject, activeAgentType],
)
```

Now the compose path also carries the **Agent** layer (previously missing) and **skips the duplicated Default/General for opencode** (M3).

**F-H2/M6 — `InstructionPanel.generatePrompt` (193-274)** — replace the layer block and switch toggles to id-keyed:

```tsx
// state (lines 94-108): change from index-keyed to id-keyed
const [layerToggles, setLayerToggles] = useState<Partial<Record<string, boolean>>>({})

// inside generatePrompt():
if (systemPromptIncluded && systemPromptLayers && systemPromptLayers.length > 0) {
	const includedContent = renderSystemPrompt(systemPromptLayers as PromptLayer[], {
		layerToggles,
		includeExternallyLoaded: false,
	})
	if (includedContent) parts.push(includedContent)
}
```

Update the `SystemPromptLayer` interface (InstructionPanel 45-59) to import `PromptLayer` from `src/lib/promptAssembly` (adds `id` + `scope`), and update the toggle UI (314-388) to use `layer.id` as the key instead of the map index.

### F-M1 / F-M2 / F-M4 / F-L2 / F-L3 — Settings “Prompts” tab rebuilt by scope

Replace the prompts tab (SettingsPage 2819-2882) with four clearly-scoped sections so the user can *see* what is app-wide vs agent vs project:

```tsx
{activeTab === "prompts" && (
	<div data-section="settings.prompts" className="space-y-6">
		{/* 1. DEFAULT (read-only) */}
		<GlassCard>
			<h3 className="text-cyan-400 font-semibold">Default · app baseline</h3>
			<p className="text-sm text-gray-400">Always applied first to every agent and project. Edit in agent/DEFAULT_SYSTEM_PROMPT.md.</p>
			<details><summary>View default prompt</summary><pre>{DEFAULT_SYSTEM_PROMPT}</pre></details>
		</GlassCard>

		{/* 2. GENERAL (generalAdditions) — NEW */}
		<GlassCard>
			<h3 className="text-blue-400 font-semibold">General · all projects · all agents</h3>
			<p className="text-sm text-gray-400">Reusable instructions saved to the app and applied on every project. This is the place for cross-project standards.</p>
			<textarea
				value={systemPrompts.generalAdditions || ""}
				onChange={(e) => setSystemPrompts((p) => ({ ...p, generalAdditions: e.target.value }))}
				onBlur={() => handleSaveSystemPrompt("generalAdditions", systemPrompts.generalAdditions || "")}
				placeholder="App-wide instructions appended after the default, before agent/project layers..."
			/>
		</GlassCard>

		{/* 3. AGENT-TYPE (claude/opencode/custom) — RELABELED */}
		<GlassCard>
			<h3 className="text-emerald-400 font-semibold">Agent-type · only this agent</h3>
			<p className="text-sm text-gray-400">Applied only when a session uses this agent type. Stacks on top of Default + General.</p>
			{["claude", "opencode", "custom"].map((agent) => (
				<div key={agent}>
					<label>{agent === "custom" ? "Custom AI" : agent}</label>
					<textarea
						value={systemPrompts[agent] || ""}
						onChange={(e) => setSystemPrompts((p) => ({ ...p, [agent]: e.target.value }))}
						onBlur={() => handleSaveSystemPrompt(agent, systemPrompts[agent] || "")}
						placeholder={`Instructions applied only to ${agent} sessions...`}
					/>
				</div>
			))}
		</GlassCard>

		{/* 4. PROJECT (project:<id>) — NEW */}
		<GlassCard>
			<h3 className="text-purple-400 font-semibold">Project · only the selected project</h3>
			<p className="text-sm text-gray-400">Applied only to the chosen project. Highest precedence.</p>
			<select value={promptProjectId} onChange={(e) => setPromptProjectId(e.target.value)}>
				{projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
			</select>
			<textarea
				value={systemPrompts[projectKey(promptProjectId)] || ""}
				onChange={(e) => setSystemPrompts((p) => ({ ...p, [projectKey(promptProjectId)]: e.target.value }))}
				onBlur={() => handleSaveSystemPrompt(projectKey(promptProjectId), systemPrompts[projectKey(promptProjectId)] || "")}
				placeholder="Instructions applied only to this project..."
			/>
		</GlassCard>
	</div>
)}
```

Add state: `const [promptProjectId, setPromptProjectId] = useState(selectedProject || projects[0]?.id || "")`. **Delete** the old misleading “General prompts apply to all projects” copy (M4). This single screen now shows app- vs agent- vs project-scope at a glance (L3).

### F-L1 — Share the General layer with the opencode AI

`generalAdditions` is a JSON pref, so opencode can’t load it directly. Mirror it to a file whenever it’s saved, and add that file to the instructions array.

**`handleSaveSystemPrompt` (SettingsPage 1103-1109)**:

```tsx
const handleSaveSystemPrompt = async (key: string, content: string) => {
	const updated = { ...systemPrompts, [key]: content }
	setSystemPrompts(updated)
	await window.deskflowAPI?.setPreference?.("systemPrompts", updated)
	if (key === "generalAdditions") {
		// writeAgentFile = existing fs IPC; writes UTF-8 under the app root
		await window.deskflowAPI?.writeAgentFile?.("agent/GENERAL_ADDITIONS.md", content || "")
	}
}
```

**`opencode.json`**:

```json
{
  "instructions": [
    "AGENTS.md",
    "agent/DEFAULT_SYSTEM_PROMPT.md",
    "agent/GENERAL_ADDITIONS.md",
    "agent/dictionary.md",
    "MEMORY.md",
    "agent/state.md"
  ]
}
```

Result: the opencode AI sees Default + General (same as terminal agents), while Agent/Project layers remain per-session runtime (correctly *not* in the static array). This is why `initializeTerminal` sets `agentLoadsAppLayersExternally: true` for opencode — to avoid double-sending Default + General.

### F-M8 — Session-scope binding (answers “focus on this page only / update status / which chat”)

When a session is composed for a specific problem/request/page, inject this runtime block (it is **not** a static layer — it’s per-send). Add to `InstructionPanel.generatePrompt` right after the system layers, and to `handleInstructionPanelSend` for the binding:

```tsx
function scopeBlock(s: { kind: "problem" | "request" | "page"; id: string; title: string }): string {
	return [
		"## Session scope (runtime — highest priority)",
		`- This session is bound to ${s.kind}: \"${s.title}\" (id: ${s.id}).`,
		"- Work ONLY on this item. Do not touch unrelated problems, requests, files, or projects.",
		"- Operate only in this bound terminal/session; do not write to other sessions or chats.",
		"- When state changes, emit one machine-readable line so DeskFlow can update status:",
		"  STATUS: <Not Started | In Progress | AI Attempted Fix | User Testing | Fixed | Won't Fix>",
		"- End each work cycle with the mandatory cycle report (see Default §8).",
	].join("\n")
}
```

Wire it: when `selectedProblems[0]` (or request/page) is set, `parts.unshift(scopeBlock({ kind: "problem", id, title }))` after the system layers. The app already persists `active_problem_id` via `updateTerminalBinding`; add a parser in the terminal output handler that reads `STATUS:` lines and calls the existing problem-status update IPC. This is what lets “the AI know what to update and which session it belongs to.”

### F-M5 — Conflict precedence in the Default prompt

Add this section to **`agent/DEFAULT_SYSTEM_PROMPT.md`** (single source) so every agent resolves conflicts deterministically:

```
## Scope & precedence
You may receive layered instructions. Resolve conflicts by specificity, most specific wins:
Project > Agent-type > General > Default > (this baseline).
Runtime "Session scope" blocks override all of the above for the bound item only.
Never act outside the most specific scope you were given.
```

---

## 5. Harmonized Architecture

### File map (who owns what)

| File | Responsibility |
| --- | --- |
| `agent/DEFAULT_SYSTEM_PROMPT.md` | **Single source** of the Default layer (renderer + opencode read it) |
| `agent/GENERAL_ADDITIONS.md` | Generated mirror of `generalAdditions` for opencode context |
| `src/lib/defaults.ts` | Re-exports `DEFAULT_SYSTEM_PROMPT` from the .md via `?raw` |
| `src/lib/promptAssembly.ts` (NEW) | Pure layer model: keys, migration, `buildPromptLayers`, `renderSystemPrompt`, precedence |
| `TerminalPage.tsx` | Calls assembler in **both** `initializeTerminal` and `systemPromptLayers` |
| `InstructionPanel.tsx` | Renders layers (id-keyed toggles, scoped labels), calls `renderSystemPrompt`, injects scope block |
| `SettingsPage.tsx` | Scoped editors for General / Agent / Project; migration on load |
| `ContextAssemblyService.ts` | **Dynamic** context only (RAG, problems, state, compaction) — returned as `dynamicContext` |

### Unified send pipeline (both paths converge)

```
static  = renderSystemPrompt(buildPromptLayers(prefs, agent, project))
dynamic = await ipc.assembleContext({ projectId, problemIds, requestIds })   // ContextAssemblyService
scope   = scopeBlock(boundItem?)                                             // only when bound
user    = skills + selected problems/requests + custom instruction          // compose only

agentSend(terminalId, [static, scope, dynamic, user].filter(Boolean).join("\n\n---\n\n"), agent)
```

### Architecture decision: 3-layer vs ContextAssemblyService — **keep separate, defined roles**

They are not competitors. The 3-layer system is **static identity/behavior** (“who you are, how to behave”); ContextAssemblyService is **dynamic situational data** (“what is true right now”). Merging them would couple a pure renderer function to a 366-line stateful main-process service. Instead, **ContextAssemblyService consumes nothing from the layers; the send pipeline composes both.** Expose it over IPC:

```tsx
// preload bridge
assembleContext(input: {
	projectId: string
	problemIds?: string[]
	requestIds?: string[]
	tokenBudget?: number
}): Promise<{ context: string; tokensUsed: number }>
```

Wire it into `handleInstructionPanelSend` (compose) and optionally `initializeTerminal` (new session) as the `dynamic` segment above. This is the only change needed to fix M7 — no merge, no moving the layer system to main.

### opencode.json decision

The opencode AI **should** see the same **app-scoped** layers (Default + General) as terminal agents — achieved by adding `GENERAL_ADDITIONS.md` to the instructions array. It should **not** carry Agent-type or Project layers statically, because those are per-session/per-project runtime and would pollute every opencode invocation. Delta is therefore intentional and minimal: **static array = app scope only; runtime send = agent/project/scope layers.**

### Migration path (preferences)

`migrateSystemPrompts` is idempotent, stamps `__v: "2"`, runs on Settings load, and persists once. Legacy bare `projectId` keys become `project:<id>`; reserved keys untouched; no data loss; safe to ship without a separate migration runner.

---

## 6. Implementation Order (each step independently testable)

1. **F-H5** — single-source Default (`?raw` + `vite-env.d.ts` + CI check). *Test:* renderer prompt unchanged; editing the .md updates both renderer and opencode.
2. **F-H4** — add `src/lib/promptAssembly.ts` (keys + `migrateSystemPrompts`). *Test:* unit-test migration idempotency + namespacing.
3. **Assembler core** — `buildPromptLayers` + `renderSystemPrompt` + `PRECEDENCE_NOTE`. *Test:* unit tests for layer order, opencode `loadedExternally` skip, id-keyed toggles.
4. **F-H1/H3** — route `initializeTerminal` through the assembler (signature frozen). *Test:* new claude session now receives Default; new opencode session does not double-receive it.
5. **F-H2/M3/M6** — rewrite `systemPromptLayers` useMemo + `InstructionPanel.generatePrompt`/toggles. *Test:* compose output == new-session output for the same agent/project.
6. **F-M1/M2/M4/L3** — rebuild Settings prompts tab (General + Project + relabel) + migrate on load. *Test:* set each scope, confirm persistence and namespacing.
7. **F-L1** — `GENERAL_ADDITIONS.md` mirror + opencode.json. *Test:* opencode context contains General text.
8. **F-M5** — precedence § in the .md. *Test:* contradictory layers — agent follows the most specific.
9. **F-M8** — scope block + `STATUS:` parser → problem-status IPC. *Test:* bound session updates only its problem’s status.
10. **F-M7** — wire `assembleContext` IPC into the send pipeline. *Test:* compose includes RAG/problems within token budget.

---

## 7. What to test (post-change verification checklist)

<aside>
🧪

- **Parity:** start the *same* agent + project via New Session and via Compose → the system-prompt portion is byte-identical.
- **H1 regression:** new **claude** session — confirm the Default prompt text is present in what the agent receives.
- **opencode dedup:** new **opencode** session — confirm Default/General appear **once** (from opencode.json), not twice.
- **General scope:** set General in Settings → appears for every project, both paths, and in opencode’s `GENERAL_ADDITIONS.md`.
- **Project scope:** set a Project prompt → appears only for that project; switching projects drops it.
- **Namespace safety:** create a project literally named `claude` → its prompt does not overwrite the claude agent-type prompt.
- **Migration:** load a profile with a legacy bare-projectId key → becomes `project:<id>`, value intact, `__v=2`, persisted once.
- **Toggles:** turn a middle layer off in Compose → only that layer drops; remaining order/precedence intact (id-keyed, not index).
- **Precedence:** General says “never use emojis,” Project says “use emojis” → agent uses emojis (Project wins).
- **Scope binding:** compose against one problem → agent touches only that item and emits a parseable `STATUS:` line that flips the problem status.
- **Default sync:** edit `agent/DEFAULT_SYSTEM_PROMPT.md` → renderer preview + opencode both reflect it; CI `check:prompt` passes.
- **Token check:** compare token count of a compose send before/after for opencode → should drop by ~the Default prompt size.
</aside>

---

## 8. Viewing app-level vs project-level (the visibility ask)

After F-M1/M2/L3, the **Settings → Prompts** tab is the single source of visibility, top-to-bottom by widening-then-narrowing scope: **Default (app baseline) → General (all projects/agents) → Agent-type → Project**. In **Compose**, the same layers render with scoped labels (“General (all projects · all agents)”, “Project: &lt;name&gt;”) and per-layer char counts, so before sending, the user sees exactly which scope contributes what — and the precedence note states which wins.