# RESULT.md — Life River Phase Integration

## 0. Core Product Decision

The River mode becomes the **orchestration layer**.

It does not replace the specialist Pages. It answers a different question:

> “What was happening in my life during this chapter?”

The Pages remain the full data-entry surfaces:

- **Covenant Page** — full commitment management.
- **Gold Page** — full goals, long-term goals, focus groups, progress.
- **Memories Page** — full memory library, image management, detailed editing.
- **Life Phases / River** — the connective narrative layer.

The River therefore supports two data realities:

1. **System Mode** — automatically computed from everything DeskFlow already tracked during the phase date range.
2. **Manual Mode** — user-added historical data from before DeskFlow existed, or data that should be intentionally attached to a phase.

The River must make both feel like one continuous object, not four disconnected tabs.

---

# 1. Architecture Overview

## 1.1 River mode responsibilities

River mode is responsible for:

- Showing phases as chapters.
- Showing how Covenant, Gold, Memories, and tracked system data relate to each phase.
- Expanding a phase to reveal the full context of that period.
- Providing quick attachment and quick capture actions.
- Deep-linking into specialist Pages when full editing is required.

River mode is **not** responsible for becoming a full replacement for:

- the Memories library,
- the Goals page,
- the Covenant page,
- Finance,
- Focus,
- Stats,
- Sleep,
- AI usage,
- Code activity.

Instead, it summarizes and connects them.

---

## 1.2 Two-mode mental model

Each expanded `PhaseCard` has a local mode toggle:

```text
[ System ]   [ Manual ]
```

### System

Shows automatically computed data from DeskFlow:

- App usage
- Browser activity
- Focus sessions
- Finance
- Sleep
- AI usage
- Code activity
- IDE projects
- Subscriptions
- Productivity summary

### Manual

Shows intentionally attached human data:

- Memories
- Goals
- Covenants
- Milestones
- People
- Notes / lessons / feelings

This toggle is local to the expanded card. It does **not** replace the global four-lens system.

Global lenses still control the ring visualization:

```text
Phases / Covenant / Gold / Memories
```

The expanded card mode controls the phase detail body:

```text
System / Manual
```

---

# 2. Data Attachment Model

## 2.1 Attachment rules

| Data type | Automatic attachment | Manual attachment | Source of truth |
|---|---:|---:|---|
| App logs | Yes | No | `logs` |
| Browser sessions | Yes | No | `browser_sessions` |
| Focus sessions | Yes | No | `deep_focus_sessions` |
| Focus groups | Yes, where inferable | No | `focus_groups` |
| Finance transactions | Yes | No | `finance_transactions` |
| Wallet changes | Yes | No | `finance_transactions`, `finance_wallets` |
| Subscriptions | Yes | No | `finance_subscriptions` |
| Sleep | Yes | No | `external_sessions` where `type = 'sleep'` |
| AI usage | Yes | No | `ai_usage` |
| Code activity | Yes | No | `code_activity` |
| IDE projects | Yes | No | `projects`, `ai_usage` |
| Memories | Yes by date | Yes by explicit attach | `memories` |
| Goals | Yes by date/deadline | Yes by explicit attach | goals / long-term goals |
| Covenants | Partially by completion date | Yes by explicit phase link | covenant localStorage/state |
| Milestones | No | Yes | phase JSON |
| People | No | Yes | phase JSON |

---

## 2.2 Memories

Memories should use a dual rule:

```text
visible memory =
  memory.date inside phase range
  OR memory.phaseId === phase.id
```

If the user explicitly attaches a memory to a phase, set:

```ts
memory.phaseId = phase.id
```

If the user removes it from a phase, clear the explicit link:

```ts
memory.phaseId = null
```

Date-based memories remain visible unless explicitly hidden. If an explicit hide mechanism does not exist yet, the first implementation can simply prioritize explicit `phaseId` links and show date-based memories under a separate subtitle:

```text
Attached manually
Happened during this chapter
```

This avoids needing a new exclusion table.

---

## 2.3 Goals

For goals, use whichever field already exists in the codebase:

```ts
goal.phaseId
```

or:

```ts
longTermGoal.links
```

Preferred behavior:

```ts
visible goal =
  goal.phaseId === phase.id
  OR goal.links?.includes(phase.id)
  OR goal.targetDate/deadline falls inside phase range
```

The Manual view should separate:

```text
Linked to this chapter
Active during this chapter
```

Full goal editing should still happen on the Gold page.

---

## 2.4 Covenants

Covenants are currently localStorage/state-based, so phase association should be additive.

Add an optional field to each covenant commitment:

```ts
interface CovenantCommitment {
  id: string
  title: string
  // existing fields...
  phaseId?: string | null
}
```

A covenant completion remains date-based:

```ts
completion.date
```

A covenant should appear inside a phase when:

```text
commitment.phaseId === phase.id
OR completion.date falls inside phase range
```

For old covenants with no `phaseId`, completion date is enough.

For historical covenants before tracking existed, the user can create a phase-scoped covenant manually.

---

# 3. IPC Contract

The cleanest implementation is a single additive aggregation handler:

```ts
window.deskflowAPI.lifePhase.getPeriodContext(startDate: string, endDate: string | null)
```

This aligns with the earlier `LIFE_PHASES_SPEC.md` and avoids making the renderer query many tables separately.

## 3.1 Request

```ts
interface PeriodContextRequest {
  startDate: string // YYYY-MM-DD
  endDate: string | null
}
```

If `endDate` is null, the phase is ongoing. The main process should treat the end as “today”.

---

## 3.2 Response

