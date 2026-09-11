# Unified Context Management System — Result Specification

This document serves as the comprehensive technical and design specification for the **Unified Context Management System** in DeskFlow. It translates the raw requirements and context bundle into an actionable engineering and design blueprint.

---

## 1. System Architecture Overview

The system bridges the gap between fragmented data silos (Agent Memory, Chat Memory, Life Phases, App Usage) and the AI/Workspace interfaces. It introduces a centralized **Unified Context Store** and a background **Auto-Context Engine** that passively observes, extracts, and synthesizes user data into a living profile.

### High-Level Data Flow
1. **Event Emitters:** Existing systems (Chat, Terminal, Goals, Life Phases) emit events via IPC or internal EventEmitters in the Main process.
2. **Auto-Context Engine:** Intercepts these events, extracts signals, applies confidence scoring, and resolves conflicts.
3. **Unified Context Store:** Persists the synthesized profile in `user_context_profile` and raw signals in `user_context_signals`.
4. **Context Injectors:** `aiContextBundle.ts` and `ContextAssemblyService.ts` query the store and format the data for LLM system prompts.
5. **Profile UI:** The React frontend fetches the data to render the read-only, visual Context Profile page.

---

## 2. Auto-Context Engine (Background Process)

The engine runs entirely in the Node.js Main process to avoid blocking the UI renderer.

### 2.1 Event Listeners & Signal Extraction
| Source System | Trigger Event | Extracted Signals |
| :--- | :--- | :--- |
| **AI Chat** | `ai-chat:send-message` | Communication style, recurring topics, explicit preferences ("Don't do X"), questions asked. |
| **Agent Memory** | `memory:add` / `memory:compact` | Core facts, corrections, long-term habits. |
| **Goals** | `goal:update` / `goal:complete` | Achievement patterns, category focus, completion velocity. |
| **Life Phases** | `lifePhase:save` | Mood patterns, major life milestones, era-defining reflections. |
| **App Usage** | `log:activity` (Dashboard) | Work hours, tool preferences, focus duration, schedule patterns. |

### 2.2 Confidence Scoring & Conflict Resolution
Every signal written to `user_context_signals` is assigned a confidence score (0.0 to 1.0).
* **Explicit vs. Implicit:** User stating "I am a senior React developer" (Explicit, weight: 1.0) overrides the system inferring "User is learning React" based on beginner questions (Implicit, weight: 0.4).
* **Recency Decay:** Older signals lose confidence over time unless reinforced (`occurrence_count`).
* **Conflict Resolution:** When a new signal contradicts an existing one, the engine checks confidence and timestamps. If the new signal wins, the old signal's `superseded_by` field is updated, and the `user_context_profile` JSON is recalculated.

---

## 3. Context-Aware AI & Workspace Integration

The AI must feel like it *knows* the user without exceeding token limits.

### 3.1 AI Chat Injection (`src/services/aiContextBundle.ts`)
The profile JSON is transformed into a concise, high-density Markdown block injected into the system prompt.
* **Token Budget:** Max 2,500 tokens (~10K chars) reserved specifically for the User Profile within the 12K total limit.
* **Format Example:**
  ```markdown
  <user_context>
  [Identity] Senior Full-Stack Dev, prefers functional patterns.
  [Current Focus] Building DeskFlow context engine, struggling with SQLite JSON queries.
  [Communication] Direct, dislikes boilerplate, prefers code-first explanations.
  [Habits] Codes late night (22:00-02:00), takes frequent short breaks.
  [Recent Milestone] Completed Life Phases UI (Aug 10).
  </user_context>
  ```

### 3.2 Workspace Integration (`src/services/ContextAssemblyService.ts`)
Terminal agents receive a specialized subset of the context focused on technical capabilities, project state, and coding preferences, injected via the `assemble-context` IPC.

---

## 4. Context Profile Page Design (UI/UX)

