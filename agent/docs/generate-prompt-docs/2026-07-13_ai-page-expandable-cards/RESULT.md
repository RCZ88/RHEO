# PATCH.md — Critical Integration Fixes for RESULT (5).md

> **Purpose:** This document patches the bugs in RESULT (5).md that cause layout collapse, broken typing, missing connectors, and dead buttons. Give this to your AI **alongside** RESULT (5).md. The AI must follow this document's instructions **in addition to** RESULT (5).md, and where the two conflict, **THIS DOCUMENT WINS.**

---

## MANDATORY RULES (THE AI MUST OBEY THESE)

1. **DO NOT touch `AiPage.tsx`.** It is correct. It is the source of truth for prop APIs. Every component must conform to what AiPage.tsx passes — not the other way around.
2. **DO NOT replace `deck.css`.** Start with RESULT (5).md's deck.css, then **APPEND** the classes listed in Fix 6 below. Never delete existing classes.
3. **DO NOT use RESULT (5).md's versions of `ChatPanel.tsx`, `MessageBubble.tsx`, or `ChatEmptyState.tsx`.** They change prop APIs and break everything. Use the ORIGINAL versions from CONTEXT_BUNDLE.md with the one-line fixes specified below.
4. **DO NOT wrap `ChatPanel` in a `dk-chat-card` div.** ChatPanel already renders its own `dk-card dk-acc dk-pink dk-deck` wrapper. Wrapping it again creates double borders and broken flex.
5. **EVERY prop name a component receives must EXACTLY match what its parent passes.** Before writing any component, trace the parent's JSX and copy prop names verbatim.

---

## BUG INDEX

| # | Bug | Root Cause | Fix Section |
|---|-----|-----------|-------------|
| 1 | Everything stacked vertically, no layout | AiPageDeck renders its own topbar + statusbar ON TOP of AiPage.tsx's topbar + subnav — 4 bars stacked before chat even starts | Fix 1 |
| 2 | Typing in chat doesn't work | Original ChatPanel passes `onValueChange=` to ChatInput, but ChatInput expects `onChange=` — prop name mismatch, handler never fires | Fix 3a |
| 3 | Connectors panel vanished | RESULT (5).md's AiPageDeck drops `connectorsSlot` entirely — never rendered | Fix 1 |
| 4 | ConnectorsPanel crash / blank | AiPage.tsx passes `state`, `errorMessage`, `onAdd`, `onToast`, `onRefresh` — RESULT (5).md's ConnectorsPanel doesn't accept any of them | Fix 2 |
| 5 | ChatPanel header gone (title, provider, online, reset) | RESULT (5).md's ChatPanel deletes the entire `dk-deckhead` header | Fix 3b |
| 6 | MessageBubble crash | RESULT (5).md changes props from individual (`role`, `content`, `parsed`) to a single `message` object — parent passes individual props | Fix 3c |
| 7 | Suggestion chips do nothing | RESULT (5).md changes `onPick` to `onSuggestion` — parent still calls `onPick` | Fix 3d |
| 8 | Old CSS classes missing → unstyled components | RESULT (5).md's deck.css is a full replacement that deletes every class AiPage.tsx, ChatPanel, QuickCommands, etc. depend on | Fix 4 |

---

## FIX 1: AiPageDeck.tsx — Remove Duplicate Bars, Restore Connectors

**Reference:** RESULT (5).md section 2.1

**Problem:** RESULT (5).md's AiPageDeck renders a `dk-topbar` (brand + History + Settings) AND a `dk-statusbar` (glance metrics + connector dots). But AiPage.tsx ALREADY renders its own `dk-topbar` (brand + mode + provider + online) and `dk-subnav` (tabs). This creates 4 stacked bars before the chat. Additionally, `connectorsSlot` is accepted as a prop but NEVER rendered — connectors disappear entirely.