```ts
interface PhasePeriodContext {
  range: {
    start: string
    end: string | null
    isOngoing: boolean
  }

  availability: {
    appUsage: boolean
    browser: boolean
    focus: boolean
    finance: boolean
    sleep: boolean
    ai: boolean
    code: boolean
    projects: boolean
    subscriptions: boolean
  }

  summary: {
    productiveMs: number
    distractingMs: number
    neutralMs: number
    focusMs: number
    focusSessionCount: number
    netFinance: number
    incomeTotal: number
    expenseTotal: number
    sleepAvgMinutes: number
    aiCost: number
    codeLinesAdded: number
    codeLinesRemoved: number
    memoryCount: number
    covenantCompletionCount: number
    goalCount: number
  }

  appUsage: {
    totalMs: number
    productiveMs: number
    distractingMs: number
    neutralMs: number
    topApps: {
      name: string
      totalMs: number
      category: string
    }[]
    hourly: {
      hour: number
      totalMs: number
    }[]
  } | null

  browser: {
    totalMs: number
    topDomains: {
      domain: string
      title?: string
      totalMs: number
      category: string
    }[]
  } | null

  focus: {
    totalMs: number
    sessionCount: number
    averageSessionMs: number
    strictness: {
      label: string
      count: number
      totalMs: number
    }[]
    topApps: {
      name: string
      count: number
    }[]
    groups: {
      name: string
      color: string
      totalMs: number
    }[]
  } | null

  finance: {
    incomeTotal: number
    expenseTotal: number
    transferTotal: number
    net: number
    currency: string | null
    topCategories: {
      categoryId: number | null
      label: string
      total: number
      type: string
    }[]
    walletDeltas: {
      walletId: number
      walletName: string
      delta: number
    }[]
  } | null

  subscriptions: {
    activeDuringPhase: {
      id: string
      name: string
      amount: number
      billingCycle: string
      category: string
      status: string
    }[]
    estimatedMonthlyBurn: number
  } | null

  sleep: {
    sessionCount: number
    totalMinutes: number
    averageMinutes: number
    averageBedtime: string | null
    averageWakeTime: string | null
    consistencyScore: number | null
    nightly: {
      date: string
      startedAt: string
      endedAt: string
      durationMinutes: number
    }[]
  } | null

  ai: {
    totalRequests: number
    totalTokensIn: number
    totalTokensOut: number
    totalCost: number
    topTools: {
      tool: string
      count: number
      cost: number
    }[]
    topModels: {
      model: string
      count: number
      cost: number
    }[]
  } | null

  code: {
    totalEvents: number
    linesAdded: number
    linesRemoved: number
    topFiles: {
      filePath: string
      workspacePath?: string
      events: number
      linesAdded: number
      linesRemoved: number
    }[]
    topWorkspaces: {
      workspacePath: string
      events: number
    }[]
  } | null

  projects: {
    activeProjects: {
      id: string
      name: string
      path: string
      detectedAt: string
      lastSeenAt: string
    }[]
    aiUsageByProject: {
      projectId: string | null
      projectName: string | null
      totalCost: number
      totalTokens: number
    }[]
  } | null

  density: {
    bucketSize: 'day' | 'week' | 'month'
    buckets: {
      label: string
      start: string
      end: string
      intensity: number // 0..1
      counts: {
        appSessions: number
        browserSessions: number
        focusSessions: number
        transactions: number
        sleepSessions: number
        aiRequests: number
        codeEvents: number
        memories: number
      }
    }[]
  }
}
```

---

# 4. Main-Process Computation Rules

All computation happens in the main process. The renderer never touches SQLite directly.

The date range overlap rule should be:

```sql
record_start <= phase_end
AND record_end >= phase_start
```

For records with only one date field:

```sql
date BETWEEN phase_start AND phase_end
```

For ongoing phases, use today as the phase end.

---

## 4.1 App usage

Source:

```sql
logs
```

Fields:

```sql
app_name
start_time
end_time
duration
category
```

Compute:

- total tracked time
- productive time
- distracting time
- neutral time
- top apps by duration
- hourly distribution
- weekly trend if needed for summary

Categories:

```text
productive
neutral
distracting
external
unknown
```

For the summary chip:

```text
Productive time = productiveMs
```

For the donut:

```text
productive / neutral / distracting / external
```

---

## 4.2 Browser activity

Source:

```sql
browser_sessions
```

Compute:

- total browsing time
- top domains
- top page titles where useful
- category distribution if category exists

Empty state:

```text
No browser activity captured during this chapter.
```

If browser tracking started after the phase began, this should read as historical silence, not failure.

---

## 4.3 Focus sessions

Source:

```sql
deep_focus_sessions
focus_groups
```

Compute:

- total focus time
- session count
- average session length
- strictness breakdown
- apps used during focus
- inferred focus group usage

Focus group inference:

1. If session already stores a group id, use it.
2. If not, compare `apps_used` with `focus_groups.allowed_apps`.
3. Choose the best-matching group.
4. If no group matches, label it `Ungrouped`.

Visual:

- total focus hours large
- session count secondary
- strictness segmented bar
- focus group chips with group color

---

## 4.4 Finance

Sources:

```sql
finance_transactions
finance_wallets
finance_subscriptions
```

Compute:

- income total
- expense total
- transfer total
- net
- top spending categories
- wallet deltas
- estimated subscription burn

Important:

Transfers should not count as spending or income in the net summary unless the existing app already treats them that way.

Recommended:

```text
Net = income - expense
```

Transfers appear separately.

Wallet delta:

```text
sum of transaction amount affecting wallet
```

If the currency is mixed, show the dominant currency and avoid summing incompatible currencies. If currency handling is not available yet, show a neutral amount without symbol.

---

## 4.5 Subscriptions

Source:

```sql
finance_subscriptions
```

A subscription is active during the phase if:

```text
status is active
AND next_billing_date or billing cycle suggests it overlapped the phase
```

Because subscription history may be incomplete, use a conservative label:

```text
Estimated monthly burn
```

Not:

```text
Exact historical spend
```

unless transaction data confirms it.

---

## 4.6 Sleep

Source:

