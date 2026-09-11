# RESULT.md

## 8.1 Executive Summary
This overhaul transforms the rigid, fragmented Goals feature into a highly customizable, cross-feature, and AI-augmented system. Users can now target specific external activities, define flexible cadences (fixed schedules, rolling windows, or flexible completion), and configure granular completion logic (grace periods, partial credit, streak preservation). Goals seamlessly integrate with Learn topics, Finance budgets, External activities, IDE projects, and Focus groups. An AI Coach dynamically monitors goal health, proposes data-driven adjustments, and parses natural language into structured, executable goal configurations—all while maintaining strict user approval gates to prevent auto-applied changes.

---

## 8.2 System Architecture

```text
[Renderer Layer]
  ├── CriteriaBuilder (Steps 1-6: Target, Cadence, Logic, Tracking, Links)
  ├── GoalCard (Displays tracking mode, completion logic, recovery actions)
  ├── HabitTracker (Weekly grid, streak calculation, manual toggle)
  └── GoalAICoach (Health check, proposal cards, NLP parser modal)
       │
       ▼ (IPC via preload.ts bridges)
[IPC Layer]
  ├── Existing: save-goal, get-goals-batch, activity-goal:*, finance-goal:*, learn:*
  ├── New: goal:get-cross-feature-progress, goal:ai-monitor, goal:ai-apply-proposal, 
  │        goal:ai-parse-language, goal:get-habits, goal:toggle-habit-day
       │
       ▼ (ipcMain.handle in main.ts)
[Main Process]
  ├── GoalCompletionEngine (Evaluates late, partial, streak rules in LOCAL time)
  ├── CrossFeatureRouter (Queries Learn, Finance, External, IDE, Focus tables)
  ├── AI Parser & Monitor (LLM calls with strict JSON responseParser contract)
       │
       ▼
[Database (better-sqlite3)]
  ├── goals (ALTER: completion_config, tracking_mode, cadence_config, cross_feature_link, external_activity_id)
  ├── external_activities, finance_goals, learn_nodes, projects (queried for cross-feature progress)
```

---

## 8.3 Unified Type System

Create `src/types/goals.ts`. Update `src/components/dashboard/types.ts`, `src/components/ai/types.ts`, and `src/services/GoalStore.ts` to re-export from this single source of truth.

```typescript
export type GoalCategory = 'work' | 'personal' | 'health' | 'learning' | 'finance' | 'relationships' | 'reflection';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'longterm';
// Canonical status; legacy GoalStore statuses are mapped to these at runtime
export type GoalStatus = 'active' | 'done' | 'archived' | 'failed' | 'missed' | 'suggested' | 'pending' | 'in-progress' | 'completed' | 'overdue' | 'slipped' | 'dismissed';
export type GoalSource = 'manual' | 'ai' | 'system';
export type TargetType = 'time' | 'completion' | 'external' | 'habit' | 'cross_feature';
export type TrackingMode = 'system' | 'manual' | 'hybrid';

export interface CompletionLogic {
  lateAllowed: boolean;
  gracePeriodMinutes: number;
  partialCredit: boolean;
  streakOnMiss: 'reset' | 'continue' | 'pause';
}

export interface CadenceConfig {
  type: 'fixed' | 'rolling' | 'flexible';
  fixedDays: number[]; // 0-6 (Sun-Sat)
  rollingTarget: number; // e.g., 3 times per week
  flexibleWindowDays: number; // e.g., any 5 of 7 days
}

export interface CrossFeatureLink {
  feature: 'learn' | 'finance' | 'external' | 'ide' | 'focus';
  entityId: string;
  label: string;
}

export interface GoalTarget {
  type: TargetType;
  targetSeconds?: number;
  maxExternalSeconds?: number;
  matchCategory?: string;
  matchApps?: string[]; // Preserved from GoalStore
  done?: boolean;
}

export interface GoalLink {
  label: string;
  url: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  target: GoalTarget;
  period: GoalPeriod;
  status: GoalStatus;
  date: string;
  source: GoalSource;
  links: GoalLink[];
  progressSeconds?: number;
  completedAt?: string;
  createdAt: string;
  
  // Existing extended fields
  parentId?: string;
  parentIds?: string[];
  streak?: number;
  isHabit?: boolean;
  cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  detection?: { enabled: boolean; mode: 'positive' | 'avoidance'; keywords: string[]; minMinutes: number };
  linkedScheduleId?: string;
  journalText?: string;
  slippedCount?: number;
  deadline?: string;

  // NEW Unified Fields
  trackingMode: TrackingMode;
  completionLogic: CompletionLogic;
  cadenceConfig: CadenceConfig;
  crossFeatureLink?: CrossFeatureLink | null;
  externalActivityId?: number | null;
}

export interface LongTermGoal extends Omit<Goal, 'period' | 'date' | 'target'> {
  period: 'longterm';
  deadline?: string;
  progress?: number;
  priority?: number;
}

// Migration Mapping Utility (to be used in GoalStore.ts)
export function mapLegacyStatus(status: string): GoalStatus {
  const map: Record<string, GoalStatus> = {
    'suggested': 'active', 'pending': 'active', 'in-progress': 'active',
    'completed': 'done', 'overdue': 'missed', 'slipped': 'missed', 'dismissed': 'archived'
  };
  return map[status] || (status as GoalStatus);
}
```