**Fix:** Replace AiPageDeck.tsx with this. It renders ONLY: ChatPanel (which has its own card wrapper and header), connectors slot, strip toggle, and strip. No topbar, no statusbar, no footer, no `dk-chat-card` wrapper.

```tsx
import "./deck.css"
import { ChatPanel } from "../chat/ChatPanel"
import type { AgentStep } from "../chat/AgentProgressBar"
import type { ChatSuggestion } from "../chat/ChatEmptyState"
import type { ChatMessage } from "../chat/ChatPanel"
import type { CardAction } from "../chat/parsed"
import type { ReactNode } from "react"
import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

export interface DeckProps {
  messages: ChatMessage[]
  input: string
  onInputChange: (v: string) => void
  onSend: (text: string) => void
  onStop?: () => void
  onReset?: () => void
  onCardAction?: (a: CardAction) => void
  streaming?: boolean
  thinking?: boolean
  provider?: string
  online?: boolean
  suggestions?: ChatSuggestion[]
  agentSteps?: AgentStep[]
  agentStatus?: string
  listening?: boolean
  onToggleVoice?: () => void
  voiceSupported?: boolean
  actionResults?: Record<string, "running" | "done" | "error">
  connectorSyncing?: Record<string, true>
  contextWarnings?: string[]
  dismissError?: (index: number) => void
  onModelChange?: (provider: string, model: string) => void
  modeLabel?: string
  glanceMetrics?: { label: string; value: string }[]
  connectorsSlot?: ReactNode
  focusSlot?: ReactNode
  planSlot?: ReactNode
  reflectSlot?: ReactNode
  historySlot?: ReactNode
  memoryChips?: { id: string; text: string }[]
  onNewThread?: () => void
  connectorStatus?: { unreadCount: number; todayEventCount: number; lastSyncTime?: string; syncing?: boolean }
  onExpandConnectors?: () => void
  onOpenSettings?: () => void
  onOpenHistory?: () => void
}

export function AiPageDeck(props: DeckProps) {
  const [stripExpanded, setStripExpanded] = useState(false)
  const [connectorsExpanded, setConnectorsExpanded] = useState(true)
  const hasStripContent = !!(props.focusSlot || props.planSlot || props.reflectSlot)

  return (
    <>
      {/*
        NO topbar — AiPage.tsx renders dk-topbar (brand + mode + provider + online).
        NO statusbar — AiPage.tsx's topbar chips already show status.
        DO NOT add them back.
      */}

      {/* Chat panel — ChatPanel renders its own dk-card dk-acc dk-pink dk-deck wrapper.
          DO NOT wrap it in another div. */}
      <ChatPanel
        messages={props.messages}
        streaming={props.streaming}
        thinking={props.thinking}
        provider={props.provider}
        online={props.online}
        input={props.input}
        onInputChange={props.onInputChange}
        onSend={props.onSend}
        onStop={props.onStop}
        onReset={props.onReset}
        onCardAction={props.onCardAction}
        suggestions={props.suggestions}
        agentSteps={props.agentSteps}
        agentStatus={props.agentStatus}
        listening={props.listening}
        onToggleVoice={props.onToggleVoice}
        voiceSupported={props.voiceSupported}
        actionResults={props.actionResults}
        connectorSyncing={props.connectorSyncing}
        contextWarnings={props.contextWarnings}
        dismissError={props.dismissError}
        onModelChange={props.onModelChange}
        historySlot={props.historySlot}
        memoryChips={props.memoryChips}
        onNewThread={props.onNewThread}
        connectorStatus={props.connectorStatus}
        onExpandConnectors={props.onExpandConnectors}
      />

      {/* Connectors slot — MUST be rendered. AiPage.tsx passes it. */}
      {props.connectorsSlot && (
        <>
          <button
            className="dk-strip-toggle"
            onClick={() => setConnectorsExpanded(v => !v)}
            aria-expanded={connectorsExpanded}
            style={{ marginTop: 16 }}
          >
            {connectorsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {connectorsExpanded ? "Hide Connectors" : "Show Connectors"}
          </button>
          <div
            className="dk-conn-section"
            style={{
              overflow: "hidden",
              maxHeight: connectorsExpanded ? "2000px" : "0",
              opacity: connectorsExpanded ? 1 : 0,
              transition: "max-height 0.3s ease, opacity 0.2s ease",
            }}
          >
            {props.connectorsSlot}
          </div>
        </>
      )}

      {/* Strip toggle + strip (Focus / Plan / Reflect) */}
      {hasStripContent && (
        <button
          className="dk-strip-toggle"
          onClick={() => setStripExpanded(v => !v)}
          aria-expanded={stripExpanded}
        >
          {stripExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {stripExpanded ? "Hide Focus / Plan / Reflect" : "Show Focus / Plan / Reflect"}
        </button>
      )}

      <div className={`dk-strip ${stripExpanded ? "expanded" : "collapsed"}`}>
        {props.focusSlot ? <>{props.focusSlot}</> : null}
        {props.planSlot ? <>{props.planSlot}</> : null}
        {props.reflectSlot ? <>{props.reflectSlot}</> : null}
      </div>
    </>
  )
}
```