```sql
external_sessions
WHERE type = 'sleep'
```

Compute:

- session count
- total sleep time
- average sleep duration
- average bedtime
- average wake time
- consistency score

Consistency score can start simple:

```text
100 - normalized standard deviation of start times
```

Clamp between 0 and 100.

Visual:

- average duration large
- bedtime/wake time small mono text
- consistency bar
- optional tiny night-by-night sparkline

Empty state:

```text
No sleep sessions tracked during this chapter.
```

---

## 4.7 AI usage

Source:

```sql
ai_usage
```

Compute:

- request count
- tokens in
- tokens out
- total cost
- top tools
- top models
- monthly AI activity sparkline

Visual accent:

```text
violet-400
```

Empty state:

```text
No AI usage recorded during this chapter.
```

---

## 4.8 Code activity

Source:

```sql
code_activity
```

Compute:

- total events
- lines added
- lines removed
- most edited files
- most active workspaces

Visual:

- green/emerald for additions
- rose for deletions
- monospace file names
- truncated paths with tooltip

Empty state:

```text
No code activity captured during this chapter.
```

---

## 4.9 IDE projects

Sources:

```sql
projects
ai_usage
```

A project is active if:

```text
project.detected_at <= phase_end
AND project.last_seen_at >= phase_start
```

Compute:

- active projects
- AI usage per project
- cost per project
- token usage per project

Visual:

- project chips
- small cost/token bars per project

---

## 4.10 Dashboard summary

The summary strip is computed from the above systems.

It should show only the strongest signals:

```text
Productive time
Focus time
Net finance
Average sleep
AI cost
Code edits
Covenant kept
Goals active
Memories kept
```

Do not show all of these if most are empty. Show the top 4–6 available chips.

---

# 5. PhaseCard Expansion Design

## 5.1 Collapsed state

The collapsed card remains close to the current design:

- header band
- title
- date range
- magnitude
- memory pearls if present
- story excerpt
- covenant / gold / memory strips

Add one clear expand affordance:

```tsx
<button
  onClick={() => onToggleExpand(phase.id)}
  aria-expanded={expanded}
  className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 text-[12px] text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
>
  {expanded ? 'Close chapter context' : 'Open chapter context'}
  <ChevronDown
    className={cn(
      'h-4 w-4 transition-transform',
      expanded && 'rotate-180'
    )}
  />
</button>
```

Do not make the entire header the expand button, because the header may also contain memory, edit, and connection interactions.

---

## 5.2 Expanded state layout

Expanded structure:

```text
PhaseCard header
──────────────────────────────
Expandable body
  Sticky context toolbar
    - System / Manual toggle
    - Edit phase
    - Add attachment
  Density heatmap
  System view OR Manual view
```

Recommended JSX shell:

```tsx
<AnimatePresence initial={false}>
  {expanded && (
    <motion.div
      key="phase-context"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden border-t border-zinc-800/60"
    >
      <div className="space-y-5 p-5">
        <PhaseContextToolbar
          mode={mode}
          onModeChange={setMode}
          onEditPhase={() => onEditPhase(phase)}
          onAddAttachment={openAttachmentPicker}
        />

        <DensityHeatmap density={context?.density} />

        {mode === 'system' ? (
          <SystemContextView context={context} />
        ) : (
          <ManualContextView
            phase={phase}
            memories={attachedMemories}
            goals={attachedGoals}
            covenants={attachedCovenants}
            onAttachMemory={openMemoryPicker}
            onAttachGoal={openGoalPicker}
            onAddCovenant={openCovenantForm}
          />
        )}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

---

## 5.3 Spacing and visual tokens

Expanded body:

```tsx
className="space-y-5 p-5"
```

Panels:

```tsx
className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl"
```

Panel title:

```tsx
className="text-[11px] uppercase tracking-wider text-zinc-500"
```

Primary number:

```tsx
className="font-mono text-2xl text-zinc-100"
```

Secondary label:

```tsx
className="text-[12px] text-zinc-500"
```

Accent colors:

```text
amber-400   Gold / warmth / summary
rose-400    Covenant
emerald-400 Memories
sky-400     System / app / focus
violet-400  AI usage
```

---

# 6. System View Design

## 6.1 System view hierarchy

The System view should feel like a contextual report, not a dashboard dump.

Order:

1. Summary chips
2. Density heatmap
3. Primary life systems
4. Secondary systems
5. Rare / specialist systems

Recommended grid:

```tsx
<div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
  <AppUsagePanel />
  <FocusPanel />
  <FinancePanel />
  <SleepPanel />
  <BrowserPanel />
  <AiUsagePanel />
  <CodePanel />
  <ProjectsPanel />
  <SubscriptionsPanel />
</div>
```

On smaller screens, panels stack.

---

## 6.2 Summary chips

Place these above the panel grid.

```tsx
<div className="flex flex-wrap gap-2">
  <SummaryChip label="Productive" value="42h" accent="amber" />
  <SummaryChip label="Focus" value="18h" accent="sky" />
  <SummaryChip label="Net" value="+$320" accent="emerald" />
  <SummaryChip label="Sleep" value="7.2h" accent="violet" />
  <SummaryChip label="AI cost" value="$4.80" accent="violet" />
  <SummaryChip label="Covenant" value="21 kept" accent="rose" />