**Route:** `/life?tab=profile`
**Theme:** Warm Dark Glassmorphism (using existing tokens).
**Core Principle:** 100% Read-Derived. No manual input forms.

### 4.1 Visual Layout & Components

#### A. Header & Summary Card
* **Design:** Full-width glassmorphism card (`--dk-bg-surface`, `backdrop-filter: blur(16px)`).
* **Content:** AI-generated 2-sentence summary of the user's current "Era" (e.g., *"You are currently in a deep-work heavy phase, focusing heavily on systems architecture and React performance."*).
* **Accent:** Subtle amber glow (`--dk-accent-dim`) behind the card.

#### B. Personality Radar (Top Left)
* **Component:** SVG/Canvas Radar Chart.
* **Axes (Derived from chat & usage):**
  1. Analytical ↔ Creative
  2. Big-Picture ↔ Detail-Oriented
  3. Planner ↔ Spontaneous
  4. Code-First ↔ Theory-First
  5. Verbose ↔ Concise
* **Styling:** Fill color `rgba(217, 168, 124, 0.2)`, Stroke `#d9a87c`.

#### C. Activity Heatmap (Top Right)
* **Component:** 7x24 Grid (Day of Week × Hour of Day).
* **Data:** Derived from `logs` (app usage) and `ai_chat_memories` timestamps.
* **Styling:** Deep background `--dk-bg-deep`. Active cells use a gradient from `--dk-accent-dim` to `--dk-accent`.

#### D. Growth Timeline (Center - Vertical Scroll)
* **Component:** Vertical line with interactive nodes.
* **Data:** Merges `growth_markers` from profile and `milestones` from `life_phases`.
* **UX:** Clicking a node expands a drawer showing the *source* (e.g., "Derived from Life Phase: 'Q3 Sprint'", or "Derived from Chat on Aug 12").

#### E. Interest Map & Communication Style (Bottom)
* **Interest Map:** Tag cloud where font-size and opacity represent engagement score. Color coded by category (Tech, Life, Finance).
* **Communication Style:** A "Cheat Sheet" card showing how the AI should talk to the user (e.g., "Give me code blocks first, explain later", "Avoid corporate jargon").

### 4.2 UX Flow & Micro-interactions
1. **Skeleton Loading:** Page loads with shimmering skeleton cards matching the layout.
2. **Data Fetch:** `context:get-profile` IPC invoked.
3. **Animation:** Cards fade in and slide up slightly (`framer-motion` or CSS transitions).
4. **Drill-Downs:** Every visual element is clickable. Clicking a trait or interest opens a modal showing the raw `user_context_signals` that generated it, providing transparency into the AI's "thought process".

---

## 5. Database & IPC Specification

### 5.1 Schema Implementation
Execute the `CREATE TABLE` statements for `user_context_profile` and `user_context_signals` exactly as defined in the Context Bundle during the Main process DB initialization sequence. Add migration logic to check for table existence.

### 5.2 IPC Handler Registration (`src/main.ts`)

| IPC Channel | Handler Logic |
| :--- | :--- |
| `context:get-profile` | Queries `user_context_profile` where `id='main'`. Returns parsed JSON. |
| `context:update-profile` | Accepts partial JSON, merges with existing, updates `last_updated_at`. |
| `context:add-signal` | Validates signal payload, inserts into `user_context_signals`, triggers profile recalculation. |
| `context:get-signals` | Accepts query params (type, source, limit). Returns array of signals. |
| `context:rebuild` | **Heavy Operation:** Wipes `user_context_profile`, scans all existing tables (`agent_memories`, `life_phases`, etc.), and re-runs the Auto-Context Engine extraction pipeline. |
| `context:get-growth` | Queries `growth_markers` JSON and joins with `life_phases` milestones, sorted by date. |