**Key changes from RESULT (5).md section 2.1:**
- DELETED: entire `dk-topbar` block (brand + History + Settings buttons)
- DELETED: entire `dk-statusbar` block (glance metrics + connector dots)
- DELETED: `dk-chat-card` wrapper div around ChatPanel
- DELETED: `dk-foot` footer div
- ADDED: connectorsSlot rendering with expand/collapse toggle
- ADDED: `connectorsExpanded` state (default true so connectors are visible)

---

## FIX 2: ConnectorsPanel.tsx — Fix Prop API to Match AiPage.tsx

**Reference:** RESULT (5).md section 2.8 — **DISCARD IT ENTIRELY.**

**Problem:** AiPage.tsx passes these props:
```tsx
<ConnectorsPanel
  state={goalsDataState}           // 'loading' | 'error' | 'empty' | 'ready'
  connectors={connectors}           // { id, name, status: 'ready'|'error'|'idle', detail, itemCount, type }
  errorMessage={goalsError}         // string | undefined
  onRetry={loadGoals}               // () => void
  onAdd={() => setShowConnectorSetup(true)}
  onSync={async (id) => { ... }}    // (id: string) => Promise<void>
  onToast={showToast}               // (msg: string, type?: 'success'|'error'|'info') => void
  onRefresh={loadConnectors}        // () => void
/>
```

RESULT (5).md's ConnectorsPanel expects completely different props (`ConnectorConfig[]`, `onDelete`, `onTest`, `onSyncAll`, `loading`, `error`). None of these match. The component crashes or renders nothing.

**Fix:** Start with the ORIGINAL ConnectorsPanel from CONTEXT_BUNDLE.md section 9. Apply these specific changes:

### 2a. Change the interface (replace the `ConnectorsPanelProps` interface)

```tsx
export interface Connector {
  id: string
  name: string
  status: "ready" | "busy" | "error" | "idle"
  detail?: string
  itemCount?: number
  iconUrl?: string
  type?: string
}

interface ConnectorsPanelProps {
  // From AiPage.tsx — THESE ARE THE CANONICAL PROP NAMES
  state?: "loading" | "error" | "empty" | "ready"
  connectors: Connector[]
  errorMessage?: string
  onRetry?: () => void
  onAdd?: () => void
  onSync?: (id: string) => void | Promise<void>
  onToast?: (msg: string, type?: "success" | "error" | "info") => void
  onRefresh?: () => void
  // Optional — not passed by AiPage.tsx but kept for backward compat
  onDelete?: (id: string) => Promise<void>
  onTest?: (id: string) => Promise<void>
  onSyncAll?: () => Promise<void>
}
```