</div>
```

Rules:

- Show only chips with real data.
- Maximum 6 chips by default.
- If more exist, show a `+N more` chip.
- Empty systems should not create empty chips.

---

## 6.3 App Usage panel

Title:

```text
App Usage
```

Accent:

```text
sky-400
```

Primary metric:

```text
total tracked hours
```

Secondary metric:

```text
productive / distracting ratio
```

Visualization:

- horizontal stacked bar for categories
- top 3 apps as small bars
- optional hourly mini-heatmap

Recommended layout:

```tsx
<section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
  <header className="flex items-center justify-between">
    <h4 className="text-[11px] uppercase tracking-wider text-zinc-500">
      App Usage
    </h4>
    <Monitor className="h-4 w-4 text-sky-400/70" />
  </header>

  <p className="mt-3 font-mono text-2xl text-zinc-100">
    {formatMs(context.appUsage.totalMs)}
  </p>

  <p className="text-[12px] text-zinc-500">
    tracked across this chapter
  </p>

  <div className="mt-4 space-y-2">
    <CategoryBar
      segments={[
        { label: 'Productive', value: productiveMs, className: 'bg-emerald-400/70' },
        { label: 'Neutral', value: neutralMs, className: 'bg-zinc-500/60' },
        { label: 'Distracting', value: distractingMs, className: 'bg-rose-400/70' },
      ]}
    />
  </div>

  <ul className="mt-4 space-y-2">
    {context.appUsage.topApps.slice(0, 3).map(app => (
      <li key={app.name} className="flex items-center justify-between gap-3">
        <span className="truncate text-[12px] text-zinc-300">{app.name}</span>
        <span className="font-mono text-[11px] text-zinc-500">
          {formatMs(app.totalMs)}
        </span>
      </li>
    ))}
  </ul>
</section>
```

Empty state:

```text
No app tracking during this chapter.
```

Subtext:

```text
DeskFlow started recording later, or this chapter predates your tracking.
```

---

## 6.4 Browser panel

Title:

```text
Browser
```

Accent:

```text
sky-400
```

Primary:

```text
total browsing time
```

Visualization:

- top 3 domains
- small horizontal bars

Empty state:

```text
No browser sessions captured during this chapter.
```

---

## 6.5 Focus panel

Title:

```text
Deep Focus
```

Accent:

```text
sky-400
```

Primary:

```text
total focus time
```

Secondary:

```text
session count
average session
```

Visualization:

- strictness segmented bar
- focus group chips
- top apps used during focus

Example:

```tsx
<div className="mt-4 grid grid-cols-3 gap-2">
  <MiniStat label="Sessions" value="34" />
  <MiniStat label="Avg" value="48m" />
  <MiniStat label="Longest" value="2h 10m" />
</div>
```

Empty state:

```text
No deep focus sessions during this chapter.
```

---

## 6.6 Finance panel

Title:

```text
Finance
```

Accent:

```text
emerald-400
```

Primary:

```text
net
```

Secondary:

```text
income
expense
```

Visualization:

- income bar
- expense bar
- top spending categories
- wallet delta chips

Example:

```tsx
<div className="mt-4 grid grid-cols-3 gap-2">
  <MiniStat label="Income" value="+$1,200" tone="positive" />
  <MiniStat label="Expense" value="-$640" tone="negative" />
  <MiniStat label="Net" value="+$560" tone="positive" />
</div>
```

Top categories:

```tsx
<ul className="mt-4 space-y-2">
  {finance.topCategories.slice(0, 3).map(category => (
    <li key={category.label} className="flex items-center justify-between gap-3">
      <span className="truncate text-[12px] text-zinc-300">
        {category.label}
      </span>
      <span className="font-mono text-[11px] text-zinc-500">
        {formatMoney(category.total)}
      </span>
    </li>
  ))}
</ul>
```

Empty state:

```text
No finance activity recorded during this chapter.
```

---

## 6.7 Subscriptions panel

Title:

```text
Subscriptions
```

Accent:

```text
emerald-400
```

Primary:

```text
estimated monthly burn
```

List:

```text
subscription name
billing cycle
amount
```

Empty state:

```text
No subscriptions appear active during this chapter.
```

---

## 6.8 Sleep panel

Title:

```text
Sleep
```

Accent:

```text
violet-400
```

Primary:

```text
average sleep duration
```

Secondary:

```text
bedtime
wake time
consistency
```

Visualization:

- consistency bar
- tiny nightly sparkline or dot row

Empty state:

```text
No sleep tracking during this chapter.
```

---

## 6.9 AI usage panel

Title:

```text
AI Usage
```

Accent:

```text
violet-400
```

Primary:

```text
total cost or total requests
```

Secondary:

```text
tokens in / tokens out
```

Visualization:

- top tools bars
- top models chips

Empty state:

```text
No AI usage recorded during this chapter.
```

---

## 6.10 Code activity panel

Title:

```text
Code Activity
```

Accent:

```text
emerald-400
```

Primary:

```text
lines added / removed
```

Visualization:

```text
+12,480 added
-3,920 removed
```

Top files list:

```tsx
<ul className="mt-4 space-y-2">
  {code.topFiles.slice(0, 3).map(file => (
    <li key={file.filePath} className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2">
      <p className="truncate font-mono text-[11px] text-zinc-300">
        {file.filePath}
      </p>
      <p className="mt-1 font-mono text-[10px] text-zinc-500">
        <span className="text-emerald-400/80">+{file.linesAdded}</span>
        {' '}
        <span className="text-rose-400/80">-{file.linesRemoved}</span>
      </p>
    </li>
  ))}
</ul>
```

Empty state:

```text
No code activity captured during this chapter.
```

---

## 6.11 Projects panel

Title:

```text
Projects
```

Accent:

```text
amber-400
```

Show:

- active project chips
- AI usage by project if available

Empty state:

```text
No projects detected during this chapter.
```

---

# 7. Manual View Design

The Manual view should feel like an archive drawer.

It is not a form. It is a curated collection.

## 7.1 Manual view sections

Order:

1. Memories
2. Goals
3. Covenants
4. Milestones
5. People

Each section has:

- title
- count
- add button
- empty state

---

## 7.2 Memories section

Use the existing Memory Pearls language.

Attached memories:

```text
Manually attached
```

Date-range memories:

```text
Happened during this chapter
```

Visual:

```tsx
<div className="flex flex-wrap gap-2">
  {memories.map(memory => (
    <button
      key={memory.meta.id}
      onClick={() => onOpenMemory(memory)}
      className="h-16 w-16 overflow-hidden rounded-lg border border-emerald-500/20 transition-colors hover:border-emerald-400/50"
    >
      <img
        src={memory.url}
        alt=""
        className="h-full w-full object-cover"
      />
    </button>
  ))}
