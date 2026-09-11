# RESULT — Fix Prompt Entry, Sending, and Session UID

## Root Cause Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| System prompt never enters instruction panel | `generatePrompt()` has no system prompt layer; no prop passes it in | Add `systemPromptLayers` prop + include in `generatePrompt()` |
| Useless session topic | Topic is `"Instruction: Xp Yr"` instead of actual instruction text | Use first 60 chars of instruction text |
| Fake session ID | `session-${Date.now()}` generated in renderer | Call `opencode session list`, parse latest ID, fall back gracefully |

---

## File 1: `src/components/InstructionPanel.tsx`

### Change A — Extend props interface

Find `InstructionPanelProps` and add:

```typescript
interface InstructionPanelProps {
  // ... all existing props stay ...
  systemPromptLayers?: Array<{
    label: string;
    content: string;
    color: string;
  }>;
}
```

### Change B — Add toggle state

Add near other `useState` declarations at the top of the component:

```typescript
const [systemPromptExpanded, setSystemPromptExpanded] = useState(false);
const [systemPromptIncluded, setSystemPromptIncluded] = useState(true);
const [layerToggles, setLayerToggles] = useState<Record<number, boolean>>({});
```

### Change C — Modify `generatePrompt()`

Find the existing `generatePrompt` function. Add the system prompt layer as the FIRST section:

```typescript
const generatePrompt = (): string => {
    const parts: string[] = [];

    // ═══ NEW: System prompt layers ═══
    if (systemPromptIncluded && systemPromptLayers && systemPromptLayers.length > 0) {
        const includedContent = systemPromptLayers
            .map((layer, i) => {
                const toggled = layerToggles[i];
                // Default to included unless explicitly toggled off
                if (toggled === false) return '';
                return layer.content?.trim() || '';
            })
            .filter(c => c.length > 0)
            .join('\n\n---\n\n');

        if (includedContent) {
            parts.push(includedContent);
        }
    }

    // ═══ EXISTING: All below unchanged ═══
    if (selectedSkill) {
        const skill = skills?.find(s => s.id === selectedSkill || s.name === selectedSkill);
        if (skill?.content) {
            parts.push(`## Skill: ${skill.name}\n\n${skill.content}`);
        }
    }

    if (selectedProblems.length > 0) {
        const problemParts = selectedProblems.map(pid => {
            const p = problems?.find(prob => prob.id === pid);
            return p ? `### Problem: ${p.title}\n${p.description || p.content || ''}` : '';
        }).filter(Boolean);
        if (problemParts.length > 0) {
            parts.push(`## Problems\n\n${problemParts.join('\n\n')}`);
        }
    }

    if (selectedRequests.length > 0) {
        const requestParts = selectedRequests.map(rid => {
            const r = requests?.find(req => req.id === rid);
            return r ? `### Request: ${r.title}\n${r.description || r.content || ''}` : '';
        }).filter(Boolean);
        if (requestParts.length > 0) {
            parts.push(`## Requests\n\n${requestParts.join('\n\n')}`);
        }
    }

    // ... keep existing checklist, agent files sections exactly as-is ...

    if (customInstruction.trim()) {
        parts.push(`## Instructions\n\n${customInstruction.trim()}`);
    }

    return parts.join('\n---\n\n');
};
```

### Change D — Add System Prompt UI section

Add this JSX block at the TOP of the panel body, before the existing skill/problem sections:

```tsx
{/* ── System Prompt Layers ────────────────────────────────── */}
{systemPromptLayers && systemPromptLayers.length > 0 && (
  <div className="mb-4">
    <div className="flex items-center justify-between mb-1.5">
      <button
        type="button"
        onClick={() => setSystemPromptExpanded(!systemPromptExpanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        {systemPromptExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        System Prompt
        <span className="text-[10px] text-zinc-600">
          ({systemPromptLayers.filter(l => l.content?.trim()).length} layers)
        </span>
      </button>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <span className="text-[10px] text-zinc-500">Include</span>
        <input
          type="checkbox"
          checked={systemPromptIncluded}
          onChange={(e) => setSystemPromptIncluded(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer"
        />
      </label>
    </div>

    {!systemPromptIncluded && (
      <p className="text-[10px] text-zinc-600 pl-4">
        System prompt will not be sent to terminal
      </p>
    )}

    {systemPromptExpanded && systemPromptIncluded && (
      <div className="space-y-1 pl-2 mt-1">
        {systemPromptLayers.map((layer, i) => {
          if (!layer.content?.trim()) return null;
          const isOn = layerToggles[i] !== false;
          return (
            <div
              key={i}
              className={`bg-zinc-900/50 rounded border border-zinc-800/50 overflow-hidden ${!isOn ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium ${layer.color}`}>
                    {layer.label}
                  </span>
                  <span className="text-[9px] text-zinc-600">
                    {layer.content.length.toLocaleString()} chars
                  </span>
                </div>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={(e) => setLayerToggles(prev => ({ ...prev, [i]: e.target.checked }))}
                    className="w-3 h-3 rounded border-zinc-600 bg-zinc-800 text-cyan-500 cursor-pointer"
                  />
                </label>
              </div>
              <div className="px-2 pb-1.5">
                <pre className="text-[10px] text-zinc-500 whitespace-pre-wrap break-words max-h-20 overflow-y-auto font-mono leading-tight">
                  {layer.content.substring(0, 300)}{layer.content.length > 300 ? '...' : ''}
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
)}
```

### Change E — Update send payload

Find the send button's `onClick`. Add `systemPromptIncluded` to the payload:

```typescript
// BEFORE:
<button onClick={() => onSend({
    problems: selectedProblems,
    requests: selectedRequests,
    skill: selectedSkill,
    instruction: customInstruction,
    prompt: generatePrompt()
})}>

// AFTER:
<button onClick={() => onSend({
    problems: selectedProblems,
    requests: selectedRequests,
    skill: selectedSkill,
    instruction: customInstruction,
    prompt: generatePrompt(),
    systemPromptIncluded: systemPromptIncluded,
})}>
```

### Change F — Add missing icon imports

Add `ChevronDown` and `ChevronRight` to the existing `lucide-react` import:

```typescript
import { ..., ChevronDown, ChevronRight } from 'lucide-react';
```

---

## File 2: `src/pages/TerminalPage.tsx`

### Change A — Import DEFAULT_SYSTEM_PROMPT

Add at top of file:

```typescript
import { DEFAULT_SYSTEM_PROMPT } from '../lib/defaults';
```

### Change B — Resolve system prompt layers

Add a `useMemo` near other memos (after state declarations, before effects):

```typescript
const systemPromptLayers = useMemo(() => {
    const layers: Array<{ label: string; content: string; color: string }> = [];

    // Layer 0: Default system prompt (always present)
    layers.push({
        label: 'Default',
        content: DEFAULT_SYSTEM_PROMPT || '',
        color: 'text-cyan-400',
    });

    // Layer 1: General additions from preferences
    const generalAdditions = preferences?.systemPrompts?.generalAdditions || '';
    if (generalAdditions.trim()) {
        layers.push({
            label: 'General',
            content: generalAdditions,
            color: 'text-blue-400',
        });
    }

    // Layer 2: Project-specific prompt
    const projectPrompt = preferences?.systemPrompts?.[selectedProject || ''] || '';
    if (projectPrompt.trim()) {
        layers.push({
            label: 'Project',
            content: projectPrompt,
            color: 'text-purple-400',
        });
    }

    return layers;
}, [preferences, selectedProject]);
```

### Change C — Add opencode session ID resolver

Add this function before `handleInstructionPanelSend`:

```typescript
const resolveOpencodeSessionId = async (cwd?: string): Promise<string | null> => {
    try {
        const result = await window.deskflowAPI?.executeCommand?.(
            'opencode session list',
            cwd || undefined
        );

        if (result?.error) {
            console.warn('[SessionID] opencode CLI error:', result.error);
            return null;
        }

        const stdout = result?.stdout?.trim();
        if (!stdout) {
            console.warn('[SessionID] Empty output from opencode session list');
            return null;
        }

        // Parse tabular output — find session IDs
        const lines = stdout.split('\n').filter(l => l.trim());

        // Strategy 1: Find hex/UUID patterns at line start
        for (let i = 1; i < lines.length; i++) {  // skip header line
            const line = lines[i].trim();
            const idMatch = line.match(/^([a-f0-9\-]{8,})/i);
            if (idMatch) {
                console.log('[SessionID] Resolved:', idMatch[1]);
                return idMatch[1];
            }
        }

        // Strategy 2: Column-based — second line, first column
        if (lines.length >= 2) {
            const firstDataLine = lines[1].trim();
            const columns = firstDataLine.split(/\s{2,}|\t/);
            if (columns[0] && columns[0].length >= 8) {
                console.log('[SessionID] Column parse:', columns[0]);
                return columns[0];
            }
        }

        console.warn('[SessionID] Could not parse session ID');
        return null;
    } catch (err) {
        console.warn('[SessionID] Exception:', err);
        return null;
    }
};
```

### Change D — Rewrite `handleInstructionPanelSend`

Replace the entire function:

```typescript
const handleInstructionPanelSend = useCallback(async (config: {
    problems: string[];
    requests: string[];
    skill?: string;
    instruction: string;
    prompt: string;
    systemPromptIncluded?: boolean;
}) => {
    // ── 1. Resolve target terminal ──────────────────────────
    let resolvedTargetId = activeTerminalId || '';
    if (sendTargetSession?.terminal_id) {
        resolvedTargetId = sendTargetSession.terminal_id;
    }
    if (!resolvedTargetId) {
        const anyActive = sessions.find((s: any) => s.status === 'active' && s.terminal_id);
        if (anyActive) resolvedTargetId = anyActive.terminal_id;
    }
    if (!resolvedTargetId) {
        console.error('[InstructionSend] No target terminal');
        return;
    }

    const proj = projects?.find((p: any) =>
        p.id === selectedProject || p.path === selectedProjectPath
    );
    const cwd = proj?.path || undefined;

    // ── 2. Build meaningful topic ───────────────────────────
    const instructionText = config.instruction?.trim();
    let topic: string;

    if (instructionText && instructionText.length > 0) {
        topic = instructionText.replace(/\n/g, ' ').trim();
        if (topic.length > 60) topic = topic.substring(0, 57) + '...';
    } else {
        const parts: string[] = [];
        if (config.problems.length > 0) parts.push(`${config.problems.length}p`);
        if (config.requests.length > 0) parts.push(`${config.requests.length}r`);
        if (config.skill) parts.push(config.skill);
        topic = parts.length > 0 ? `Instruction: ${parts.join(' ')}` : 'Quick instruction';
    }

    // ── 3. Resolve real opencode session ID ─────────────────
    let sessionId: string;
    let usedRealId = false;

    const opencodeId = await resolveOpencodeSessionId(cwd);
    if (opencodeId) {
        sessionId = opencodeId;
        usedRealId = true;
    } else {
        sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // ── 4. Save session BEFORE terminal write ───────────────
    const existingSession = sessions.find(
        (s: any) => s.terminal_id === resolvedTargetId
    );

    const sessionPayload: any = {
        id: existingSession?.id || sessionId,
        projectId: selectedProject,
        agent: existingSession?.agent || 'claude',
        terminalId: resolvedTargetId,
        topic,
        workingDirectory: cwd || '',
        description: instructionText || undefined,
    };

    if (!existingSession && usedRealId) {
        sessionPayload.id = sessionId;
        sessionPayload.resumeId = sessionId;
    }

    try {
        const saveResult = await window.deskflowAPI?.saveTerminalSession?.(sessionPayload);
        if (!saveResult?.success) {
            console.error('[InstructionSend] Session save failed:', saveResult);
        }
    } catch (err) {
        console.error('[InstructionSend] Session save exception:', err);
    }

    // ── 5. Write prompt to terminal ─────────────────────────
    try {
        await window.deskflowAPI?.terminalWrite?.(resolvedTargetId, config.prompt + '\n');
    } catch (err) {
        console.error('[InstructionSend] terminalWrite failed:', err);
        return;  // Don't update binding if write failed
    }

    // ── 6. Update terminal binding ──────────────────────────
    try {
        await window.deskflowAPI?.updateTerminalBinding?.({
            terminalId: resolvedTargetId,
            activeProblemId: config.problems[0] || undefined,
            activeRequestId: config.requests[0] || undefined,
            sessionContext: JSON.stringify({
                problems: config.problems,
                requests: config.requests,
                skill: config.skill,
                systemPromptIncluded: config.systemPromptIncluded,
            }),
        });
    } catch (err) {
        console.error('[InstructionSend] Binding update failed:', err);
    }

    // ── 7. Feedback ─────────────────────────────────────────
    const toastMsg = usedRealId
        ? `Sent to terminal — session: ${sessionId.substring(0, 12)}${sessionId.length > 12 ? '...' : ''}`
        : 'Sent to terminal';

    // Use whatever toast mechanism exists
    if (typeof setInfoToast === 'function') {
        setInfoToast(toastMsg);
    }

    // ── 8. Cleanup ──────────────────────────────────────────
    if (typeof loadSessions === 'function') loadSessions();
    if (typeof setShowInstructionPanel === 'function') setShowInstructionPanel(false);

}, [activeTerminalId, sendTargetSession, sessions, selectedProject, selectedProjectPath, projects]);
```

### Change E — Pass `systemPromptLayers` prop

Find where `<InstructionPanel` is rendered in JSX and add the prop:

```tsx
<InstructionPanel
    // ... all existing props ...
    systemPromptLayers={systemPromptLayers}
/>
```

---

## Data Flow — Before vs After

### Before (Broken)

```
DEFAULT_SYSTEM_PROMPT
  → Settings page preview only
  → NewSessionDialog preview only
  → ✗ NEVER reaches InstructionPanel
  → ✗ NEVER sent to terminal

InstructionPanel.generatePrompt()
  → skill + problems + requests + checklists + files + custom
  → ✗ NO system prompt layer
       │
       ▼
handleInstructionPanelSend()
  → terminalWrite(prompt)              ← missing system prompt
  → saveTerminalSession({
       id: `session-${Date.now()}`,    ← fake ID
       topic: "Instruction: 0p 0r"     ← useless
    })
```

### After (Fixed)

```
DEFAULT_SYSTEM_PROMPT + general additions + project prompt
  → TerminalPage resolves systemPromptLayers useMemo
  → Passed as prop to InstructionPanel
       │
       ▼
InstructionPanel
  → Shows collapsible System Prompt section with per-layer toggles
  → "Include System Prompt" checkbox (default ON)
  → generatePrompt() = [system layers] + [skill] + [problems] + ... + [custom]
       │
       ▼
handleInstructionPanelSend()
  → resolveOpencodeSessionId(cwd)      ← runs `opencode session list`
  → Parses tabular output for real ID  ← abc123-def456
  → Fallback: session-{ts}-{rand}      ← if CLI fails
  → saveTerminalSession FIRST          ← session exists before AI processes
       id: real opencode ID
       topic: "Fix login bug —..."     ← first 60 chars of instruction
       resumeId: real opencode ID      ← for session resume
  → terminalWrite(fullPrompt)          ← includes system prompt
  → Toast: "Sent — session: abc123..."
```

---

## Verification Checklist

| # | Check | How |
|---|-------|-----|
| 1 | InstructionPanel shows System Prompt section | Open panel → see collapsed "System Prompt" with layer count |
| 2 | Toggle works | Uncheck "Include" → warning text shows → `generatePrompt()` excludes system layers |
| 3 | Per-layer toggle works | Uncheck individual layer → it dims → excluded from prompt |
| 4 | System prompt in terminal output | Send with Include ON → terminal receives system prompt as first section |
| 5 | Session uses real opencode ID | After send → check DB `terminal_sessions` → `id` column has hex UUID, not `session-` prefix |
| 6 | Session topic is meaningful | After send → session list shows first 60 chars of instruction, not "0p 0r" |
| 7 | Graceful fallback when opencode absent | Uninstall opencode → send → still works with generated ID + no crash |
| 8 | Build passes | `npm run build` → 0 errors |