### 2b. Inside the component, replace state checks

Find every reference to `props.loading` and replace with:
```tsx
props.state === "loading"
```

Find every reference to `props.error` and replace with:
```tsx
props.errorMessage
```

Find the empty-state check and replace with:
```tsx
if (props.state === "empty" || filteredConnectors.length === 0)
```

Find the error-state check and replace with:
```tsx
if (props.state === "error" || props.errorMessage)
```

### 2c. Add Sync All support (since AiPage.tsx doesn't pass onSyncAll)

Inside the component, add this handler:
```tsx
const handleSyncAll = useCallback(async () => {
  if (!props.onSync) return
  setSyncingAll(true)
  try {
    for (const c of props.connectors) {
      if (c.status === "ready" || c.status === "idle") {
        await props.onSync(c.id)
      }
    }
    props.onRefresh?.()
    props.onToast?.("All connectors synced", "success")
  } catch (e: any) {
    props.onToast?.(e.message || "Sync failed", "error")
  } finally {
    setSyncingAll(false)
  }
}, [props.onSync, props.connectors, props.onRefresh, props.onToast])
```

### 2d. Add Refresh button in the header

In the header row (where the "Sync All" button is), add a Refresh button:
```tsx
{props.onRefresh && (
  <button onClick={props.onRefresh} className="dk-topbar-btn" style={{ height: 26, padding: "0 10px" }}>
    <RefreshCw size={11} />
    Refresh
  </button>
)}
```

### 2e. Keep everything else from the original

The connector card rendering, item expansion, search, filter, ConnectorItemModal — all stay exactly as in CONTEXT_BUNDLE.md section 9. Only the prop interface and state checks change.

---

## FIX 3: Restore Original Components (DO NOT Use RESULT 5's Versions)

### 3a. ChatPanel.tsx — Use ORIGINAL + Fix One Prop Name

**Reference:** RESULT (5).md section 2.2 — **DISCARD IT ENTIRELY.**

**Problem 1:** RESULT (5).md's ChatPanel deletes the header (`dk-deckhead` with title, provider badge, online status, reset button) and the context warnings bar. This destroys functionality.

**Problem 2 (THE TYPING BUG):** The original ChatPanel passes `onValueChange={onInputChange}` to ChatInput, but ChatInput expects `onChange=`. This is why typing doesn't work — the change handler is never connected.

**Fix:** Use the ORIGINAL ChatPanel.tsx from CONTEXT_BUNDLE.md section 4. Make exactly ONE change:

Find this line in the ChatInput call:
```tsx
onValueChange={onInputChange}
```

Change it to:
```tsx
onChange={onInputChange}
```

That's it. Do not change anything else. Do not remove the header. Do not remove contextWarnings. Do not change the ChatMessage interface. Do not change the MessageBubble call.

### 3b. Why RESULT (5).md's ChatPanel is wrong

| Feature | Original (KEEP) | RESULT 5 (DISCARD) |
|---------|-----------------|-------------------|
| Header with title + provider + online + reset | ✅ Has `dk-deckhead` | ❌ Deleted entirely |
| Context warnings bar | ✅ Renders `contextWarnings` | ❌ Deleted |
| MessageBubble call | ✅ Passes individual props (`role`, `content`, `parsed`) | ❌ Passes `message={m}` — breaks MessageBubble |
| ChatInput prop name | ❌ `onValueChange` (BUG) | ✅ `onChange` (correct) |
| ChatEmptyState call | ✅ `onPick=` | ❌ `onSuggestion=` — breaks ChatEmptyState |
| timestamp type | `string` (matches AiPage.tsx) | `number` (mismatch) |

### 3c. MessageBubble.tsx — Use ORIGINAL, No Changes

**Reference:** RESULT (5).md section 2.5 — **DISCARD IT ENTIRELY.**