### 5.3 Preload API (`src/preload.ts`)
Expose the IPC channels securely via `contextBridge`:
```typescript
contextAPI: {
  getProfile: () => ipcRenderer.invoke('context:get-profile'),
  addSignal: (signal) => ipcRenderer.invoke('context:add-signal', signal),
  getSignals: (query) => ipcRenderer.invoke('context:get-signals', query),
  rebuild: () => ipcRenderer.invoke('context:rebuild'),
  getGrowth: () => ipcRenderer.invoke('context:get-growth'),
}
```

---

## 6. Frontend Implementation Plan

| File Path | Action Required |
| :--- | :--- |
| `src/App.tsx` | Ensure `/life` route handles `?tab=profile` query param. |
| `src/pages/LifePage.tsx` | Add `ProfileTab` component to the tab navigation array. |
| `src/components/life-river/ProfileTab.tsx` | **New File:** Main container for the profile page. Handles data fetching and layout. |
| `src/components/life-river/profile/` | **New Directory:** Contains `RadarChart.tsx`, `ActivityHeatmap.tsx`, `GrowthTimeline.tsx`, `InterestCloud.tsx`. |
| `src/services/aiContextBundle.ts` | Update `getChatContext()` to fetch `contextAPI.getProfile()`, format it, and append to the 12K char budget. |
| `src/hooks/useAiChat.ts` | Ensure system prompt updates reactively when the profile changes significantly. |

---

## 7. Constraints & Verification Matrix

### 7.1 Constraint Checklist
- [x] **Existing DB Used:** Uses `%APPDATA%/RHEO/deskflow-data.db` via `better-sqlite3`.
- [x] **Existing IPC Pattern:** Strict adherence to `ipcMain.handle` / `ipcRenderer.invoke`.
- [x] **Integration:** Reads from `agent_memories` and `ai_chat_memories` without mutating or deleting them.
- [x] **Design Tokens:** Strictly utilizes `--dk-bg-*`, `--dk-accent`, `--dk-text-*` variables.
- [x] **AI Chat Flow:** Non-blocking. Context injection happens asynchronously before the LLM request.
- [x] **Read-Derived:** UI contains no `<input>` or `<textarea>` fields for profile data.
- [x] **Token Budget:** Profile injection is strictly capped and summarized to maintain the <12K char limit.

### 7.2 Updated Backend Verification Matrix

| Feature | IPC Channel | Handler Status | Service Class | DB Schema | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Get profile | `context:get-profile` | 🟢 **To Build** | `ContextStore` | `user_context_profile` | 🟢 Planned |
| Update profile | `context:update-profile` | 🟢 **To Build** | `ContextStore` | `user_context_profile` | 🟢 Planned |
| Add signal | `context:add-signal` | 🟢 **To Build** | `AutoContextEngine` | `user_context_signals` | 🟢 Planned |
| Get signals | `context:get-signals` | 🟢 **To Build** | `ContextStore` | `user_context_signals` | 🟢 Planned |
| Rebuild profile | `context:rebuild` | 🟢 **To Build** | `AutoContextEngine` | All Tables | 🟢 Planned |
| Get growth | `context:get-growth` | 🟢 **To Build** | `ContextStore` | `user_context_profile` | 🟢 Planned |
| Read agent memories | `memory:get` | ✅ Exists | `memoryStore` | `agent_memories` | ✅ Ready |
| Read chat memories | `ai-chat:get-memories` | ✅ Exists | `main.ts` | `ai_chat_memories` | ✅ Ready |
| Read life phases | `lifePhase:get` | ✅ Exists | `main.ts` | `life_phases` | ✅ Ready |
| Read app usage | `getDashboardAggregates`| ✅ Exists | `main.ts` | `logs` | ✅ Ready |

---
**Next Steps for Engineering:**
1. Run DB migrations for the two new tables.
2. Implement the `AutoContextEngine` class in the main thread.
3. Wire up the `add-signal` triggers inside existing memory and goal creation functions.
4. Build the React components for the Profile Tab using the specified design tokens.