---

## 8.4 Backend Specification

### Database Schema Updates (`main.ts`)
Execute guarded `ALTER TABLE` statements on app startup (pattern: `try { db.prepare('...').run(); } catch {}`):
```sql
ALTER TABLE goals ADD COLUMN completion_config TEXT DEFAULT '{"lateAllowed":false,"gracePeriodMinutes":0,"partialCredit":false,"streakOnMiss":"reset"}';
ALTER TABLE goals ADD COLUMN tracking_mode TEXT DEFAULT 'manual';
ALTER TABLE goals ADD COLUMN cadence_config TEXT DEFAULT '{"type":"fixed","fixedDays":[],"rollingTarget":1,"flexibleWindowDays":7}';
ALTER TABLE goals ADD COLUMN cross_feature_link TEXT;
ALTER TABLE goals ADD COLUMN external_activity_id INTEGER;
```

### New IPC Handlers (`main.ts`)
1. **`goal:get-cross-feature-progress`**
   - **Payload:** `{ goalId: string }`
   - **Response:** `{ success: boolean; progress: number; target: number; percentComplete: number; details: string }`
   - **Logic:** Reads `cross_feature_link` from `goals`. Routes query to `learn_nodes` (completion %), `finance_goals` (current/target amount), `external_sessions` (duration), `projects` (activity), or `deep_focus_sessions` (time).

2. **`goal:ai-monitor`**
   - **Payload:** `{}` (Rate limited: max 1 call per 6 hours via `last_ai_monitor` timestamp in DB)
   - **Response:** `{ success: boolean; proposals: Array<{ goalId: string; action: 'reschedule'|'adjust_target'|'split'|'retire'|'celebrate'; reason: string; newConfig?: Partial<Goal> }> }`
   - **AI System Prompt:** 
     ```text
     You are a goal coach for DeskFlow. Analyze the user's goals and 7-day progress data. 
     For each goal needing attention, propose ONE specific adjustment. 
     Return ONLY valid JSON: { "proposals": [{ "goalId": "string", "action": "reschedule"|"adjust_target"|"split"|"retire"|"celebrate", "reason": "string", "newConfig": {...} }] }
     Rules: Never auto-apply. Be specific ("Move deadline to Sep 2"). Celebrate early wins. If missed 3+ times, suggest splitting. If consistently exceeded, suggest increasing target.
     ```

3. **`goal:ai-apply-proposal`**
   - **Payload:** `{ goalId: string; newConfig: Partial<Goal> }`
   - **Response:** `{ success: boolean; error?: string }`
   - **Logic:** Merges `newConfig` into existing goal, calls `save-goal`, and writes a context brain episode (`action: 'ai_adjusted'`).