Use the ORIGINAL MessageBubble.tsx from CONTEXT_BUNDLE.md section 7, verbatim, zero changes. RESULT (5).md's version changes the prop API from individual props (`role`, `content`, `timestamp`, `parsed`, `onAction`) to a single `message` object + `onCardAction`. The parent ChatPanel passes individual props. This mismatch causes MessageBubble to receive `undefined` for everything and crash.

### 3d. ChatEmptyState.tsx — Use ORIGINAL, No Changes

**Reference:** RESULT (5).md section 2.6 — **DISCARD IT ENTIRELY.**

Use the ORIGINAL ChatEmptyState.tsx from CONTEXT_BUNDLE.md section 6, verbatim, zero changes. RESULT (5).md's version renames `onPick` to `onSuggestion`. The parent ChatPanel calls `onPick=`. This mismatch means clicking a suggestion chip does nothing.

### 3e. ChatInput.tsx — Use ORIGINAL, No Changes

**Reference:** RESULT (5).md section 2.3 — acceptable but unnecessary.

Use the ORIGINAL ChatInput.tsx from CONTEXT_BUNDLE.md section 5, verbatim, zero changes. It already has the correct `onChange` prop name. RESULT (5).md's version is functionally identical but why introduce risk?

### 3f. SlashCommandPalette.tsx — Use RESULT (5).md's Version

**Reference:** RESULT (5).md section 2.4 — **OK TO USE.**

