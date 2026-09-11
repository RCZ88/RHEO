# RESULT — Session Creation Flow Fix

## The Fix

Only the `onCreate` handler at `TerminalPage.tsx:3640-3712` changes. Two additions:

1. **After writing initContent** (both branches): wait 2s, call `resolveOpencodeSessionId(cwd)`, use real ID
2. **Save payload**: add `resumeId`, `description`, `autoNamed`

### Modified `onCreate` Handler

Replace the inline handler at line 3640:

```typescript
onCreate={async (config: SessionConfig) => {
  const proj = projects.find(p => p.id === selectedProject);
  const cwd = proj?.path || '';
  const agent = config.agentType;
  const sessionName = config.name.trim() || `Session ${sessions.length + 1}`;
  setShowNewSessionDialog(false);

  // ── Resolve init content from config ─────────────────────────
  let initContent = config.initContent || '';
  if (!config.resumeId && !config.initContent) {
    // Load from INITIALIZE.md, custom init file, problems, requests...
    if (config.includeDefaultInit) {
      const dflt = await window.deskflowAPI?.readProjectFile?.('INITIALIZE.md', cwd);
      if (dflt?.success && dflt.data) initContent = dflt.data;
    }
    if (config.initializeFile) {
      const cust = await window.deskflowAPI?.readInitFile?.(config.initializeFile, cwd);
      if (cust?.success && cust.data) {
        initContent = initContent ? `${initContent}\n\n${cust.data}` : cust.data;
      }
    }
    if (config.problemIds?.length) {
      initContent += `\n## Context: Problems\n${config.problemIds.map((pid: string) => {
        const p = allProblems?.find(prob => prob.id === pid);
        return p ? `- ${p.title} (${p.status})` : '';
      }).filter(Boolean).join('\n')}\n`;
    }
    if (config.requestIds?.length) {
      initContent += `\n## Context: Requests\n${config.requestIds.map((rid: string) => {
        const r = allRequests?.find(req => req.id === rid);
        return r ? `- ${r.title} (${r.status})` : '';
      }).filter(Boolean).join('\n')}\n`;
    }
  }

  // ── Resolve system prompt ─────────────────────────────────────
  let systemPrompt = config.customSystemPrompt || '';
  if (!systemPrompt) {
    const prefs = await window.deskflowAPI?.getPreferences?.();
    const prompts = prefs?.systemPrompts || {};
    systemPrompt = prompts[agent] || prompts['claude'] || '';
  }

  // ── Write to terminal ────────────────────────────────────────
  let targetTerminalId = '';

  if (config.terminalMode === 'select' && config.selectedTerminal) {
    // Write to EXISTING terminal
    targetTerminalId = config.selectedTerminal;
    if (initContent) {
      await window.deskflowAPI?.terminalWrite?.(targetTerminalId, initContent + '\n');
      await new Promise(r => setTimeout(r, 500));
    }
    if (systemPrompt) {
      await window.deskflowAPI?.terminalWrite?.(targetTerminalId, systemPrompt + '\n');
      await new Promise(r => setTimeout(r, 500));
    }
  } else {
    // Create NEW terminal
    targetTerminalId = `term-${Date.now()}`;
    setTerminalTabs((prev: any) => ({
      ...prev,
      [targetTerminalId]: { name: sessionName, agent, modelTier: config.modelTier }
    }));
    setActiveTerminalId(targetTerminalId);
    const updatedLayout = insertIntoLayout(terminalLayout, targetTerminalId);
    setTerminalLayout(updatedLayout);
    saveLayout(updatedLayout);
    await initializeTerminal(targetTerminalId, agent, undefined, initContent, systemPrompt);
  }

  // ── Resolve opencode session ID ──────────────────────────────
  let opencodeId: string | null = null;
  
  if (initContent) {
    // Wait for opencode to process the prompt and create its session
    await new Promise(r => setTimeout(r, 2000));
    opencodeId = await resolveOpencodeSessionId(cwd);
  }

  const sessionId = opencodeId || config.id;

  // ── Save session with full payload ───────────────────────────
  const sessionResult = await window.deskflowAPI?.saveTerminalSession?.({
    id: sessionId,
    projectId: selectedProject,
    agent,
    terminalId: targetTerminalId,
    topic: sessionName,
    workingDirectory: proj?.path || '',
    description: initContent || '',
    autoNamed: 1,
    resumeId: opencodeId || undefined,
  });

  if (sessionResult?.success) {
    await window.deskflowAPI?.saveSessionConfig?.(config.id, config, proj?.path);
    loadSessions();
  }
}}
```

---

## What Changed (Diff)

### Change 1: Added opencode session ID resolution after terminal write

**Before:**
```typescript
// Immediately after writing to terminal — no wait, no resolution
const sessionResult = await window.deskflowAPI?.saveTerminalSession?.({
  id: config.id,
  ...
});
```

**After:**
```typescript
// Wait for opencode to create its session, then resolve real ID
let opencodeId: string | null = null;

if (initContent) {
  await new Promise(r => setTimeout(r, 2000));
  opencodeId = await resolveOpencodeSessionId(cwd);
}

const sessionId = opencodeId || config.id;
```

### Change 2: Added missing fields to save payload

**Before:**
```typescript
const sessionResult = await window.deskflowAPI?.saveTerminalSession?.({
  id: config.id,
  projectId: selectedProject,
  agent,
  terminalId: targetTerminalId,
  topic: sessionName,
  workingDirectory: proj?.path || '',
  // Missing: resumeId, description, autoNamed
});
```

**After:**
```typescript
const sessionResult = await window.deskflowAPI?.saveTerminalSession?.({
  id: sessionId,
  projectId: selectedProject,
  agent,
  terminalId: targetTerminalId,
  topic: sessionName,
  workingDirectory: proj?.path || '',
  description: initContent || '',
  autoNamed: 1,
  resumeId: opencodeId || undefined,
});
```

### Change 3: Session config save uses original config.id (not sessionId)

```typescript
// Keep config.id for saveSessionConfig — it's the internal reference
await window.deskflowAPI?.saveSessionConfig?.(config.id, config, proj?.path);
```

This preserves the mapping between the dialog config and the session, even when the DB session ID is the opencode ID.

---

## Edge Case Handling

| Case | Behavior |
|------|----------|
| `initContent` is empty | Skip the 2s wait + resolution. Use `config.id` as session ID. No `resumeId`. |
| `resolveOpencodeSessionId` returns null | Use `config.id` as fallback. No `resumeId` set. |
| `resolveOpencodeSessionId` returns real ID | Use it as `id` AND `resumeId`. Enables resume. |
| `terminalMode === 'select'` | Same flow — write, wait, resolve, save. Uses existing terminal. |
| `initializeTerminal` already wrote initContent | The 2s wait starts AFTER `initializeTerminal` returns. opencode has already received the prompt. |
| opencode not installed | `resolveOpencodeSessionId` catches the error, returns null. Falls back to `config.id`. |
| Two rapid creates | Each gets its own 2s wait. `opencode session list` returns the latest (top) session. |

---

## Verification Checklist

- [ ] After clicking Create in NewSessionDialog with a prompt, session appears in sidebar with the opencode session ID (hex format like `abc123-def456`)
- [ ] `resumeId` field in DB contains the real opencode session ID
- [ ] Closing and reopening the session via resume works
- [ ] Empty prompt (no initContent) still creates a session with generated ID — no crash, no unnecessary 2s delay
- [ ] `terminalMode === 'select'` path also captures session ID after writing to existing terminal
- [ ] `description` field populated with the initContent text
- [ ] `autoNamed` set to 1
- [ ] Build passes with `npm run build`