</div>
```

Add memory button:

```tsx
<button
  onClick={onAttachMemory}
  className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 text-[12px] text-emerald-200 transition-colors hover:bg-emerald-500/10"
>
  <Images className="h-4 w-4" />
  Attach memory
</button>
```

Empty state:

```text
No memories attached yet.
```

Subtext:

```text
Attach an old moment, or add one that belongs to this chapter.
```

---

## 7.3 Goals section

Show two groups:

```text
Linked to this chapter
Active during this chapter
```

Goal item:

```tsx
<li className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2.5">
  <div className="flex items-center justify-between gap-3">
    <p className="truncate text-[13px] text-zinc-200">{goal.title}</p>
    <span className="rounded-full bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-200">
      {goal.kind === 'longterm' ? 'long-term' : 'daily'}
    </span>
  </div>

  {goal.targetDate && (
    <p className="mt-1 font-mono text-[11px] text-zinc-500">
      {goal.targetDate}
    </p>
  )}
</li>
```

Add goal button:

```tsx
<button
  onClick={onAttachGoal}
  className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 text-[12px] text-amber-200 transition-colors hover:bg-amber-500/10"
>
  <Target className="h-4 w-4" />
  Attach goal
</button>
```

Full editing:

```text
Open in Gold page
```

---

## 7.4 Covenants section

Show:

- commitments linked to the phase
- completions that happened during the phase

Item:

```tsx
<li className="rounded-lg border border-rose-500/15 bg-rose-500/[0.04] px-3 py-2.5">
  <div className="flex items-center justify-between gap-3">
    <p className="truncate text-[13px] text-zinc-200">
      {commitment.title}
    </p>

    <span className="rounded-full bg-rose-400/10 px-2 py-0.5 font-mono text-[10px] text-rose-200">
      {completionCount} kept
    </span>
  </div>
</li>
```

Add covenant button:

```tsx
<button
  onClick={onAddCovenant}
  className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 text-[12px] text-rose-200 transition-colors hover:bg-rose-500/10"
>
  <Sparkles className="h-4 w-4" />
  Add covenant
</button>
```

---

## 7.5 Milestones section

Use the existing milestone model from `LifePhase`.

Visual:

```tsx
<ol className="space-y-3 border-l border-zinc-800 pl-4">
  {phase.milestones.map(milestone => (
    <li key={milestone.id} className="relative">
      <span
        className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: phase.color }}
      />

      <p className="font-mono text-[11px] text-zinc-500">
        {milestone.date}
      </p>

      <p className="text-[13px] text-zinc-200">
        {milestone.label}
      </p>

      {milestone.note && (
        <p className="mt-1 text-[12px] text-zinc-500">
          {milestone.note}
        </p>
      )}
    </li>
  ))}
</ol>
```

Add milestone button:

```tsx
<button className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-[12px] text-zinc-300 hover:border-zinc-600">
  <Plus className="h-4 w-4" />
  Add milestone
</button>
```

---

## 7.6 People section

Use avatar chips:

```tsx
<div className="flex flex-wrap gap-2">
  {phase.people?.map(person => (
    <div
      key={person.id}
      className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 py-1.5 pl-1.5 pr-3"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-300">
        {getInitials(person.name)}
      </span>

      <span>
        <span className="block text-[12px] text-zinc-200">
          {person.name}
        </span>
        <span className="block text-[10px] text-zinc-500">
          {person.role}
        </span>
      </span>
    </div>
  ))}
</div>
```

---

# 8. Density Heatmap

The heatmap shows when life data was most active during the phase.

It belongs at the top of the expanded body, below the toolbar.

## 8.1 Bucketing rules

```text
Phase length <= 62 days     daily buckets
Phase length <= 365 days    weekly buckets
Phase length > 365 days     monthly buckets
```

## 8.2 Intensity sources

Each bucket counts:

- app sessions
- browser sessions
- focus sessions
- finance transactions
- sleep sessions
- AI requests
- code events
- memories

Normalize the final intensity to `0..1`.

## 8.3 Visual

```tsx
<div className="flex h-10 items-end gap-1 overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-1.5">
  {density.buckets.map(bucket => (
    <div
      key={bucket.start}
      title={`${bucket.label}: ${formatBucketCounts(bucket.counts)}`}
      className="h-full flex-1 rounded-sm bg-amber-400"
      style={{ opacity: 0.08 + bucket.intensity * 0.9 }}
    />
  ))}
</div>
```

Color:

```text
amber-400
```

Why amber:

- it matches warmth,
- it reads as sediment,
- it does not compete with Covenant rose, Memory emerald, or Gold amber accents elsewhere.

Empty state:

```text
No activity density recorded for this chapter yet.
```

If the phase is old or predates tracking, show:

```text
This chapter predates DeskFlow tracking.
```

That wording matters. It makes absence feel historical, not broken.

---

# 9. Mode Toggle Design

The System / Manual toggle should be a small segmented control.

```tsx
<div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950/50 p-0.5">
  <button
    onClick={() => setMode('system')}
    className={cn(
      'relative flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] transition-colors',
      mode === 'system'
        ? 'text-white'
        : 'text-zinc-500 hover:text-zinc-300'
    )}
  >
    {mode === 'system' && (
      <motion.div
        layoutId={`phase-context-mode-${phase.id}`}
        className="absolute inset-0 rounded-md border border-white/10 bg-zinc-700/80"
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      />
    )}

    <span className="relative z-10">System</span>
  </button>

  <button
    onClick={() => setMode('manual')}
    className={cn(
      'relative flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] transition-colors',
      mode === 'manual'
        ? 'text-white'
        : 'text-zinc-500 hover:text-zinc-300'
    )}
  >
    {mode === 'manual' && (
      <motion.div
        layoutId={`phase-context-mode-${phase.id}`}
        className="absolute inset-0 rounded-md border border-white/10 bg-zinc-700/80"
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      />
    )}

    <span className="relative z-10">Manual</span>
  </button>
