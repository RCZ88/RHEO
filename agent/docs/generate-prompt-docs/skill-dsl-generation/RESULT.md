# RESULT — Skill DSL Generation via Terminal Agent

## Architecture

```
User clicks "DSL" button on skill card
  → DSLGenerationModal opens
  → User picks terminal + adds optional instructions
  → Clicks "Send to Terminal Agent"
  → Prompt constructed (skill info + read SKILL_DSL_GUIDE.md instruction)
  → terminalWrite(prompt) to selected terminal
  → AI agent reads guide, reads SKILL.md, generates frontmatter, writes file
  → Skills auto-refresh via 10s polling
```

**No new IPC handlers. No new preload bridges.** Uses existing `terminalWrite` infrastructure.

---

## File 1: `src/components/DSLGenerationModal.tsx` (NEW)

```tsx
import { useState, useEffect } from 'react';
import { X, Terminal, Send, FileText, Sparkles, Loader2, ChevronRight } from 'lucide-react';

interface DSLGenerationModalProps {
  skill: {
    id: string;
    name: string;
    description: string;
    content?: string;
    filePath?: string;
  };
  terminals: Array<{
    id: string;
    label?: string;
    agent?: string;
    topic?: string;
  }>;
  activeTerminalId: string | null;
  onClose: () => void;
  onSend: (terminalId: string, prompt: string) => Promise<void>;
}

const STAGES = [
  { key: 'compose', label: 'Compose', icon: FileText },
  { key: 'sending', label: 'Send to Agent', icon: Send },
  { key: 'done', label: 'Done', icon: Sparkles },
] as const;

export default function DSLGenerationModal({
  skill,
  terminals,
  activeTerminalId,
  onClose,
  onSend,
}: DSLGenerationModalProps) {
  const [selectedTerminal, setSelectedTerminal] = useState(activeTerminalId || '');
  const [customInstructions, setCustomInstructions] = useState('');
  const [stage, setStage] = useState<'compose' | 'sending' | 'done'>('compose');
  const [error, setError] = useState<string | null>(null);

  const availableTerminals = terminals.filter(t => t.id);

  const buildPrompt = (): string => {
    const parts: string[] = [];

    parts.push(`Generate DSL frontmatter for the skill "${skill.name}".`);
    parts.push('');
    parts.push(`Description: ${skill.description || 'No description available'}`);

    if (skill.filePath) {
      parts.push(`Skill file path: ${skill.filePath}`);
    }

    parts.push('');
    parts.push('Read `agent/skills/SKILL_DSL_GUIDE.md` for the DSL specification — it defines');
    parts.push('the YAML frontmatter schema for `inputs` (form controls) and `outputs`');
    parts.push('(produced results) sections. The type mapping table tells you which widget');
    parts.push('maps to which type.');
    parts.push('');

    if (skill.filePath) {
      parts.push(`Read the current skill file at: ${skill.filePath}`);
    } else {
      parts.push(`Read the current skill file at: agent/skills/${skill.id}/SKILL.md`);
    }

    parts.push('');
    parts.push('Analyze the skill\'s content and generate appropriate `inputs` and `outputs`');
    parts.push('sections based on what the skill does and what configurable parameters it needs.');
    parts.push('');
    parts.push('Requirements:');
    parts.push('- Generate "inputs" entries with: name, type, required, description, group');
    parts.push('- Use the type mapping table from SKILL_DSL_GUIDE.md to pick the right widget');
    parts.push('- Set sensible defaults, placeholders, min/max ranges where applicable');
    parts.push('- For enum/multienum types, include explicit "choices" arrays');
    parts.push('- Group related inputs together using the "group" field');
    parts.push('- Include "outputs" when the skill produces structured results');
    parts.push('- Preserve ALL existing frontmatter fields (id, name, description, tags, etc.)');
    parts.push('- Only add/replace the inputs and outputs sections');

    if (customInstructions.trim()) {
      parts.push('');
      parts.push('Additional instructions from the user:');
      parts.push(customInstructions.trim());
    }

    parts.push('');
    parts.push('When done, update the SKILL.md file with the generated frontmatter.');

    return parts.join('\n');
  };

  const handleSend = async () => {
    if (!selectedTerminal) {
      setError('Please select a terminal');
      return;
    }

    setError(null);
    setStage('sending');

    try {
      const prompt = buildPrompt();
      await onSend(selectedTerminal, prompt);
      setStage('done');
    } catch (err) {
      setError((err as Error).message || 'Failed to send prompt to terminal');
      setStage('compose');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Generate DSL UI</h2>
            <span className="text-[10px] text-zinc-500 font-mono">{skill.id}</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Progress steps ─────────────────────────────── */}
        <div className="flex items-center gap-2 px-5 py-3 bg-gray-950/50 border-b border-gray-800">
          {STAGES.map((s, i) => {
            const stageKeys = STAGES.map(x => x.key);
            const currentIdx = stageKeys.indexOf(stage);
            const thisIdx = i;
            const isDone = thisIdx < currentIdx;
            const isActive = thisIdx === currentIdx;
            const Icon = s.icon;

            return (
              <div key={s.key} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="w-3 h-3 text-gray-700" />}
                <div className={`flex items-center gap-1 ${isActive ? 'text-amber-400' : isDone ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {stage === 'sending' && isActive ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                  <span className="text-[10px] font-medium">{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Body ───────────────────────────────────────── */}
        <div className="px-5 py-4 space-y-4">
          {/* Skill info */}
          <div className="bg-gray-950/50 rounded-lg p-3 border border-gray-800">
            <span className="text-[10px] text-amber-400 font-medium">Skill</span>
            <p className="text-xs text-white font-medium mt-0.5">{skill.name}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
              {skill.description || 'No description'}
            </p>
          </div>

          {/* Terminal picker */}
          <div>
            <label className="text-[10px] font-medium text-gray-400 mb-1.5 block">
              Target Terminal <span className="text-red-400">*</span>
            </label>
            {availableTerminals.length === 0 ? (
              <p className="text-[10px] text-red-400">No terminals available — open a terminal first</p>
            ) : (
              <select
                value={selectedTerminal}
                onChange={(e) => setSelectedTerminal(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
              >
                <option value="">Select a terminal...</option>
                {availableTerminals.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.id.substring(0, 20)}{t.id.length > 20 ? '...' : ''}
                    {t.agent ? ` — ${t.agent}` : ''}
                    {t.topic ? ` — ${t.topic.substring(0, 30)}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Custom instructions */}
          <div>
            <label className="text-[10px] font-medium text-gray-400 mb-1.5 block">
              Custom Instructions <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Add a 'Style' enum input with minimal/standard/detailed choices, group output settings together..."
              rows={3}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-[11px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          {/* Prompt preview (collapsible) */}
          <details className="group">
            <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 transition-colors">
              Preview prompt →
            </summary>
            <pre className="mt-1.5 text-[9px] text-gray-500 bg-gray-950 rounded-lg p-2.5 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono border border-gray-800">
              {buildPrompt()}
            </pre>
          </details>

          {/* Error */}
          {error && (
            <div className="bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg px-3 py-2 text-[10px]">
              {error}
            </div>
          )}

          {/* Done state */}
          {stage === 'done' && (
            <div className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg px-3 py-2.5 text-[10px]">
              <span className="font-medium">Prompt sent!</span> The terminal agent will read the DSL guide,
              analyze the skill, and update the SKILL.md file. Check the terminal for progress.
              Skills list will refresh automatically.
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
          >
            {stage === 'done' ? 'Close' : 'Cancel'}
          </button>
          {stage === 'compose' && (
            <button
              onClick={handleSend}
              disabled={!selectedTerminal || availableTerminals.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3 h-3" />
              Send to Terminal Agent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## File 2: `src/pages/TerminalPage.tsx` — Integration

### 2a. New State Variables

Add near existing state declarations (~line 155-190):

```typescript
// DSL generation modal
const [dslSkill, setDslSkill] = useState<any>(null);
const [showDSLModal, setShowDSLModal] = useState(false);
```

### 2b. DSL Modal Handler

```typescript
const openDSLModal = (skill: any) => {
  setDslSkill(skill);
  setShowDSLModal(true);
};

const closeDSLModal = () => {
  setDslSkill(null);
  setShowDSLModal(false);
};

const handleDSLSend = async (terminalId: string, prompt: string) => {
  await window.deskflowAPI?.terminalWrite?.(terminalId, prompt + '\n');
};
```

### 2c. DSL Button on Each Skill Card

Find where skill cards are rendered in the Skills tab content. Each skill card should already have "Use" and "Edit" buttons. Add the amber DSL button:

```tsx
{/* Inside each skill card, after existing action buttons */}
<button
  onClick={() => openDSLModal(skill)}
  className="px-2 py-1 rounded text-[10px] font-medium bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 transition-colors"
  title="Generate DSL UI frontmatter via terminal agent"
>
  DSL
</button>
```

If the skill cards don't currently have action buttons, add them. The typical pattern for a skill card in the sidebar:

```tsx
<div className="flex items-center gap-1.5 mt-1.5">
  <button
    onClick={() => handleUseSkill(skill)}
    className="px-2 py-1 rounded text-[10px] font-medium bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors"
  >
    Use
  </button>
  <button
    onClick={() => handleEditSkill(skill)}
    className="px-2 py-1 rounded text-[10px] font-medium bg-zinc-700/50 text-zinc-400 border border-zinc-600/30 hover:bg-zinc-700 transition-colors"
  >
    Edit
  </button>
  <button
    onClick={() => openDSLModal(skill)}
    className="px-2 py-1 rounded text-[10px] font-medium bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 transition-colors"
    title="Generate DSL UI frontmatter via terminal agent"
  >
    DSL
  </button>
</div>
```

### 2d. Render the Modal

Add near where other modals/dialogs are rendered (alongside FeaturesDialog, GeneralistDialog, etc.):

```tsx
{/* ── DSL Generation Modal ─────────────────────────────── */}
{showDSLModal && dslSkill && (
  <DSLGenerationModal
    skill={{
      id: dslSkill.id,
      name: dslSkill.name,
      description: dslSkill.description,
      content: dslSkill.content,
      filePath: dslSkill.filePath,
    }}
    terminals={terminalTabs.map(t => ({
      id: t.id,
      agent: sessions.find((s: any) => s.terminal_id === t.id)?.agent,
      topic: sessions.find((s: any) => s.terminal_id === t.id)?.topic,
    }))}
    activeTerminalId={activeTerminalId}
    onClose={closeDSLModal}
    onSend={handleDSLSend}
  />
)}
```

### 2e. Add Import

```typescript
import DSLGenerationModal from '../components/DSLGenerationModal';
```

---

## File 3: `agent/skills/SKILL_DSL_GUIDE.md` (NEW)

This is the reference document that the terminal AI agent reads to understand the DSL schema:

```markdown
# Skill DSL Reference Guide

This document defines the YAML frontmatter schema for DeskFlow skill inputs and outputs.
When generating DSL frontmatter for a skill, follow this specification exactly.

## Input Schema

Each input item in the `inputs` list has these fields:

```yaml
inputs:
  - name: Input Label          # Required — display label
    type: enum                 # Required — data type (see type table)
    widget: select             # Optional — UI control (auto-inferred if omitted)
    choices:                   # Required for enum/multienum — valid options
      - option1
      - option2
      - option3
    default: option2           # Optional — initial value
    description: Help text     # Optional — shown below the control
    required: true             # Optional — shows * indicator (default: false)
    placeholder: Pick one…     # Optional — placeholder text for empty inputs
    source: user               # Optional — who provides this: user, system, agent
    min: 1                     # Optional — minimum (number/slider)
    max: 100                   # Optional — maximum (number/slider)
    step: 5                    # Optional — step increment (number/slider)
    validation: ^pattern$      # Optional — regex validation pattern
    validationMessage: Error!  # Optional — error message on validation fail
    group: Settings            # Optional — groups related inputs together
    language: python           # Optional — language hint (for type: code)
```

## Type → Widget Mapping

When `widget` is not specified, infer from `type`:

| type | Auto widget | Condition |
|------|-------------|-----------|
| enum | select | — |
| multienum | tags | — |
| boolean | switch | — |
| number | slider | If min AND max are set |
| number | text | If min/max not set |
| text | text | — |
| textarea | textarea | — |
| code | code | — |
| file | file | — |
| markdown | textarea | — |
| list | tags | — |

## Widget Override Options

| type | Allowed widgets |
|------|----------------|
| enum | select, radio |
| multienum | tags, checkbox |
| boolean | switch, checkbox |
| number | slider, text |
| text | text, textarea |
| code | code, textarea |
| list | tags |

## Output Schema

```yaml
outputs:
  - name: Output Label
    type: markdown            # Data type of the output
    description: What it contains
    preview: true             # Optional — show inline preview
```

## Groups

Use `group` to organize related inputs under collapsible section headers:

```yaml
inputs:
  - name: Framework
    type: enum
    choices: [react, vue, svelte]
    group: Technology         # ← grouped
  - name: Style
    type: enum
    choices: [minimal, standard, detailed]
    group: Technology         # ← same group
  - name: Max Tokens
    type: number
    min: 100
    max: 8000
    step: 100
    group: Parameters         # ← different group
```

Group headers render as: `TECHNOLOGY (2)`, `PARAMETERS (1)`

## Examples

### Simple Skill with Enum and Text

```yaml
inputs:
  - name: Search Query
    type: text
    required: true
    placeholder: Enter search topic...
  - name: Depth Level
    type: enum
    choices: [surface, standard, deep]
    default: standard
    description: How thorough the investigation should be
outputs:
  - name: Research Report
    type: markdown
    description: Comprehensive research findings
    preview: true
  - name: Source List
    type: list
    description: All referenced sources
```

### Advanced Skill with Groups and Multiple Widget Types

```yaml
inputs:
  - name: Prompt Type
    type: enum
    choices: [design, engineering, research, debugging]
    default: design
    widget: radio
    group: Configuration
  - name: Output Format
    type: enum
    choices: [markdown, json, yaml]
    default: markdown
    group: Configuration
  - name: Max Tokens
    type: number
    min: 100
    max: 8000
    step: 100
    default: 2000
    group: Configuration
  - name: Include Examples
    type: boolean
    default: true
    group: Options
  - name: Custom Instructions
    type: textarea
    placeholder: Extra instructions for this specific generation...
    group: Options
  - name: Code Snippet
    type: code
    language: typescript
    group: Advanced
  - name: Reference File
    type: file
    description: Optional reference document
    group: Advanced
  - name: Tags
    type: multienum
    choices: [frontend, backend, api, ui, database, testing]
    group: Categorization
outputs:
  - name: Generated Prompt
    type: markdown
    preview: true
  - name: Token Estimate
    type: number
```

## Rules

1. Every input MUST have `name` and `type`
2. `enum` and `multienum` types MUST have `choices`
3. `choices` can be inline `[a, b, c]` or indented list
4. `default` must match one of the `choices` for enum types
5. `group` is optional but recommended for 4+ inputs
6. Preserve ALL existing frontmatter fields — only add/replace `inputs` and `outputs`
7. Never remove `id`, `name`, `category`, `tags`, or other metadata fields
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Skills Tab — Skill Card                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ generate-prompt                          [Use][Edit][DSL]│   │
│  │ Generate high-fidelity design prompts                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                           │                     │
│                                    Click DSL                    │
│                                           │                     │
│                                           ▼                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DSLGenerationModal                                       │   │
│  │                                                          │   │
│  │ Skill: generate-prompt                                   │   │
│  │ Terminal: [term-1234 ▼]                                  │   │
│  │ Instructions: [optional textarea]                        │   │
│  │                                                          │   │
│  │ [Preview prompt →]                                       │   │
│  │                                                          │   │
│  │                           [Cancel] [Send to Terminal Agent]│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                           │                     │
│                                    Click Send                   │
│                                           │                     │
│                                           ▼                     │
│  terminalWrite(termId, prompt)                                  │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Terminal (opencode / claude)                              │   │
│  │                                                          │   │
│  │ > Generate DSL frontmatter for the skill "generate-      │   │
│  │   prompt"...                                              │   │
│  │                                                          │   │
│  │   Agent reads: agent/skills/SKILL_DSL_GUIDE.md           │   │
│  │   Agent reads: agent/skills/generate-prompt/SKILL.md     │   │
│  │   Agent generates: inputs/outputs YAML                   │   │
│  │   Agent writes: updated SKILL.md with new frontmatter    │   │
│  │                                                          │   │
│  │   ✅ Updated SKILL.md with 8 inputs and 3 outputs        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Skills tab auto-refreshes (10s polling) → shows new UI config  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

| Step | File | Action | Verify |
|------|------|--------|--------|
| 1 | `agent/skills/SKILL_DSL_GUIDE.md` | Create the DSL reference guide | File exists with full spec |
| 2 | `src/components/DSLGenerationModal.tsx` | Create modal component | No import errors |
| 3 | `src/pages/TerminalPage.tsx` | Add state, handler, import, modal render | `npm run build` passes |
| 4 | `src/pages/TerminalPage.tsx` | Add DSL button to skill cards | Button appears on each skill |
| 5 | Manual test | Click DSL → pick terminal → send → agent updates SKILL.md | Skills list refreshes with new config |

---

## Edge Cases

| Case | Handling |
|------|----------|
| No terminals open | Dropdown empty + red warning text + Send button disabled |
| Terminal disconnected mid-generation | Agent handles gracefully; no retry from our side |
| SKILL_DSL_GUIDE.md missing | Agent may still generate reasonable frontmatter from context; prompt mentions it as a read target |
| SKILL.md read-only | Agent will report write error in terminal output |
| Skill already has inputs/outputs | Prompt says "preserve existing frontmatter, only add/replace inputs and outputs" |
| Agent generates invalid YAML | Next time SkillsService loads the skill, parser will fall back gracefully (missing fields = undefined) |
| User closes modal before send | No side effects — just cleanup state |
| Multiple DSL generations for same skill | Each overwrites previous frontmatter; only latest is kept |
| `terminalWrite` fails | `handleDSLSend` throws → caught in modal → error shown |