4. **`goal:ai-parse-language`**
   - **Payload:** `{ text: string }`
   - **Response:** `{ success: boolean; parsedGoal: Partial<Goal>; error?: string }`
   - **AI System Prompt:**
     ```text
     Parse the user's natural language input into a structured Goal configuration. Return ONLY valid JSON matching this schema:
     { "title": "string", "category": "work"|"personal"|"health"|"learning"|"finance"|"relationships"|"reflection", "period": "daily"|"weekly"|"monthly", "targetType": "time"|"completion"|"external"|"habit"|"cross_feature", "targetSeconds": number|null, "externalActivityName": "string|null", "crossFeature": {"feature": "learn"|"finance"|"external"|"ide"|"focus", "entityName": "string"}|null, "cadenceConfig": {"type": "fixed"|"rolling"|"flexible", "fixedDays": number[], "rollingTarget": number, "flexibleWindowDays": number}, "trackingMode": "system"|"manual"|"hybrid", "completionLogic": {"lateAllowed": boolean, "gracePeriodMinutes": number, "partialCredit": boolean, "streakOnMiss": "reset"|"continue"|"pause"} }
     Rules: Infer sensible defaults. "Mon, Wed, Fri" -> type:"fixed", fixedDays:[1,3,5]. "Any 3 days" -> type:"flexible", flexibleWindowDays:7, rollingTarget:3. Do not hallucinate entity IDs; use entityName.
     ```

5. **`goal:get-habits`**
   - **Payload:** `{ startDate: string; endDate: string }`
   - **Response:** `{ success: boolean; habits: Array<Goal & { weekProgress: { date: string; completed: boolean }[] }> }`
   - **Logic:** Filters `goals` where `is_habit = 1`. Joins with completion logs to build the weekly grid state.

6. **`goal:toggle-habit-day`**
   - **Payload:** `{ goalId: string; date: string; completed: boolean }`
   - **Response:** `{ success: boolean; newStreak: number }`
   - **Logic:** Upserts manual completion record, recalculates streak based on `cadenceConfig`.

### Modified IPC Handlers
- **`save-goal`**: Update `INSERT OR REPLACE` to include `completion_config`, `tracking_mode`, `cadence_config`, `cross_feature_link`, `external_activity_id` (stringified for JSON columns).
- **`get-goals-batch`**: Parse and return the new JSON columns in the response object.

---

## 8.5 UI Specification

### 1. `CriteriaBuilder.tsx` (Enhanced)
- **Props:** `onSave: (goal: Partial<Goal>) => void`, `onCancel: () => void`, `initialData?: Partial<Goal>`
- **State:** `step` (1-6), `formData` (extended `CriteriaForm`), `isLoading` (fetching activities/links)
- **Console Stamp:** `console.log('%c[CriteriaBuilder] v2.0 loaded', 'color: #fbbf24; font-weight: bold')`
- **Render Structure:**
  - **Step 1:** Title + Description (Existing)
  - **Step 2:** Category + Period + Target Type (Enhanced: add 'habit', 'cross_feature')
  - **Step 3:** Target Config (Conditional):
    - *External:* `<ExternalActivityPicker />`
    - *Cross Feature:* `<CrossFeatureLinkPicker />`
    - *Habit:* Cadence selector (Fixed/Rolling/Flexible) + day checkboxes
  - **Step 4:** Tracking Mode (Radio: System / Manual / Hybrid)
  - **Step 5:** Completion Logic (`<CompletionLogicConfig />`)
  - **Step 6:** Advanced (Detection, LTG Picker, Links)
- **States:** Populated (form), Loading (skeleton on Step 3/6), Error (toast + retry), Empty (N/A).
- **Tokens:** `bg-[rgba(24,24,27,0.55)]`, `backdrop-blur-xl`, `border-[rgba(63,63,70,0.40)]`, `rounded-xl`, `p-5`, `violet-500` accents.

### 2. `ExternalActivityPicker.tsx`
- **Props:** `value: number | null`, `onChange: (id: number | null) => void`
- **Logic:** Calls `api.activityGoalGetAll()`. Maps to grid of cards.
- **Render:** Icon + name + color dot + today's time + toggle. Selected state: `border-violet-500/50 bg-violet-500/10`.
- **Empty State:** "No external activities yet — create one in the External page first."