</div>
```

Default mode:

```text
If system context has data → System
If no system data → Manual
```

This avoids opening an empty System view for old phases.

---

# 10. Attachment Pickers

## 10.1 Memory picker

The memory picker should be a modal overlay inside River mode.

It should not navigate away.

Layout:

```text
Modal title: Attach memory
Search input
Filter chips:
  - All memories
  - Unattached
  - During this phase
Grid of memory thumbnails
Selected state
Footer:
  Cancel
  Attach selected
```

Memory thumbnail:

```tsx
<button
  onClick={() => toggleMemory(memory.meta.id)}
  className={cn(
    'relative h-24 overflow-hidden rounded-lg border transition-colors',
    selected
      ? 'border-emerald-400/70'
      : 'border-zinc-800 hover:border-zinc-600'
  )}
>
  <img
    src={memory.url}
    alt=""
    className="h-full w-full object-cover"
  />

  {selected && (
    <span className="absolute right-2 top-2 rounded-full bg-emerald-400/90 p-1 text-zinc-950">
      <Check className="h-3 w-3" />
    </span>
  )}
</button>
```

Attach action:

```ts
await window.deskflowAPI.memories.update(memoryId, {
  phaseId: phase.id,
})
```

If the existing memory API uses a different save method, use the existing one. The important part is that the overlay does not leave River mode.

For full memory creation, provide:

```text
Need more detail? Open Memories page
```

This deep-links to Pages mode with the phase prefill preserved.

---

## 10.2 Goal picker

Modal title:

```text
Attach goal
```

Show:

- long-term goals
- daily goals if relevant
- goals already linked to this phase shown as selected

Item:

```tsx
<button
  onClick={() => toggleGoal(goal.id)}
  className={cn(
    'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
    selected
      ? 'border-amber-400/50 bg-amber-400/10'
      : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-600'
  )}
>
  <p className="truncate text-[13px] text-zinc-200">{goal.title}</p>
  <p className="mt-1 font-mono text-[11px] text-zinc-500">
    {goal.targetDate ?? 'No target date'}
  </p>
</button>
```

Attach action:

```ts
await window.deskflowAPI.goals.update(goalId, {
  phaseId: phase.id,
})
```

or if long-term goals use links:

```ts
await window.deskflowAPI.longtermGoals.update(goalId, {
  links: [...existingLinks, phase.id],
})
```

For full goal creation:

```text
Create in Gold page
```

River may allow a minimal quick goal:

```text
title
target date
optional phase link
```

But full fields belong on the Gold page.

---

## 10.3 Covenant quick create

Covenant creation can be inline because covenants are intentionally lightweight.

Fields:

```text
Commitment title
Optional note
Phase link = current phase
Start date = phase start or today
```

Minimal form:

```tsx
<div className="space-y-3">
  <div>
    <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
      Commitment
    </label>

    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="What did you promise yourself during this chapter?"
      className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
    />
  </div>

  <div>
    <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
      Note
    </label>

    <textarea
      value={note}
      onChange={(e) => setNote(e.target.value)}
      placeholder="Optional"
      className="min-h-20 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
    />
  </div>
</div>
```

Save:

```ts
await saveCovenantCommitment({
  id: uid('covenant'),
  title,
  note,
  phaseId: phase.id,
})
```

Full covenant management still belongs on the Covenant page.

---

# 11. Editing Rules

## 11.1 Inline editing

Use inline editing only for lightweight actions:

- attach memory
- detach memory
- attach goal
- detach goal
- add covenant
- remove covenant link
- add milestone
- add person
- edit phase note fields inside the existing phase dialog

## 11.2 Deep editing

Redirect to specialist Pages for:

- full memory creation with image management
- full goal editing with progress and focus groups
- full covenant management
- finance editing
- focus group editing
- sleep correction
- AI usage inspection
- code activity inspection

The River should include deep-link buttons:

```text
Open Memories page
Open Gold page
Open Covenant page
Open Focus page
Open Finance page
```

These buttons should preserve context:

```ts
setViewMode('pages')
setPageTab('memories')
setPrefill({ phaseId: phase.id })
```

If the current app state does not support prefill yet, add a lightweight `pendingLifeContext` state.

---

# 12. State Design

Add to `LifePage.tsx`:

```tsx
const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null)
const [expandedMode, setExpandedMode] = useState<'system' | 'manual'>('system')
const [attachmentPicker, setAttachmentPicker] = useState<
  null | 'memory' | 'goal' | 'covenant'
>(null)
const [attachmentPhaseId, setAttachmentPhaseId] = useState<string | null>(null)
```

Handler:

```tsx
const togglePhaseContext = (phaseId: string) => {
  setExpandedPhaseId(current =>
    current === phaseId ? null : phaseId
  )

  setExpandedMode('system')
}
```

When a phase expands:

```tsx
const phase = phases.find(p => p.id === expandedPhaseId)

if (phase) {
  const range = getPhaseRange(phase)

  const context = await window.deskflowAPI.lifePhase.getPeriodContext(
    range.start,
    range.end
  )

  if (!context.availability.appUsage && !context.availability.focus && !context.availability.finance) {
    setExpandedMode('manual')
  }
}
```

---

# 13. Context Loading Hook

Create:

```text
src/hooks/usePeriodContext.ts
```

```ts
import { useEffect, useState } from 'react'