This component is new (doesn't exist in CONTEXT_BUNDLE.md). RESULT (5).md's version is correct. Use it as-is.

---

## FIX 4: deck.css — APPEND Missing Classes

**Reference:** RESULT (5).md section 1.3

**Problem:** RESULT (5).md says "Complete replacement" for deck.css. The replacement DELETES every class that AiPage.tsx, ChatPanel, QuickCommands, FocusBoard, PlanBoard, ReflectFeed, and DailyDigestBoard depend on. Without these classes, components render with zero styling — no flex, no borders, no colors — causing the "everything stacked with no layout" effect.

**Fix:** Keep RESULT (5).md's deck.css as the base. **APPEND** the following CSS block at the END of the file. Do NOT delete or modify any existing class in RESULT (5).md's version.

```css
/* =========================================================== */
/*  APPENDED CLASSES — Required by AiPage.tsx, ChatPanel,       */
/*  QuickCommands, FocusBoard, PlanBoard, ReflectFeed, etc.     */
/*  DO NOT DELETE THESE. DO NOT REPLACE. APPEND ONLY.           */
/* =========================================================== */

/* --- AiPage.tsx topbar children --- */
.dk-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dk-brand h1 {
  font-size: 15px;
  font-weight: 600;
  color: var(--tp);
  margin: 0;
  letter-spacing: -0.3px;
  font-family: var(--sans);
}
.dk-logo {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: linear-gradient(140deg, rgba(236,72,153,.2), rgba(167,139,250,.2));
  border: 1px solid rgba(255,255,255,.08);
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--tp);
  flex: none;
}
.dk-sub {
  color: var(--tm);
  font-size: 12px;
  font-weight: 400;
  font-family: var(--mono);
}
.dk-barR {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* --- Topbar chip variants (smaller than suggestion .dk-chip) --- */
.dk-chip.dk-mode,
.dk-chip.dk-prov,
.dk-chip.dk-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 12px;
  font-size: 11px;
  font-family: var(--mono);
  letter-spacing: 0.3px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--line);
  color: var(--ts);
  cursor: default;
  transition: all 0.18s ease;
  white-space: nowrap;
}
.dk-chip.dk-prov {
  cursor: pointer;
}
.dk-chip.dk-prov:hover {
  border-color: var(--line-2);
  background: var(--raised);
  color: var(--tp);
}
.dk-chip.dk-live .dk-dot {
  background: var(--emerald);
}
.dk-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tm);
  flex: none;
}

/* --- Subnav (Command Deck / Digest tabs) --- */
.dk-subnav {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
  flex: none;
}
.dk-subtab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--tm);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.18s ease;
  font-family: var(--sans);
  position: relative;
  white-space: nowrap;
}
.dk-subtab:hover {
  color: var(--ts);
  background: var(--raised);
}
.dk-subtab.dk-on {
  color: var(--tp);
  background: var(--surface-3);
  border-color: var(--line-2);
}
.dk-subtab-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--cyan);
  flex: none;
}

/* --- Digest page container --- */
.dk-digestpage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* --- Footer --- */
.dk-foot {
  text-align: center;
  padding: 16px 0 4px;
  font-size: 10px;
  color: var(--tm);
  font-family: var(--mono);
  letter-spacing: 1px;
}

/* --- ChatPanel deck card variant --- */
.dk-card.dk-deck {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 400px;
  padding: 0;
  overflow: hidden;
}
.dk-deckhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 10px;
  border-bottom: 1px solid var(--line);
  flex: none;
}
.dk-t {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tp);
  font-family: var(--sans);
}
.dk-deck-ic {
  font-size: 14px;
  color: var(--pink);
}
.dk-deck-meta {
  font-size: 10px;
  color: var(--tm);
  font-family: var(--mono);
  font-weight: 400;
  letter-spacing: 0.5px;
}
.dk-cmdbar {
  padding: 10px 16px 16px;
  border-top: 1px solid var(--line);
  background: rgba(9,9,11,.5);
  backdrop-filter: blur(12px);
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* --- Stream empty variant --- */
.dk-stream--empty {
  justify-content: center;
  align-items: center;
}

/* --- QuickCommands connector buttons --- */
.dk-sec {
  padding: 0;
}
.dk-conn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  border-left: 2px solid transparent;
  width: 100%;
  text-align: left;
}
.dk-conn:hover {
  background: var(--raised);
  border-left-color: var(--amber);
}
.dk-conn-l {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dk-conn-ci {
  font-size: 14px;
  width: 22px;
  text-align: center;
}
.dk-conn-nm {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--tp);
  font-family: var(--sans);
}
.dk-conn-st {
  font-size: 10px;
  color: var(--tm);
  font-family: var(--mono);
  letter-spacing: 0.5px;
}

/* --- Connector section wrapper --- */
.dk-conn-section {
  margin-top: 0;
}

/* --- Keyframes used by AiPage.tsx toasts and ConnectorsPanel loading --- */
@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

/* --- Responsive --- */
@media (max-width: 640px) {
  .dk-barR { gap: 4px; }
  .dk-chip.dk-mode,
  .dk-chip.dk-prov,
  .dk-chip.dk-live {
    height: 26px;
    padding: 0 8px;
    font-size: 10px;
  }
  .dk-brand h1 { font-size: 13px; }
  .dk-subtab { padding: 6px 12px; font-size: 11px; }
  .dk-card.dk-deck { min-height: 300px; }
}
```

---

## FIX 5: Files That Must NOT Be Changed

| File | Action | Reason |
|------|--------|--------|
| `AiPage.tsx` | **DO NOT TOUCH** | It is the prop API source of truth. All components conform to it. |
| `useAiChat.ts` | **DO NOT TOUCH** | Backend hook works correctly. |
| `useSlashCommands.ts` | **DO NOT TOUCH** | Slash commands work. Use CONTEXT_BUNDLE.md version. |
| `useAutoSync.ts` | **DO NOT TOUCH** | Auto-sync works. |
| `parsed.ts` | **DO NOT TOUCH** | ParsedMessage system works. |
| `ParsedMessageRouter.tsx` | **DO NOT TOUCH** | Router works. |
| `tokens.ts` | **DO NOT TOUCH** | Design tokens are correct. |
| `FocusBoard.tsx` | **DO NOT TOUCH** | Slot component, not part of this fix. |
| `PlanBoard.tsx` | **DO NOT TOUCH** | Slot component. |
| `ReflectFeed.tsx` | **DO NOT TOUCH** | Slot component. |
| `SummaryGrid.tsx` | **DO NOT TOUCH** | Slot component. |
| `DailyDigestBoard.tsx` | **DO NOT TOUCH** | Digest tab works. |
| `ChatHistory.tsx` | **DO NOT TOUCH** | History drawer works. |

---

## FIX 6: Files To Create/Modify (Summary)

| File | Action | Source |
|------|--------|--------|
| `AiPageDeck.tsx` | **REPLACE** with Fix 1 code above | This document |
| `ChatPanel.tsx` | **USE ORIGINAL** from CONTEXT_BUNDLE.md §4, change `onValueChange` → `onChange` | CONTEXT_BUNDLE + 1-line fix |
| `ChatInput.tsx` | **USE ORIGINAL** from CONTEXT_BUNDLE.md §5, zero changes | CONTEXT_BUNDLE |
| `ChatEmptyState.tsx` | **USE ORIGINAL** from CONTEXT_BUNDLE.md §6, zero changes | CONTEXT_BUNDLE |
| `MessageBubble.tsx` | **USE ORIGINAL** from CONTEXT_BUNDLE.md §7, zero changes | CONTEXT_BUNDLE |
| `SlashCommandPalette.tsx` | **USE RESULT (5).md §2.4**, zero changes | RESULT (5).md |
| `ConnectorsPanel.tsx` | **USE ORIGINAL** from CONTEXT_BUNDLE.md §9, apply Fix 2 changes | CONTEXT_BUNDLE + Fix 2 |
| `ConnectorItemModal.tsx` | **USE ORIGINAL** from CONTEXT_BUNDLE.md §10, zero changes | CONTEXT_BUNDLE |
| `deck.css` | **USE RESULT (5).md §1.3 as base, APPEND Fix 4 CSS** | RESULT (5).md + Fix 4 |

---

## VERIFICATION CHECKLIST

Before committing, verify each item:

- [ ] AiPage.tsx is UNCHANGED (diff should be empty)
- [ ] AiPageDeck.tsx has NO `dk-topbar` div, NO `dk-statusbar` div, NO `dk-chat-card` wrapper
- [ ] AiPageDeck.tsx renders `props.connectorsSlot` (grep for `connectorsSlot` in the return JSX)
- [ ] ChatPanel.tsx has the `dk-deckhead` header with title, provider, online status, reset button
- [ ] ChatPanel.tsx passes `onChange=` (NOT `onValueChange=`) to ChatInput
- [ ] ChatPanel.tsx renders `contextWarnings` if they exist
- [ ] MessageBubble.tsx accepts `role`, `content`, `timestamp`, `parsed`, `onAction` as individual props (NOT `message` object)
- [ ] ChatEmptyState.tsx accepts `onPick` (NOT `onSuggestion`)
- [ ] ConnectorsPanel.tsx accepts `state`, `errorMessage`, `onAdd`, `onToast`, `onRefresh` props
- [ ] ConnectorsPanel.tsx checks `props.state === "loading"` (NOT `props.loading`)
- [ ] deck.css contains BOTH the RESULT (5).md classes AND the appended classes from Fix 4
- [ ] deck.css contains `.dk-brand`, `.dk-logo`, `.dk-barR`, `.dk-subnav`, `.dk-subtab`, `.dk-deck`, `.dk-deckhead`, `.dk-cmdbar`, `.dk-conn`, `.dk-dot`
- [ ] Typing in the chat input works (text appears as you type)
- [ ] Clicking a suggestion chip fills the input
- [ ] Clicking "Accept" on a goal suggestion card calls `onCardAction`
- [ ] Connectors panel is visible and shows connector cards
- [ ] No double topbar (only AiPage.tsx's topbar should be visible)