### 3. `CrossFeatureLinkPicker.tsx`
- **Props:** `value: CrossFeatureLink | null`, `onChange: (link: CrossFeatureLink | null) => void`
- **Logic:** Dropdown for feature selection. On select, fetches entities (e.g., `api.learnGetGoals()`, `api.financeGoalGetAll()`).
- **Render:** Selected entity shown as a chip with `×` to remove.

### 4. `CompletionLogicConfig.tsx`
- **Props:** `value: CompletionLogic`, `onChange: (v: CompletionLogic) => void`
- **Render:** Glass card with `<Switch />` for "Allow late completion" (reveals `<Input type="number" />` for grace minutes). Radio group for "Streak on Miss" (Reset / Continue / Pause).

### 5. `GoalAICoach.tsx`
- **Props:** `onApply: (proposal) => void`, `onDismiss: (proposal) => void`
- **States:** 
  - *Loading:* Pulsing skeleton cards (`<Skeleton className="h-24 rounded-xl" />`).
  - *Empty:* "All goals look healthy! Check back in 24 hours." (`<CheckCircle2 className="text-emerald-500" />`).
  - *Populated:* Proposal cards with action badge, reason, "Apply" / "Dismiss" buttons.
- **Tokens:** `border-amber-500/20` for adjust, `border-emerald-500/20` for celebrate.

### 6. `HabitTracker.tsx`
- **Props:** `currentDate: string`
- **Render:** Horizontal scroll on mobile, CSS grid on desktop. 7 columns (Mon-Sun). Rows = habits. Cells = clickable circles (empty/filled/half-fill for partial).
- **States:** Loading, Empty ("No habits yet. Create one with 'habit' target type."), Populated, Error.
- **Animation:** `framer-motion` scale on cell click, confetti on streak milestone.

### 7. `MissedGoalRecoveryBanner.tsx`
- **Props:** `missedGoals: Goal[]`, `onRecover: (goalId, action) => void`, `onDismiss: () => void`
- **Render:** Inline banner above goal list. `bg-amber-500/10 border-amber-500/20`. Lists missed goals with inline actions: "Mark Late", "Reschedule", "Dismiss".

---

## 8.6 Interaction & UX Specification

1. **Creating a goal with external activity target:** User opens CriteriaBuilder → Step 2 selects Target Type "External" → Step 3 reveals External Activity Picker → User selects "Gym Session" → Sets target to 45 mins → Saves.
2. **Creating a habit with fixed schedule:** User selects Target Type "Habit" → Cadence "Fixed" → Checks Mon, Wed, Fri → Saves. Goal appears in HabitTracker grid.
3. **Linking a goal to a Learn topic:** User selects Target Type "Cross Feature" → Feature "Learn" → Dropdown populates with topics → User selects "TypeScript Basics" → Saves. Progress bar now reflects topic completion %.
4. **Configuring completion logic:** Step 5 in CriteriaBuilder → User toggles "Allow late completion" → Sets grace period to 1440 mins (1 day) → Selects Streak Rule "Pause" → Saves.
5. **Reviewing AI proposals:** User clicks "AI Health Check" in GoalsPage → `GoalAICoach` loads → Displays card: "Goal 'Read 30 mins' missed 3x. Propose: Split into 'Read 15 mins morning' and 'Read 15 mins night'." → User clicks "Apply" → Goal updates, toast confirms.
6. **Recovering from a missed goal:** User opens app on Tuesday. `MissedGoalRecoveryBanner` shows "1 goal missed yesterday". User expands, selects "Mark completed (late)" for "Morning Jog". Streak pauses per config.
7. **Using the natural language goal creator:** User clicks "Create with AI" → Modal opens → Types "Practice guitar 3x a week for 20 mins, but I travel so any 3 days is fine" → AI returns parsed config (type: flexible, flexibleWindowDays: 7, rollingTarget: 3, targetSeconds: 1200) → User reviews, tweaks, and clicks "Create".

---

## 8.7 Implementation Phases