export function usePeriodContext(
  phaseId: string | null,
  start: string | null,
  end: string | null,
  enabled: boolean
) {
  const [context, setContext] = useState<PhasePeriodContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !phaseId || !start) {
      setContext(null)
      return
    }

    let active = true

    setLoading(true)
    setError(null)

    window.deskflowAPI.lifePhase
      .getPeriodContext(start, end)
      .then(result => {
        if (active) setContext(result)
      })
      .catch(err => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load context')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [phaseId, start, end, enabled])

  return { context, loading, error }
}
```

Use it inside the expanded card only.

Do not load context for collapsed cards.

---

# 14. Empty State Rules

Every panel must degrade gracefully.

## 14.1 Tone

Empty states should never sound like errors.

Bad:

```text
No data found.
```

Better:

```text
Nothing tracked here yet.
```

Best:

```text
This chapter may predate DeskFlow tracking.
```

---

## 14.2 Empty panel component

```tsx
function EmptyContextPanel({
  title,
  message,
  icon: Icon,
}: {
  title: string
  message: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <section className="rounded-xl border border-dashed border-zinc-800/70 bg-zinc-950/20 p-5">
      <header className="flex items-center justify-between">
        <h4 className="text-[11px] uppercase tracking-wider text-zinc-600">
          {title}
        </h4>

        <Icon className="h-4 w-4 text-zinc-700" />
      </header>

      <p className="mt-3 text-[13px] text-zinc-500">
        {message}
      </p>
    </section>
  )
}
```

Use dashed borders for empty system panels.

Use solid glass panels only when data exists.

---

# 15. Loading States

Use skeleton panels.

```tsx
function ContextSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5"
        >
          <div className="h-3 w-20 rounded bg-zinc-800" />
          <div className="mt-4 h-7 w-28 rounded bg-zinc-800" />
          <div className="mt-3 h-3 w-40 rounded bg-zinc-800/70" />
          <div className="mt-6 space-y-2">
            <div className="h-2.5 w-full rounded bg-zinc-800/60" />
            <div className="h-2.5 w-4/5 rounded bg-zinc-800/60" />
            <div className="h-2.5 w-3/5 rounded bg-zinc-800/60" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

Loading rule:

```text
Show skeleton only while expanded and System tab is active.
```

Manual tab should render immediately because it uses existing phase/memory/goal state.

---

# 16. Interaction Flow

## 16.1 Expand phase

1. User clicks `Open chapter context`.
2. Card expands with height animation.
3. If the card is far below the viewport, smooth-scroll it into view.
4. System context loads lazily.
5. Default tab is System if data exists, otherwise Manual.

Scroll behavior:

```ts
document
  .getElementById(`phase-card-${phaseId}`)
  ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
```

Use `block: 'nearest'` to avoid aggressive jumping.

---

## 16.2 Switch System / Manual

1. User clicks segmented control.
2. Active pill slides using `layoutId`.
3. Content crossfades.
4. System data remains cached.
5. Manual data renders from existing state.

Do not reload context when switching back to System.

---

## 16.3 Attach memory

1. User clicks `Attach memory`.
2. Memory picker modal opens inside River mode.
3. Default filter: `During this phase`.
4. User selects one or more memories.
5. Click `Attach selected`.
6. Memory `phaseId` is updated.
7. Modal closes.
8. Manual view refreshes.
9. Memory thumbnails appear under `Attached manually`.

No page navigation occurs.

---

## 16.4 Create memory

Two paths:

### Quick path

River mode allows:

```text
title
date
note
image
phase link
```

This is enough for a basic memory.

### Full path

If the user wants:

- multiple images,
- detailed tags,
- library organization,
- rich editing,

show:

```text
Open full Memories editor
```

This switches to Pages mode with the phase prefill.

---

## 16.5 Attach goal

1. User clicks `Attach goal`.
2. Goal picker modal opens.
3. Existing goals are listed.
4. Goals already attached show selected state.
5. User confirms.
6. Goal receives phase link.
7. Card refreshes.

For full goal creation:

```text
Create full goal in Gold page
```

---

## 16.6 Add covenant

1. User clicks `Add covenant`.
2. Inline covenant modal opens.
3. User enters commitment title and optional note.
4. Covenant is saved with `phaseId`.
5. It appears in the Manual covenant section.
6. If completions exist later, they appear in System/Manual summaries by date.

---

## 16.7 Edit attached data

For lightweight edits:

- detach memory
- detach goal
- remove covenant link
- edit milestone
- remove person

Use inline menus or small hover actions.

For full edits:

```text
Open in specialist page
```

---

# 17. Data Density Rules

The expanded card must not become overwhelming.

## 17.1 Progressive disclosure

Each panel shows:

```text
1 primary metric
2 secondary metrics
3 top items
```

Then:

```text
Show more
```

Example:

```text
Top apps
- VS Code
- Chrome
- Spotify

Show more
```

---

## 17.2 Panel collapse

On small screens, panels should collapse into accordion rows.

Recommended mobile pattern:

```text
Summary chips
Density heatmap
Accordion:
  App Usage
  Focus
  Finance
  Sleep
  Browser
  AI Usage
  Code
  Projects
  Subscriptions
```

---

## 17.3 Maximum visible items

Default limits:

```text
Top apps: 3
Top domains: 3
Top categories: 3
Top files: 3
Projects: 4 chips
Memories: 6 thumbnails, then +N
Goals: 4 items, then show all
Covenants: 4 items, then show all
```

---

# 18. File-Level Implementation Plan

## 18.1 Existing files to modify

### `src/features/warmth/LifePage.tsx`

Add:

```tsx
expandedPhaseId
expandedMode
attachmentPicker
attachmentPhaseId
pendingPagePrefill
```

Render:

```tsx
<MemoryAttachPicker />
<GoalAttachPicker />
<PhaseCovenantQuickForm />
```

Update `PhaseCard` usage:

```tsx
<PhaseCard
  phase={phase}
  expanded={expandedPhaseId === phase.id}
  onToggleExpand={togglePhaseContext}
  onEditPhase={() => setEditingPhase(phase)}
  onAttachMemory={() => {
    setAttachmentPicker('memory')
    setAttachmentPhaseId(phase.id)
  }}
  onAttachGoal={() => {
    setAttachmentPicker('goal')
    setAttachmentPhaseId(phase.id)
  }}
  onAddCovenant={() => {
    setAttachmentPicker('covenant')
    setAttachmentPhaseId(phase.id)
  }}
  onOpenSpecialistPage={(tab) => {
    setViewMode('pages')
    setPageTab(tab)
  }}
/>
```

---

### `src/components/life-river/PhaseCard.tsx`

Add:

```tsx
expanded?: boolean
onToggleExpand?: () => void
```

Add expanded body:

```tsx
<PhaseContextBody />
```

Keep collapsed strips.

Do not remove lens behavior.

---

### `src/components/life-river/phase-form-dialog.tsx`

No major change required for this integration, except ensuring manual fields remain available:

- milestones
- people
- feelings
- lessons
- impact
- reflection

Voice input remains connected to all meaning fields.

---

## 18.2 New components

Create:

```text
src/components/life-river/phase-context/PhaseContextBody.tsx
src/components/life-river/phase-context/SystemContextView.tsx
src/components/life-river/phase-context/ManualContextView.tsx
src/components/life-river/phase-context/DensityHeatmap.tsx
src/components/life-river/phase-context/SummaryChip.tsx
src/components/life-river/phase-context/MiniStat.tsx
src/components/life-river/phase-context/CategoryBar.tsx
src/components/life-river/phase-context/EmptyContextPanel.tsx
src/components/life-river/phase-context/ContextSkeleton.tsx

src/components/life-river/phase-context/panels/AppUsagePanel.tsx
src/components/life-river/phase-context/panels/BrowserPanel.tsx
src/components/life-river/phase-context/panels/FocusPanel.tsx
src/components/life-river/phase-context/panels/FinancePanel.tsx
src/components/life-river/phase-context/panels/SubscriptionsPanel.tsx
src/components/life-river/phase-context/panels/SleepPanel.tsx
src/components/life-river/phase-context/panels/AiUsagePanel.tsx
src/components/life-river/phase-context/panels/CodePanel.tsx
src/components/life-river/phase-context/panels/ProjectsPanel.tsx

src/components/life-river/attach/MemoryAttachPicker.tsx
src/components/life-river/attach/GoalAttachPicker.tsx
src/components/life-river/attach/PhaseCovenantQuickForm.tsx
```

---

# 19. Main-Process Implementation Plan

Add or extend:

```text
src/main/lifePhase/periodContext.ts
```

Export:

```ts
export async function getPeriodContext(
  startDate: string,
  endDate: string | null
): Promise<PhasePeriodContext>
```

Internally use existing repositories/services:

```text
logs repo
browser sessions repo
focus sessions repo
finance repo
external sessions repo
ai usage repo
code activity repo
projects repo
memories repo
goals repo
covenant state/localStorage bridge if available in main
```

If covenant state lives only in renderer/localStorage, covenant counts may initially be computed in renderer from `useCovenant()` instead of main process.

That is acceptable.

The important rule is:

```text
SQLite-heavy aggregation happens in main.
Local covenant state can remain renderer-side until a proper covenant store exists.
```

---

# 20. Constraint Compliance

## 20.1 No new database tables

This design uses existing tables:

```text
logs
browser_sessions
deep_focus_sessions
focus_groups
finance_transactions
finance_wallets
finance_subscriptions
external_sessions
ai_usage
code_activity
projects
memories
goals / long-term goals
life_phases
```

No new tables are required.

---

## 20.2 IPC-only renderer access

The renderer calls:

```ts
window.deskflowAPI.lifePhase.getPeriodContext(start, end)
```

It does not access SQLite directly.

---

## 20.3 Existing fields remain additive

No existing `LifePhase` field is renamed or removed.

New attachment behavior uses optional fields:

```ts
memory.phaseId?
goal.phaseId?
goal.links?
covenantCommitment.phaseId?
```

---

## 20.4 River remains visualization

River does not become the full data entry layer.

Full data entry stays in Pages.

River provides:

```text
quick attach
quick capture
contextual summary
deep links
```

---

## 20.5 Design system compliance

All UI uses:

```text
dark mode only
bg-zinc-900/30 glass panels
backdrop-blur-xl
rounded-xl maximum
p-5 panels
amber / rose / emerald / sky / violet accents
Geist body
JetBrains Mono for numbers, dates, file names
```

No new npm packages are required.

Charts are built from:

```text
SVG
CSS bars
Framer Motion
Tailwind
```

---

# 21. Acceptance Criteria

The integration is complete when:

- [ ] Expanding a phase reveals a context body.
- [ ] The context body has System / Manual toggle.
- [ ] System view lazy-loads period context.
- [ ] Manual view renders immediately.
- [ ] App usage appears when available.
- [ ] Browser activity appears when available.
- [ ] Focus sessions appear when available.
- [ ] Finance summary appears when available.
- [ ] Subscriptions appear when available.
- [ ] Sleep appears when available.
- [ ] AI usage appears when available.
- [ ] Code activity appears when available.
- [ ] Projects appear when available.
- [ ] Density heatmap appears when any tracked data exists.
- [ ] Memories can be attached without leaving River mode.
- [ ] Goals can be attached without leaving River mode.
- [ ] Covenants can be created with a phase link.
- [ ] Full editing deep-links to the appropriate Page.
- [ ] Empty states feel historical, not broken.
- [ ] Loading states use skeleton glass panels.
- [ ] Old phases with no system data default gracefully to Manual.
- [ ] The River remains the orchestration layer, not a replacement for Pages.