**Phase 1: Type System + DB Migration (Foundation)**
- Create `src/types/goals.ts` and update all import sites.
- Add guarded `ALTER TABLE` statements in `main.ts`.
- Update `save-goal` and `get-goals-batch` to handle new JSON fields.

**Phase 2: Enhanced CriteriaBuilder + External Activity Picker**
- Extend `CriteriaForm` interface.
- Build `ExternalActivityPicker.tsx` and wire to `activityGoalGetAll`.
- Implement Steps 3-6 in `CriteriaBuilder.tsx` with conditional rendering.

**Phase 3: Completion Logic + Missed Goal Recovery**
- Build `CompletionLogicConfig.tsx`.
- Implement `GoalCompletionEngine` utility (LOCAL time evaluation).
- Build `MissedGoalRecoveryBanner.tsx` and wire to `get-goals-batch` filtering.

**Phase 4: Cross-Feature Integration**
- Implement `goal:get-cross-feature-progress` IPC handler.
- Build `CrossFeatureLinkPicker.tsx`.
- Update `GoalCard` progress bar to display cross-feature source badge.

**Phase 5: Habit Tracker**
- Implement `goal:get-habits` and `goal:toggle-habit-day` IPC handlers.
- Build `HabitTracker.tsx` with weekly grid and streak logic.
- Add "Habits" tab to GoalsPage.

**Phase 6: AI Dynamic Monitor + Language Parser**
- Implement `goal:ai-monitor`, `goal:ai-apply-proposal`, `goal:ai-parse-language` with strict JSON `responseParser`.
- Build `GoalAICoach.tsx` panel and NLP creation modal.
- Add rate limiting (6-hour cooldown) in `main.ts`.

---

## 8.8 Verification Checklist

For each phase, the Hands & Eyes agent must verify:
- [ ] **Build:** `npx vite build --outDir dist-tmp` succeeds with no type errors.
- [ ] **Preload:** `npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs` succeeds.
- [ ] **Main:** `node scripts/rebuild-main.mjs` succeeds.
- [ ] **Runtime:** New IPC calls return expected shapes (verify via DevTools Network/IPC tab).
- [ ] **UI:** All 4 states (empty/loading/error/populated) render correctly for new components.
- [ ] **Console:** No new warnings/errors; console stamps appear on component mount.
- [ ] **Anti-Regression:** Existing daily goals, Vault, AI suggestions, focus accumulation, and calendar highlighting remain fully functional.

---

## 8.9 Known Risks & Invariants

1. **Data Migration:** The unified type system must gracefully map legacy `GoalStore` statuses without data loss. Default values must be provided for new JSON columns.
2. **Timezone Handling:** Completion logic (grace periods) and habit day boundaries MUST be evaluated in the user's LOCAL time, not UTC, to prevent off-by-one-day errors.
3. **Entity Deletion:** Cross-feature links must handle deleted entities gracefully (e.g., `entityId` no longer exists in `learn_nodes`). UI must show a "Link broken" state and allow removal.
4. **AI Rate Limiting:** The `goal:ai-monitor` endpoint must enforce a strict 6-hour cooldown at the `main.ts` level to prevent API spam and unexpected costs.
5. **Streak Calculation:** Habit streaks must correctly account for the `cadenceConfig` (e.g., a weekly habit with `rollingTarget: 3` maintains its streak if 3 days are completed within the `flexibleWindowDays`, even if not consecutive calendar days).
6. **No Auto-Apply:** AI proposals are strictly advisory. The `goal:ai-apply-proposal` endpoint is the ONLY way changes are committed, and it requires explicit user action.

---

## 8.10 Deferred Items

The following features are explicitly out of scope for this overhaul to maintain focus and delivery velocity:
- **Multi-user goals:** The current architecture is strictly single-user/local-first.
- **Goal templates:** Pre-defined goal blueprints can be a follow-up feature once the core customization is stable.
- **Social/sharing features:** Not aligned with the current local-first, privacy-focused DeskFlow paradigm.
- **Dedicated analytics dashboard:** While `goal:get-cross-feature-progress` provides data, a full historical analytics view is a separate epic.