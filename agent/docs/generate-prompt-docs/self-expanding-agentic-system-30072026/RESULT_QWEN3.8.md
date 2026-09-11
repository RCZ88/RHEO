Below is the full content to save as `RESULT.md`.

```md
# RESULT.md — Self-Expanding Agentic System Architecture & Specification

**Project:** DeskFlow  
**Feature:** Self-Expanding Agentic System  
**Date:** 2026-07-30  
**Status:** Engineering Specification  
**Target Stack:** Electron + React + better-sqlite3 + Tailwind CSS  
**Constraint Summary:** No AI code generation, no arbitrary execution, offline-first, DSL-only composition, full auditability, existing glass UI pattern, no new npm packages.

---

## 1. Architecture Overview

### 1.1 North Star

The system allows DeskFlow to “expand” by letting the AI propose and the user approve **new compositions** of existing feature data and actions.

The AI never creates:

- new React components
- new DB tables
- new IPC handlers
- arbitrary JavaScript/Python/SQL

The AI only creates **DSL compositions** using app-provided building blocks.

A composition is a safe, auditable rule such as:

```txt
WHEN screen activity happens after 22:00
IF goal “Sleep by 22:00” is active
THEN mark that goal as abandoned
```

This gives DeskFlow a controlled self-expanding capability without giving the AI code access.

---

### 1.2 High-Level System Diagram

```txt
┌──────────────────────────────────── Renderer ─────────────────────────────────────┐
│                                                                                  │
│  React SPA                                                                       │
│  ├── CompositionsPage                                                            │
│  │   ├── CompositionDashboard                                                    │
│  │   ├── CompositionCard                                                         │
│  │   ├── CompositionEditorModal                                                  │
│  │   ├── GuidedRuleBuilder                                                       │
│  │   ├── DslEditor                                                               │
│  │   ├── CompositionDetailDrawer                                                 │
│  │   ├── ActivityFeed                                                            │
│  │   └── AISuggestionModal                                                       │
│  │                                                                               │
│  ├── CompositionsProvider                                                        │
│  │   ├── useCompositions()                                                       │
│  │   ├── useCompositionExecutions()                                              │
│  │   ├── useCompositionSettings()                                                │
│  │   └── useCompositionManifests()                                               │
│  │                                                                               │
│  └── Existing Subsystem UIs                                                      │
│      ├── GoalsPage                                                               │
│      ├── LearnPage                                                               │
│      ├── IDEProjectsPage                                                         │
│      ├── FinancePage                                                             │
│      └── AiPage                                                                  │
│                                                                                  │
└───────────────▲──────────────────────────────────────────────┬───────────────────┘
                │                                              │
                │ ipcRenderer.invoke                           │ ipcRenderer.on
                │ compositions:*                               │ compositions:changed
                │                                              │ compositions:execution-created
                │                                              │ compositions:review-required
┌───────────────▼──────────────────────────────────────────────▼───────────────────┐
│                              Electron Main Process                               │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         Composition IPC Handlers                         │   │
│  │  compositions:list / create / update / delete / toggle / validate / run  │   │
│  └───────────────────────────────▲──────────────────────────────────────────┘   │
│                                  │                                               │
│  ┌───────────────────────────────▼──────────────────────────────────────────┐   │
│  │                          CompositionEngine                               │   │
│  │                                                                          │   │
│  │  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────────┐  │   │
│  │  │  Lexer     │──▶│  Parser    │──▶│  Scope     │──▶│  Execution     │  │   │
│  │  └────────────┘   └────────────┘   │  Checker   │   │  Planner       │  │   │
│  │                                    └────────────┘   └────────────────┘  │   │
│  │                                                                          │   │
│  │  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────────┐  │   │
│  │  │ Scheduler  │   │ EventBus   │   │ Rate       │   │ Action         │  │   │
│  │  └────────────┘   └────────────┘   │ Limiter    │   │ Executor       │  │   │
│  │                                    └────────────┘   └────────────────┘  │   │
│  │                                                                          │   │
│  │  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────────┐  │   │
│  │  │ Audit      │   │ State      │   │ Review     │   │ Template       │  │   │
│  │  │ Logger     │   │ Store      │   │ Queue      │   │ Registry       │  │   │
│  │  └────────────┘   └────────────┘   └────────────┘   └────────────────┘  │   │
│  └───────────────────────────────▲──────────────────────────────────────────┘   │
│                                  │                                               │
│  ┌───────────────────────────────▼──────────────────────────────────────────┐   │
│  │                         DataSourceRegistry                               │   │
│  │                                                                          │   │
│  │  GoalsManifest      LearningManifest     IDEManifest                     │   │
│  │  FinanceManifest    SystemManifest       CanvasManifest                  │   │
│  └───────────────────────────────▲──────────────────────────────────────────┘   │
│                                  │                                               │
│  ┌───────────────────────────────▼──────────────────────────────────────────┐   │
│  │                           Existing Services                              │   │
│  │                                                                          │   │
│  │  Goals Service       Learning Service      Finance Service               │   │
│  │  IDE Service         Tracking Service      Canvas Bridge                 │   │
│  │  Provider Router     Notification Service  Terminal Service              │   │
│  └───────────────────────────────▲──────────────────────────────────────────┘   │
│                                  │                                               │
│  ┌───────────────────────────────▼──────────────────────────────────────────┐   │
│  │                              SQLite DB                                   │   │
│  │                                                                          │   │
│  │  Existing tables: goals, learn_*, projects, finance_*, etc.              │   │
│  │                                                                          │   │
│  │  New tables:                                                             │   │
│  │  agent_compositions                                                      │   │
│  │  composition_triggers                                                    │   │
│  │  composition_executions                                                  │   │
│  │  composition_audit_log                                                   │   │
│  │  composition_state                                                       │   │
│  │  composition_suggestions                                                 │   │
│  │  composition_templates                                                   │   │
│  │  composition_settings                                                    │   │
│  │  composition_event_outbox                                                │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.3 Core Architectural Principles

1. **Composition, not code generation**
   - New capability = new DSL composition.
   - No generated React, SQL, IPC, or arbitrary logic.

2. **Manifest-driven connectivity**
   - Each subsystem exposes a fixed manifest:
     - readable datasets
     - trigger events
     - safe actions
   - The DSL can only reference manifest-declared primitives.

3. **Local evaluation**
   - All rule evaluation runs locally.
   - AI provider is only used for optional composition suggestions.

4. **Audit-first execution**
   - Every evaluation, action, error, approval, toggle, and edit is logged.

5. **Human-controlled expansion**
   - AI may propose compositions.
   - User must save, approve, activate, or reject them.
   - Finance and destructive operations require review.

6. **Additive compatibility**
   - Existing features continue to work unchanged.
   - Existing IPC handlers gain optional event publishing.
   - Compositions can be globally disabled with one kill switch.

---

### 1.4 Major Components

| Component | Responsibility |
|---|---|
| `CompositionEngine` | Orchestrates validation, scheduling, event response, evaluation, actions, audit |
| `DSL Lexer/Parser` | Converts DSL source into tokens and AST |
| `ScopeChecker` | Ensures composition only uses declared reads/writes |
| `DataSourceRegistry` | Stores manifests and resolves dataset reads |
| `EventBus` | Typed pub/sub for cross-subsystem events |
| `Scheduler` | Handles interval, daily-time, startup catch-up, and manual triggers |
| `ActionExecutor` | Executes whitelisted actions through existing services |
| `RateLimiter` | Prevents runaway evaluations and actions |
| `ReviewQueue` | Holds finance/destructive operations for human approval |
| `AuditLogger` | Writes lifecycle and execution logs |
| `TemplateRegistry` | Stores reusable/shareable compositions |
| `Compositions UI` | Dashboard, editor, activity feed, detail drawer, AI suggestion flow |

---

## 2. DSL Specification

The DSL is intentionally narrow. It is closer to a declarative rule language than a general programming language.

### 2.1 DSL Design Goals

- Human-readable
- Machine-parsable
- Strictly bounded
- No escape hatch to arbitrary code
- No dynamic SQL
- No dynamic imports
- no `eval`
- no regex execution
- no filesystem access
- no shell access
- no arbitrary network calls

---

### 2.2 Example Composition

```dsl
COMPOSITION "Sleep by 22:00 judge"
DESCRIPTION "Automatically abandon sleep goal if screen activity occurs after 22:00"
SCOPE READ goals, READ system.foreground, WRITE goals

RULE "auto-fail"
  TRIGGER AT "22:15"

  READ goal FROM goals
    WHERE title CONTAINS "sleep" AND status = "active"
    LIMIT 1

  READ screen FROM system.foreground
    LIMIT 1

  IF goal AND COALESCE(screen.last_active_at, "1970-01-01") >= TODAY_AT("22:00")
  THEN
    goals.abandon_goal(
      goal_id = goal.id,
      note = "Auto-failed: screen activity after 22:00"
    )
  ELSE
    LOG("No screen activity evidence after 22:00")
END
```

---

### 2.3 Lexical Tokens

#### Keywords

```txt
COMPOSITION
DESCRIPTION
SCOPE
SETTINGS
RULE
TRIGGER
ON
EVERY
AT
MANUAL
READ
FROM
WHERE
ORDER
BY
ASC
DESC
LIMIT
AGGREGATE
IF
THEN
ELSE
END
FOREACH
IN
DO
SET_STATE
LOG
AND
OR
NOT
TRUE
FALSE
NULL
IS
CONTAINS
STARTS_WITH
ENDS_WITH
LIKE
```

#### Literals

```txt
NUMBER      123, 45.6
STRING      "text"
DURATION    5s, 10m, 2h, 7d, 1w
```

#### Identifiers

```txt
IDENT       [A-Za-z_][A-Za-z0-9_]*
QUALIFIED   goals
            goals.abandon_goal
            finance.transaction.created
            system.foreground.last_active_at
```

#### Operators

```txt
= != < <= > >=
+ - * / %
( )
, .
```

---

### 2.4 Grammar (BNF)

```bnf
program
  = compositionHeader
    description?
    scopeDecl
    settingsDecl?
    rule+
  ;

compositionHeader
  = "COMPOSITION" STRING
  ;

description
  = "DESCRIPTION" STRING
  ;

scopeDecl
  = "SCOPE" scopeItem ( "," scopeItem )*
  ;

scopeItem
  = ( "READ" | "WRITE" ) qualifiedName
  ;

settingsDecl
  = "SETTINGS" setting ( "," setting )*
  ;

setting
  = IDENT "=" literal
  ;

rule
  = "RULE" STRING
    trigger
    readStmt*
    ifStmt
    "END"
  ;

trigger
  = "TRIGGER"
    (
      eventTrigger
    | intervalTrigger
    | atTrigger
    | manualTrigger
    )
  ;

eventTrigger
  = "ON" qualifiedName ( "IF" expr )?
  ;

intervalTrigger
  = "EVERY" DURATION
  ;

atTrigger
  = "AT" STRING
  ;

manualTrigger
  = "MANUAL"
  ;

readStmt
  = "READ" IDENT "FROM" qualifiedName
    ( "AGGREGATE" aggregate )?
    ( "WHERE" expr )?
    ( "ORDER" "BY" IDENT direction )?
    ( "LIMIT" NUMBER )?
  ;

aggregate
  = "COUNT" "(" ( IDENT | "*" ) ")"
  | "SUM" "(" IDENT ")"
  | "AVG" "(" IDENT ")"
  | "MIN" "(" IDENT ")"
  | "MAX" "(" IDENT ")"
  ;

direction
  = "ASC"
  | "DESC"
  ;

ifStmt
  = "IF" expr "THEN"
      actionStmt+
    ( "ELSE"
      actionStmt*
    )?
  ;

actionStmt
  = actionCall
  | setStateStmt
  | foreachStmt
  | logStmt
  ;

actionCall
  = qualifiedName "(" argList? ")"
  ;

setStateStmt
  = "SET_STATE" "(" STRING "," expr ")"
  ;

foreachStmt
  = "FOREACH" IDENT "IN" expr "DO"
      actionStmt+
    "END"
  ;

logStmt
  = "LOG" "(" expr ")"
  ;

argList
  = arg ( "," arg )*
  ;

arg
  = IDENT "=" expr
  ;

expr
  = orExpr
  ;

orExpr
  = andExpr ( "OR" andExpr )*
  ;

andExpr
  = notExpr ( "AND" notExpr )*
  ;

notExpr
  = "NOT" notExpr
  | comparison
  ;

comparison
  = additive
    (
      compOp additive
    | "IS" "NOT"? "NULL"
    )?
  ;

compOp
  = "="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "CONTAINS"
  | "STARTS_WITH"
  | "ENDS_WITH"
  | "LIKE"
  ;

additive
  = multiplicative ( ( "+" | "-" ) multiplicative )*
  ;

multiplicative
  = unary ( ( "*" | "/" | "%" ) unary )*
  ;

unary
  = "-" unary
  | primary
  ;

primary
  = literal
  | functionCall
  | fieldAccess
  | "(" expr ")"
  ;

functionCall
  = funcName "(" argExprList? ")"
  ;

argExprList
  = expr ( "," expr )*
  ;

funcName
  = "NOW"
  | "TODAY"
  | "TODAY_AT"
  | "DATE"
  | "DATETIME"
  | "DURATION"
  | "DATE_ADD"
  | "DATE_DIFF"
  | "START_OF_DAY"
  | "START_OF_MONTH"
  | "DAYS_AGO"
  | "COALESCE"
  | "UPPER"
  | "LOWER"
  | "LENGTH"
  | "ABS"
  | "ROUND"
  | "STATE"
  | "IIF"
  ;

fieldAccess
  = IDENT ( "." IDENT )*
  ;

literal
  = NUMBER
  | STRING
  | DURATION
  | "TRUE"
  | "FALSE"
  | "NULL"
  ;

qualifiedName
  = IDENT ( "." IDENT )*
  ;
```

---

### 2.5 Semantic Rules

#### 2.5.1 Composition Limits

| Limit | Default |
|---|---:|
| Max rules per composition | 5 |
| Max READ statements per rule | 20 |
| Max actions per execution | 20 |
| Max FOREACH depth | 2 |
| Max total FOREACH iterations | 500 |
| Max source length | 12,000 chars |
| Max AST nodes | 1,200 |
| Max execution time | 2,000 ms |
| Max event filter depth | 20 nodes |

These are configurable in `composition_settings`.

---

#### 2.5.2 READ Semantics

```dsl
READ alias FROM dataset WHERE condition LIMIT n
```

- If `LIMIT 1` is used, `alias` is an object or `NULL`.
- If no `LIMIT 1` is used, `alias` is an array.
- Max array length is capped by engine limits.
- Aggregate reads return a scalar.

Examples:

```dsl
READ goal FROM goals WHERE status = "active" LIMIT 1
READ activeGoals FROM goals WHERE status = "active" LIMIT 50
READ totalExpense FROM finance.transactions AGGREGATE SUM(amount) WHERE type = "expense"
```

---

#### 2.5.3 Truthiness

| Value | Truthiness |
|---|---|
| `NULL` | false |
| `FALSE` | false |
| `0` | true, except in numeric comparisons |
| empty string | true, except in string comparisons |
| empty array | false |
| non-empty array | true |
| object | true |

---

#### 2.5.4 NULL Handling

Use:

```dsl
value IS NULL
value IS NOT NULL
COALESCE(value, fallback)
```

Examples:

```dsl
IF goal IS NOT NULL THEN ...
IF COALESCE(screen.last_active_at, "1970-01-01") < TODAY_AT("22:00") THEN ...
```

---

#### 2.5.5 Time Functions

| Function | Returns |
|---|---|
| `NOW()` | current local datetime string |
| `TODAY()` | current local date string |
| `TODAY_AT("22:00")` | current local datetime at 22:00 |
| `DATE("2026-07-30")` | normalized date string |
| `DATETIME("2026-07-30 22:00:00")` | normalized datetime string |
| `DAYS_AGO(3)` | datetime 3 days ago |
| `START_OF_DAY(date)` | start of day |
| `START_OF_MONTH(date)` | start of month |
| `DATE_ADD(date, 7d)` | date plus duration |
| `DATE_DIFF(a, b)` | difference in seconds |

---

#### 2.5.6 State Functions

Compositions may store small local state values.

```dsl
STATE("last_alert_at")
SET_STATE("last_alert_at", NOW())
```

State is stored in `composition_state`.

Use cases:

- deduplicate notifications
- remember last evaluation day
- count consecutive failures
- prevent repeated goal creation

---

### 2.6 Trigger Types

#### 2.6.1 Event Trigger

```dsl
TRIGGER ON finance.transaction.created IF event.amount > 1000
```

Event triggers fire when a subsystem publishes an event.

---

#### 2.6.2 Interval Trigger

```dsl
TRIGGER EVERY 10m
```

Supported duration units:

```txt
s seconds
m minutes
h hours
d days
w weeks
```

Minimum interval: `30s`.

---

#### 2.6.3 Daily Time Trigger

```dsl
TRIGGER AT "22:15"
```

Runs daily at local time.

Optional startup catch-up:

```dsl
SETTINGS catchup = TRUE, catchupGrace = 2h
```

If DeskFlow was closed at 22:15 but opened at 23:00, the rule may run once if within grace.

---

#### 2.6.4 Manual Trigger

```dsl
TRIGGER MANUAL
```

Runs only when the user clicks **Run Now** or an API call invokes it.

---

### 2.7 Action Model

Actions are namespaced:

```txt
domain.action_name
```

Examples:

```txt
goals.create_goal
goals.abandon_goal
goals.set_progress
learning.create_flashcard
system.notify
finance.create_transaction
canvas.create_card
```

Each action is defined in a manifest with:

- parameter schema
- required scopes
- review requirements
- destructive flag
- rate limits
- side effects

---

### 2.8 Example Compositions

#### 2.8.1 Ambient Goal Evaluation: Sleep Judge

```dsl
COMPOSITION "Sleep by 22:00 judge"
SCOPE READ goals, READ system.foreground, WRITE goals

RULE "auto-fail"
  TRIGGER AT "22:15"

  READ goal FROM goals
    WHERE title CONTAINS "sleep" AND status = "active"
    LIMIT 1

  READ screen FROM system.foreground
    LIMIT 1

  IF goal AND COALESCE(screen.last_active_at, "1970-01-01") >= TODAY_AT("22:00")
  THEN
    goals.abandon_goal(
      goal_id = goal.id,
      note = "Auto-failed: screen activity after 22:00"
    )
  ELSE
    LOG("No fail evidence")
END
```

---

#### 2.8.2 Finance to Goals: Low Runway Goal

```dsl
COMPOSITION "Low runway spending goal"
SCOPE READ finance.summary, READ goals, WRITE goals

RULE "low-runway"
  TRIGGER EVERY 1h

  READ summary FROM finance.summary LIMIT 1

  READ existing FROM goals
    WHERE title = "Reduce spending"
      AND status = "active"
    LIMIT 1

  IF summary.runway_months < 3 AND existing IS NULL
  THEN
    goals.create_goal(
      title = "Reduce spending",
      description = "Runway is below 3 months. Review subscriptions and fixed expenses.",
      category = "finance",
      tier = "one_time"
    )
  ELSE
    LOG("No action required")
END
```

---

#### 2.8.3 Learning to Goals: Mastery Milestone

```dsl
COMPOSITION "TypeScript mastery milestone"
SCOPE READ learning.mastery, READ goals, WRITE goals

RULE "mastery-milestone"
  TRIGGER EVERY 30m

  READ mastery FROM learning.mastery
    WHERE curriculum_id = 1
    LIMIT 1

  READ existing FROM goals
    WHERE title = "Complete TypeScript curriculum"
      AND status = "active"
    LIMIT 1

  IF mastery.mastery_score >= 80 AND existing IS NULL
  THEN
    goals.create_goal(
      title = "Complete TypeScript curriculum",
      description = "Mastery reached 80%. Finish remaining lessons and assessments.",
      category = "learning",
      tier = "milestone"
    )
END
```

---

#### 2.8.4 IDE to Goals: Stale Project Reminder

```dsl
COMPOSITION "Stale project reminder"
SCOPE READ ide.projects, WRITE goals

RULE "stale-projects"
  TRIGGER EVERY 6h

  READ stale FROM ide.projects
    WHERE status = "active"
      AND last_active < DAYS_AGO(3)
    LIMIT 20

  FOREACH project IN stale DO
    goals.create_goal(
      title = "Revive " + project.name,
      description = "No IDE activity for 3 days.",
      category = "ide",
      tier = "one_time"
    )
  END
```

---

#### 2.8.5 Finance Budget Alert

```dsl
COMPOSITION "Budget over alert"
SCOPE READ finance.budget_status, WRITE system

RULE "over-budget"
  TRIGGER EVERY 15m

  READ overBudgets FROM finance.budget_status
    WHERE status = "over"
    LIMIT 10

  FOREACH budget IN overBudgets DO
    system.notify(
      title = "Budget exceeded",
      body = budget.name + " is over budget by " + ABS(budget.remaining)
    )
  END
```

---

## 3. Data Connectivity Mesh

The connectivity mesh solves the current problem where Goals, Learning, IDE Projects, Finance, and Canvas are isolated data islands.

### 3.1 Mesh Model

Each subsystem exposes:

```txt
Readable Datasets
Trigger Events
Safe Actions
```

The CompositionEngine consumes these through manifests.

```txt
Subsystem Service
   │
   ├── publishes events to EventBus
   ├── registers datasets in DataSourceRegistry
   └── registers actions in ActionExecutor
```

---

### 3.2 Manifest Shape

```ts
interface DataSourceManifest {
  domain: string;
  title: string;
  description: string;
  datasets: DatasetManifest[];
  triggers: TriggerManifest[];
  actions: ActionManifest[];
}

interface DatasetManifest {
  name: string;
  description: string;
  fields: DatasetField[];
  filterableFields: string[];
  orderableFields: string[];
  aggregatableFields: string[];
  maxLimit: number;
  defaultLimit: number;
  requiresUnlock?: boolean;
}

interface DatasetField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'date' | 'json';
  description?: string;
  sensitive?: boolean;
}

interface TriggerManifest {
  name: string;
  description: string;
  payloadSchema: Record<string, DatasetField>;
}

interface ActionManifest {
  name: string;
  description: string;
  params: ActionParam[];
  scope: string;
  requiresReview: boolean;
  destructive: boolean;
  financeSensitive?: boolean;
  maxPerExecution?: number;
}

interface ActionParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'date';
  required: boolean;
  default?: unknown;
  max?: number;
  min?: number;
  maxLength?: number;
  enum?: string[];
}
```

---

### 3.3 Goals Manifest

#### Datasets

| Dataset | Key Fields |
|---|---|
| `goals` | `id`, `title`, `description`, `category`, `tier`, `status`, `progress`, `target_date`, `start_date`, `completed_at`, `is_pinned`, `sort_order`, `created_at`, `updated_at` |
| `goals.reviews` | `id`, `goal_id`, `rating`, `note`, `duration_sec`, `category`, `reviewed_at` |
| `goals.suggestions` | `id`, `title`, `description`, `category`, `status`, `source`, `created_at` |
| `goals.progress` | `active`, `completed`, `abandoned`, `total`, `completion_rate` |
| `goals.streak` | `current_streak`, `best_streak`, `last_review_date` |

#### Triggers

```txt
goals.created
goals.updated
goals.deleted
goals.completed
goals.abandoned
goals.review_saved
goals.suggestion_accepted
```

#### Actions

| Action | Review | Destructive |
|---|---:|---:|
| `goals.create_goal` | no | no |
| `goals.update_goal` | no | no |
| `goals.set_progress` | no | no |
| `goals.complete_goal` | no | no |
| `goals.abandon_goal` | optional | yes |
| `goals.pin_goal` | no | no |
| `goals.create_suggestion` | no | no |
| `goals.delete_goal` | yes | yes |

---

### 3.4 Learning Manifest

#### Datasets

| Dataset | Key Fields |
|---|---|
| `learning.curricula` | `id`, `name`, `description`, `skill_level`, `is_active` |
| `learning.chapters` | `id`, `curriculum_id`, `title`, `sort_order` |
| `learning.lessons` | `id`, `chapter_id`, `title`, `status`, `estimated_minutes`, `xp_reward`, `updated_at` |
| `learning.flashcards` | `id`, `lesson_id`, `front`, `back`, `ease_factor`, `interval`, `repetitions`, `next_review` |
| `learning.mastery` | `curriculum_id`, `chapter_id`, `mastery_score` |
| `learning.stats` | `total_xp`, `streak`, `lessons_completed`, `flashcards_due` |

#### Triggers

```txt
learning.lesson_completed
learning.lesson_updated
learning.flashcard_reviewed
learning.mastery_updated
learning.xp_changed
```

#### Actions

| Action | Review | Destructive |
|---|---:|---:|
| `learning.create_flashcard` | no | no |
| `learning.update_lesson_status` | no | no |
| `learning.create_suggestion` | no | no |
| `learning.delete_flashcard` | yes | yes |

---

### 3.5 IDE Projects Manifest

#### Datasets

| Dataset | Key Fields |
|---|---|
| `ide.projects` | `id`, `name`, `path`, `type`, `status`, `last_active`, `created_at`, `updated_at` |
| `ide.sessions` | `id`, `project_id`, `started_at`, `ended_at`, `duration_sec`, `tool`, `status` |
| `ide.line_stats` | `project_id`, `date`, `lines_added`, `lines_deleted`, `files_changed`, `total_lines` |
| `ide.ai_usage` | `project_id`, `tool_name`, `tool_type`, `tokens_in`, `tokens_out`, `cost`, `model`, `duration_sec`, `task_type`, `status`, `created_at` |

#### Triggers

```txt
ide.project_created
ide.project_updated
ide.session_saved
ide.line_stats_updated
ide.ai_usage_saved
```

#### Actions

| Action | Review | Destructive |
|---|---:|---:|
| `ide.update_project_status` | no | no |
| `ide.set_project_metadata` | no | no |
| `ide.create_project_note` | no | no |
| `ide.delete_project` | yes | yes |

---

### 3.6 Finance Manifest

Finance is treated as sensitive.

If finance is locked, finance datasets either:

- return redacted metadata only
- return zero balances
- or become unavailable depending on user setting

Finance writes always require review by default.

#### Datasets

| Dataset | Key Fields |
|---|---|
| `finance.accounts` | `id`, `name`, `type`, `balance`, `archived` |
| `finance.wallets` | `id`, `account_id`, `name`, `type`, `balance`, `initial_balance`, `archived` |
| `finance.transactions` | `id`, `account_id`, `wallet_id`, `category_id`, `type`, `amount`, `fee`, `merchant`, `description`, `date`, `tags`, `on_behalf_of` |
| `finance.categories` | `id`, `name`, `type`, `icon`, `color` |
| `finance.subscriptions` | `id`, `wallet_id`, `name`, `price`, `billing_cycle`, `billing_interval`, `next_renewal_date`, `status` |
| `finance.budgets` | `id`, `name`, `type`, `amount`, `period`, `alert_threshold` |
| `finance.budget_status` | `id`, `name`, `type`, `limit`, `spent`, `remaining`, `percentage`, `status` |
| `finance.fixed_expenses` | `id`, `wallet_id`, `name`, `amount`, `billing_day`, `frequency`, `type`, `next_due_date` |
| `finance.summary` | `total_balance`, `monthly_income`, `monthly_expense`, `net`, `liquid_net_worth`, `runway_months`, `daily_burn_rate` |

#### Triggers

```txt
finance.transaction_created
finance.transaction_updated
finance.transaction_deleted
finance.wallet_updated
finance.subscription_created
finance.subscription_updated
finance.budget_threshold
finance.fixed_expense_paid
```

#### Actions

| Action | Review | Destructive |
|---|---:|---:|
| `finance.create_transaction` | yes | no |
| `finance.update_transaction` | yes | no |
| `finance.delete_transaction` | yes | yes |
| `finance.create_budget` | yes | no |
| `finance.update_budget` | yes | no |
| `finance.create_subscription` | yes | no |
| `finance.cancel_subscription` | yes | yes |

---

### 3.7 System Manifest

System data supports ambient evaluation.

#### Datasets

| Dataset | Key Fields |
|---|---|
| `system.clock` | `now`, `date`, `time`, `weekday` |
| `system.foreground` | `last_active_at`, `last_app_name`, `last_window_title`, `last_url`, `daily_active_sec` |
| `system.screen_time` | `date`, `total_active_sec`, `last_active_at` |
| `system.app_state` | `is_locked`, `finance_unlocked`, `compositions_enabled` |

#### Triggers

```txt
system.clock_tick
system.day_changed
system.foreground_changed
system.browser_changed
system.app_resumed
system.finance_locked
system.finance_unlocked
```

#### Actions

| Action | Review | Destructive |
|---|---:|---:|
| `system.notify` | no | no |
| `system.set_state` | no | no |
| `system.open_external` | yes | no |
| `system.terminal_write` | yes | yes |

---

### 3.8 Canvas Manifest

Canvas data lives primarily in renderer localStorage. The renderer pushes sanitized snapshots to main when composition mode is enabled.

#### Datasets

| Dataset | Key Fields |
|---|---|
| `canvas.cards` | `id`, `title`, `type`, `status`, `updated_at`, `parent_id`, `connection_count` |
| `canvas.summary` | `card_count`, `running_agents`, `error_cards`, `last_updated_at` |

#### Triggers

```txt
canvas.card_created
canvas.card_updated
canvas.card_deleted
canvas.snapshot_updated
```

#### Actions

| Action | Review | Destructive |
|---|---:|---:|
| `canvas.create_card` | no | no |
| `canvas.update_card_status` | no | no |
| `canvas.delete_card` | yes | yes |

Renderer-side action execution is asynchronous and only applies when the renderer is alive. If the renderer is closed, canvas actions are queued or skipped according to composition config.

---

## 4. Database Schema

All new tables use existing SQLite conventions:

- `TEXT` dates
- local time defaults
- integer booleans
- JSON stored as `TEXT`
- idempotent `CREATE TABLE IF NOT EXISTS`

---

### 4.1 Core Tables

```sql
CREATE TABLE IF NOT EXISTS agent_compositions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  source TEXT NOT NULL,
  ast_json TEXT,
  summary TEXT DEFAULT '',
  status TEXT DEFAULT 'draft'
    CHECK(status IN ('draft','pending_review','active','paused','error','archived')),
  scope_json TEXT NOT NULL DEFAULT '[]',
  config_json TEXT NOT NULL DEFAULT '{}',
  origin TEXT DEFAULT 'user'
    CHECK(origin IN ('user','ai','import','template')),
  template_id INTEGER,
  created_by TEXT DEFAULT 'user',
  requires_review INTEGER DEFAULT 0,
  approved_by TEXT,
  approved_at TEXT,
  last_trigger_at TEXT,
  last_run_at TEXT,
  last_execution_id INTEGER,
  last_status TEXT,
  last_result_summary TEXT,
  last_error TEXT,
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  consecutive_error_count INTEGER DEFAULT 0,
  paused_reason TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_agent_compositions_status
  ON agent_compositions(status);

CREATE INDEX IF NOT EXISTS idx_agent_compositions_updated
  ON agent_compositions(updated_at);
```

---

### 4.2 Trigger Subscriptions

```sql
CREATE TABLE IF NOT EXISTS composition_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  composition_id INTEGER NOT NULL
    REFERENCES agent_compositions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK(kind IN ('event','interval','at','manual')),
  topic TEXT,
  schedule TEXT,
  filter_json TEXT,
  enabled INTEGER DEFAULT 1,
  last_triggered_at TEXT,
  next_run_at TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_composition_triggers_composition
  ON composition_triggers(composition_id);

CREATE INDEX IF NOT EXISTS idx_composition_triggers_topic
  ON composition_triggers(topic);

CREATE INDEX IF NOT EXISTS idx_composition_triggers_next_run
  ON composition_triggers(next_run_at);
```

---

### 4.3 Execution Audit Trail

```sql
CREATE TABLE IF NOT EXISTS composition_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  composition_id INTEGER NOT NULL
    REFERENCES agent_compositions(id) ON DELETE CASCADE,
  trigger_kind TEXT NOT NULL
    CHECK(trigger_kind IN ('event','interval','at','manual','startup','retry')),
  trigger_topic TEXT,
  trigger_payload_json TEXT,
  input_snapshot_json TEXT,
  condition_result INTEGER,
  status TEXT NOT NULL
    CHECK(status IN (
      'success',
      'error',
      'skipped',
      'rate_limited',
      'review_required',
      'dry_run',
      'timeout',
      'queued'
    )),
  result_summary TEXT,
  actions_json TEXT DEFAULT '[]',
  pending_actions_json TEXT DEFAULT '[]',
  error TEXT,
  error_code TEXT,
  started_at TEXT DEFAULT (datetime('now','localtime')),
  finished_at TEXT,
  duration_ms INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_composition_executions_composition
  ON composition_executions(composition_id);

CREATE INDEX IF NOT EXISTS idx_composition_executions_status
  ON composition_executions(status);

CREATE INDEX IF NOT EXISTS idx_composition_executions_started
  ON composition_executions(started_at);
```

---

### 4.4 Lifecycle Audit Log

```sql
CREATE TABLE IF NOT EXISTS composition_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  composition_id INTEGER
    REFERENCES agent_compositions(id) ON DELETE SET NULL,
  execution_id INTEGER
    REFERENCES composition_executions(id) ON DELETE SET NULL,
  actor TEXT NOT NULL DEFAULT 'user',
  event_type TEXT NOT NULL,
  details_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_composition_audit_composition
  ON composition_audit_log(composition_id);

CREATE INDEX IF NOT EXISTS idx_composition_audit_created
  ON composition_audit_log(created_at);
```

Audit event types:

```txt
composition.created
composition.updated
composition.deleted
composition.activated
composition.paused
composition.archived
composition.approved
composition.rejected
composition.validation_failed
composition.execution_started
composition.execution_finished
composition.execution_error
composition.action_executed
composition.action_review_required
composition.rate_limited
composition.kill_switch_enabled
composition.kill_switch_disabled
composition.template_saved
composition.imported
composition.exported
```

---

### 4.5 Composition State

```sql
CREATE TABLE IF NOT EXISTS composition_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  composition_id INTEGER NOT NULL
    REFERENCES agent_compositions(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(composition_id, key)
);

CREATE INDEX IF NOT EXISTS idx_composition_state_composition
  ON composition_state(composition_id);
```

---

### 4.6 AI Suggestions

```sql
CREATE TABLE IF NOT EXISTS composition_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  source_dsl TEXT NOT NULL,
  explanation TEXT DEFAULT '',
  risk_level TEXT DEFAULT 'low'
    CHECK(risk_level IN ('low','medium','high')),
  validation_json TEXT,
  status TEXT DEFAULT 'pending'
    CHECK(status IN ('pending','accepted','dismissed','failed')),
  source TEXT DEFAULT 'ai',
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_composition_suggestions_status
  ON composition_suggestions(status);
```

---

### 4.7 Template Registry

```sql
CREATE TABLE IF NOT EXISTS composition_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  source_dsl TEXT NOT NULL,
  scope_json TEXT NOT NULL DEFAULT '[]',
  category TEXT DEFAULT 'general',
  tags_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active'
    CHECK(status IN ('active','archived')),
  created_by TEXT DEFAULT 'user',
  uses_count INTEGER DEFAULT 0,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_composition_templates_status
  ON composition_templates(status);
```

---

### 4.8 Settings

```sql
CREATE TABLE IF NOT EXISTS composition_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

INSERT OR IGNORE INTO composition_settings (key, value_json)
VALUES (
  'global',
  '{
    "enabled": false,
    "killSwitch": false,
    "maxActiveCompositions": 100,
    "maxExecutionsPerMinuteGlobal": 120,
    "maxExecutionsPerMinutePerComposition": 10,
    "maxActionsPerExecution": 20,
    "maxForeachDepth": 2,
    "maxForeachIterations": 500,
    "maxSourceChars": 12000,
    "maxAstNodes": 1200,
    "evaluationTimeoutMs": 2000,
    "eventQueueMax": 1000,
    "consecutiveErrorThreshold": 5,
    "requireReviewForFinance": true,
    "requireReviewForDestructive": true,
    "requireApprovalForAiCompositions": true,
    "redactSensitiveAuditPayloads": true
  }'
);
```

---

### 4.9 Event Outbox

Optional crash-recovery buffer for events published before the engine is ready.

```sql
CREATE TABLE IF NOT EXISTS composition_event_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  topic TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_composition_event_outbox_processed
  ON composition_event_outbox(processed);
```

---

## 5. IPC Channel Definitions

All IPC channels follow existing DeskFlow conventions:

- lowercase colon-separated channel names
- `ipcRenderer.invoke` for requests
- wrapped return objects
- camelCase preload bindings
- event subscriptions via `ipcRenderer.on`

---

### 5.1 Composition CRUD

| Channel | Payload | Returns |
|---|---|---|
| `compositions:list` | `{ status?, query?, limit?, offset? }` | `{ compositions, total }` |
| `compositions:get` | `id: number` | `{ composition }` |
| `compositions:create` | `{ name, description?, source, activate?, origin?, templateId? }` | `{ composition, validation }` |
| `compositions:update` | `{ id, name?, description?, source?, config?, status? }` | `{ composition, validation? }` |
| `compositions:delete` | `id: number` | `{ ok }` |
| `compositions:toggle` | `{ id, active?: boolean }` | `{ composition }` |
| `compositions:archive` | `id: number` | `{ composition }` |

---

### 5.2 Validation and Execution

| Channel | Payload | Returns |
|---|---|---|
| `compositions:validate` | `{ source }` | `{ validation }` |
| `compositions:run` | `{ id, mode?: 'live' | 'dry' }` | `{ execution }` |
| `compositions:retry-execution` | `{ executionId }` | `{ execution }` |
| `compositions:get-executions` | `{ compositionId?, status?, limit?, before? }` | `{ executions }` |
| `compositions:get-execution` | `id: number` | `{ execution }` |

---

### 5.3 Review and Approval

| Channel | Payload | Returns |
|---|---|---|
| `compositions:approve` | `{ id, note? }` | `{ composition }` |
| `compositions:reject` | `{ id, note? }` | `{ composition }` |
| `compositions:approve-execution` | `{ executionId, note? }` | `{ execution }` |
| `compositions:reject-execution` | `{ executionId, note? }` | `{ execution }` |

---

### 5.4 Manifests and Settings

| Channel | Payload | Returns |
|---|---|---|
| `compositions:get-manifests` | none | `{ manifests }` |
| `compositions:get-settings` | none | `{ settings }` |
| `compositions:update-settings` | `{ patch }` | `{ settings }` |
| `compositions:kill-switch` | `{ enabled: boolean }` | `{ settings }` |

---

### 5.5 AI Suggestions

| Channel | Payload | Returns |
|---|---|---|
| `compositions:suggest` | `{ prompt, context? }` | `{ suggestion }` |
| `compositions:get-suggestions` | `{ status? }` | `{ suggestions }` |
| `compositions:accept-suggestion` | `{ id, activate? }` | `{ composition, suggestion }` |
| `compositions:dismiss-suggestion` | `id: number` | `{ suggestion }` |

---

### 5.6 Templates and Import/Export

| Channel | Payload | Returns |
|---|---|---|
| `compositions:get-templates` | `{ category?, query? }` | `{ templates }` |
| `compositions:save-template` | `{ name, description?, source, category?, tags? }` | `{ template, validation }` |
| `compositions:export` | `{ id }` | `{ payload }` |
| `compositions:import` | `{ payload, activate? }` | `{ composition, validation }` |

---

### 5.7 Renderer Data Bridge

Used for renderer-owned data such as canvas cards.

| Channel | Payload | Returns |
|---|---|---|
| `compositions:push-renderer-snapshot` | `{ key, version, data }` | `{ ok }` |

Example:

```ts
window.deskflow.compositionsPushRendererSnapshot({
  key: 'canvas',
  version: 1,
  data: sanitizedCanvasCards,
});
```

---

### 5.8 Main-to-Renderer Events

| Channel | Payload |
|---|---|
| `compositions:changed` | `{ composition?, reason }` |
| `compositions:execution-created` | `{ execution }` |
| `compositions:settings-changed` | `{ settings }` |
| `compositions:review-required` | `{ execution }` |

---

### 5.9 Preload Bindings

```ts
compositionsList: (filter?: any) =>
  ipcRenderer.invoke('compositions:list', filter),

compositionsGet: (id: number) =>
  ipcRenderer.invoke('compositions:get', id),

compositionsCreate: (data: any) =>
  ipcRenderer.invoke('compositions:create', data),

compositionsUpdate: (data: any) =>
  ipcRenderer.invoke('compositions:update', data),

compositionsDelete: (id: number) =>
  ipcRenderer.invoke('compositions:delete', id),

compositionsToggle: (data: { id: number; active?: boolean }) =>
  ipcRenderer.invoke('compositions:toggle', data),

compositionsValidate: (source: string) =>
  ipcRenderer.invoke('compositions:validate', { source }),

compositionsRun: (data: { id: number; mode?: 'live' | 'dry' }) =>
  ipcRenderer.invoke('compositions:run', data),

compositionsRetryExecution: (executionId: number) =>
  ipcRenderer.invoke('compositions:retry-execution', { executionId }),

compositionsGetExecutions: (filter?: any) =>
  ipcRenderer.invoke('compositions:get-executions', filter),

compositionsGetExecution: (id: number) =>
  ipcRenderer.invoke('compositions:get-execution', id),

compositionsApprove: (data: { id: number; note?: string }) =>
  ipcRenderer.invoke('compositions:approve', data),

compositionsReject: (data: { id: number; note?: string }) =>
  ipcRenderer.invoke('compositions:reject', data),

compositionsApproveExecution: (data: { executionId: number; note?: string }) =>
  ipcRenderer.invoke('compositions:approve-execution', data),

compositionsRejectExecution: (data: { executionId: number; note?: string }) =>
  ipcRenderer.invoke('compositions:reject-execution', data),

compositionsGetManifests: () =>
  ipcRenderer.invoke('compositions:get-manifests'),

compositionsGetSettings: () =>
  ipcRenderer.invoke('compositions:get-settings'),

compositionsUpdateSettings: (patch: any) =>
  ipcRenderer.invoke('compositions:update-settings', { patch }),

compositionsKillSwitch: (enabled: boolean) =>
  ipcRenderer.invoke('compositions:kill-switch', { enabled }),

compositionsSuggest: (prompt: string, context?: any) =>
  ipcRenderer.invoke('compositions:suggest', { prompt, context }),

compositionsGetSuggestions: (filter?: any) =>
  ipcRenderer.invoke('compositions:get-suggestions', filter),

compositionsAcceptSuggestion: (data: { id: number; activate?: boolean }) =>
  ipcRenderer.invoke('compositions:accept-suggestion', data),

compositionsDismissSuggestion: (id: number) =>
  ipcRenderer.invoke('compositions:dismiss-suggestion', id),

compositionsGetTemplates: (filter?: any) =>
  ipcRenderer.invoke('compositions:get-templates', filter),

compositionsSaveTemplate: (data: any) =>
  ipcRenderer.invoke('compositions:save-template', data),

compositionsExport: (id: number) =>
  ipcRenderer.invoke('compositions:export', { id }),

compositionsImport: (data: { payload: any; activate?: boolean }) =>
  ipcRenderer.invoke('compositions:import', data),

compositionsPushRendererSnapshot: (data: { key: string; version: number; data: any }) =>
  ipcRenderer.invoke('compositions:push-renderer-snapshot', data),

onCompositionsChanged: (callback: (data: any) => void) =>
  ipcRenderer.on('compositions:changed', (_event, data) => callback(data)),

onCompositionExecutionCreated: (callback: (data: any) => void) =>
  ipcRenderer.on('compositions:execution-created', (_event, data) => callback(data)),

onCompositionsSettingsChanged: (callback: (data: any) => void) =>
  ipcRenderer.on('compositions:settings-changed', (_event, data) => callback(data)),

onCompositionReviewRequired: (callback: (data: any) => void) =>
  ipcRenderer.on('compositions:review-required', (_event, data) => callback(data)),
```

---

## 6. Service Design

### 6.1 CompositionEngine

```ts
class CompositionEngine {
  constructor(
    db: BetterSqlite3.Database,
    eventBus: EventBus,
    registry: DataSourceRegistry,
    actionExecutor: ActionExecutor,
    audit: AuditLogger,
    settingsStore: CompositionSettingsStore,
    providerRouter?: ProviderRouter
  );

  init(): Promise<void>;
  shutdown(): Promise<void>;

  registerManifest(manifest: DataSourceManifest): void;

  validateSource(source: string): ValidationResult;
  compileSource(source: string): CompiledComposition;

  createComposition(input: CreateCompositionInput): Promise<CompositionRecord>;
  updateComposition(input: UpdateCompositionInput): Promise<CompositionRecord>;
  deleteComposition(id: number): Promise<void>;
  toggleComposition(id: number, active: boolean): Promise<CompositionRecord>;

  runNow(id: number, mode: 'live' | 'dry'): Promise<ExecutionRecord>;
  retryExecution(executionId: number): Promise<ExecutionRecord>;

  approveComposition(id: number, note?: string): Promise<CompositionRecord>;
  rejectComposition(id: number, note?: string): Promise<CompositionRecord>;

  approveExecution(executionId: number, note?: string): Promise<ExecutionRecord>;
  rejectExecution(executionId: number, note?: string): Promise<ExecutionRecord>;

  handleEvent(event: DeskFlowEvent): Promise<void>;
  handleSchedulerTick(now: Date): Promise<void>;

  setKillSwitch(enabled: boolean): Promise<CompositionSettings>;
}
```

---

### 6.2 Validation Result

```ts
interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  scope: string[];
  triggers: TriggerSummary[];
  actions: ActionSummary[];
  datasets: string[];
  requiresReview: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
  ast?: ProgramNode;
}

interface ValidationIssue {
  line: number;
  column: number;
  message: string;
  code: string;
}
```

---

### 6.3 EventBus

```ts
interface DeskFlowEvent {
  id: string;
  topic: string;
  timestamp: string;
  actor: 'user' | 'system' | 'composition' | 'ai';
  source: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

type EventHandler = (event: DeskFlowEvent) => Promise<void>;

class EventBus {
  publish(event: Omit<DeskFlowEvent, 'id' | 'timestamp'>): void;

  subscribe(
    topicFilter: string | string[],
    handler: EventHandler
  ): () => void;

  start(): void;
  stop(): void;
}
```

#### EventBus Behavior

- asynchronous dispatch queue
- max queue size from settings
- dedupe by `event.id`
- TTL dedupe window: 5 minutes
- handler errors isolated
- optional persistence to `composition_event_outbox`
- no blocking of source subsystem

Example publish:

```ts
eventBus.publish({
  topic: 'finance.transaction_created',
  actor: 'user',
  source: 'finance',
  payload: {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    wallet_id: transaction.wallet_id,
    category_id: transaction.category_id,
    date: transaction.date,
  },
});
```

---

### 6.4 DataSourceRegistry

```ts
class DataSourceRegistry {
  registerManifest(manifest: DataSourceManifest): void;
  getManifests(): DataSourceManifest[];
  getDataset(datasetName: string): DatasetManifest | undefined;
  getAction(actionName: string): ActionManifest | undefined;
  getTrigger(triggerName: string): TriggerManifest | undefined;

  resolveRead(
    op: ReadOperation,
    ctx: EvaluationContext
  ): Promise<unknown>;
}
```

---

### 6.5 Data Adapter Interface

```ts
interface DataAdapter {
  domain: string;

  read(
    dataset: string,
    query: SafeQuery,
    ctx: EvaluationContext
  ): Promise<unknown>;
}

interface SafeQuery {
  dataset: string;
  predicates: QueryPredicate[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' };
  limit?: number;
  aggregate?: {
    fn: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
    field?: string;
  };
}

interface QueryPredicate {
  field: string;
  op: '='
    | '!='
    | '<'
    | '<='
    | '>'
    | '>='
    | 'CONTAINS'
    | 'STARTS_WITH'
    | 'ENDS_WITH'
    | 'LIKE'
    | 'IS NULL'
    | 'IS NOT NULL';
  value?: unknown;
}
```

Adapters must:

- use prepared statements
- whitelist fields
- enforce limits
- redact sensitive fields when locked
- never accept raw SQL from DSL

---

### 6.6 Scheduler

```ts
class CompositionScheduler {
  constructor(engine: CompositionEngine, db: BetterSqlite3.Database);

  start(): void;
  stop(): void;
  tick(now?: Date): Promise<void>;
  recomputeTriggerTimes(compositionId: number): void;
}
```

Scheduler behavior:

- tick interval: 15 seconds
- evaluates `interval` and `at` triggers
- uses `composition_triggers.next_run_at`
- avoids duplicate runs using `last_triggered_at`
- supports startup catch-up with grace window
- skips when global kill switch is enabled
- skips paused/error/archived compositions

---

### 6.7 RateLimiter

```ts
class RateLimiter {
  constructor(settingsStore: CompositionSettingsStore);

  canEvaluateComposition(compositionId: number): boolean;
  canEvaluateGlobal(): boolean;
  canExecuteAction(compositionId: number, actionName: string): boolean;

  recordEvaluation(compositionId: number): void;
  recordAction(compositionId: number, actionName: string): void;
}
```

Default limits:

| Scope | Limit |
|---|---:|
| Global evaluations | 120/min |
| Per-composition evaluations | 10/min |
| Actions per execution | 20 |
| Notifications per composition per hour | 10 |
| Finance write actions per composition per hour | 5 |
| FOREACH total iterations | 500 |

---

### 6.8 ActionExecutor

```ts
class ActionExecutor {
  constructor(
    db: BetterSqlite3.Database,
    registry: DataSourceRegistry,
    audit: AuditLogger,
    eventBus: EventBus,
    settingsStore: CompositionSettingsStore
  );

  execute(
    action: ActionInvocation,
    ctx: EvaluationContext
  ): Promise<ActionResult>;
}

interface ActionInvocation {
  name: string;
  args: Record<string, unknown>;
}

interface ActionResult {
  ok: boolean;
  action: string;
  result?: unknown;
  error?: string;
  reviewRequired?: boolean;
}
```

Action execution pipeline:

1. Resolve action manifest.
2. Validate parameters against schema.
3. Check scope.
4. Check rate limit.
5. Check review policy.
6. Execute through existing service.
7. Emit subsystem event.
8. Write audit log.
9. Return result.

---

### 6.9 AuditLogger

```ts
class AuditLogger {
  logLifecycle(
    eventType: string,
    compositionId?: number,
    details?: Record<string, unknown>
  ): void;

  logExecution(
    execution: ExecutionRecord
  ): void;

  logAction(
    compositionId: number,
    executionId: number,
    action: ActionInvocation,
    result: ActionResult
  ): void;
}
```

---

### 6.10 AI Suggestion Generator

```ts
class CompositionSuggestionService {
  constructor(
    registry: DataSourceRegistry,
    engine: CompositionEngine,
    providerRouter: ProviderRouter
  );

  suggest(prompt: string, context?: unknown): Promise<CompositionSuggestion>;
}
```

Provider prompt includes:

- DSL grammar
- manifest summary
- composition limits
- safety rules
- output JSON schema

Provider must return:

```json
{
  "title": "Sleep judge",
  "description": "Auto-fail sleep goal after screen activity",
  "source": "COMPOSITION ...",
  "explanation": "Uses system.foreground and goals.",
  "riskLevel": "low"
}
```

The provider never receives:

- finance balances
- transaction details
- lesson content
- file contents
- terminal output
- user data snapshots

unless explicitly included by the user in the prompt.

---

## 7. Safety and Security

### 7.1 No Arbitrary Execution

The DSL intentionally lacks:

- imports
- eval
- dynamic require
- filesystem access
- shell access
- raw SQL
- regex execution
- arbitrary HTTP calls
- user-defined functions
- recursion
- unrestricted loops

The only side effects possible are manifest-defined actions.

---

### 7.2 Scope Enforcement

Every composition declares scope:

```dsl
SCOPE READ goals, READ finance.transactions, WRITE system
```

Scope checker enforces:

- every READ dataset is allowed
- every action is allowed
- event payload access is allowed
- finance reads require finance scope
- finance writes require finance write scope
- destructive actions require explicit scope

A composition cannot silently escalate scope.

---

### 7.3 Review Queue

Review is required when:

- composition writes finance data
- composition uses destructive actions
- AI-generated composition is being activated
- user setting forces review for all writes

Review states:

```txt
draft
pending_review
active
paused
error
archived
```

A `pending_review` composition cannot execute live actions.

Execution-level review:

```txt
status = review_required
pending_actions_json = [...]
```

User may approve or reject pending execution.

---

### 7.4 Kill Switch

Global kill switch is stored in:

```sql
composition_settings.key = 'global'
```

When kill switch is enabled:

```json
{
  "enabled": false,
  "killSwitch": true
}
```

Engine behavior:

- scheduler stops
- event handlers skip execution
- manual run is blocked
- pending executions are frozen
- UI shows global disabled banner
- audit log records kill switch event

The kill switch is available in:

- Compositions page header
- Settings page
- sidebar quick toggle (optional)

---

### 7.5 Rate Limiting and Circuit Breaking

Rate limiter prevents runaway compositions.

Circuit breaker:

```txt
If consecutive_error_count >= consecutiveErrorThreshold:
  set composition.status = error
  pause triggers
  log audit event
  notify user
```

Default threshold: 5 consecutive errors.

---

### 7.6 Audit Trail

Every execution stores:

- trigger
- trigger payload
- input snapshot
- condition result
- actions attempted
- actions executed
- errors
- duration

Every lifecycle change stores:

- actor
- event type
- details
- timestamp

Audit data is local.

Sensitive finance payloads are redacted when:

```json
{
  "redactSensitiveAuditPayloads": true
}
```

---

### 7.7 Finance Encryption Compatibility

Finance data uses optional AES-256 encryption.

Composition finance adapter must:

- use existing finance unlock state
- decrypt only inside main process
- never send decrypted finance values to AI provider
- return locked/unavailable state when finance is locked
- queue finance actions if unlock is required and policy allows

Example locked behavior:

```json
{
  "finance_unlocked": false,
  "datasets_available": false
}
```

---

### 7.8 Offline Requirement

All evaluation runs locally.

Network is used only for:

- optional AI composition suggestions
- optional crypto price fetches already present in finance subsystem

If provider is unavailable:

- compositions continue to run
- AI suggestion button shows offline state
- no composition execution depends on cloud

---

### 7.9 Threat Model Summary

| Threat | Mitigation |
|---|---|
| AI generates malicious code | DSL only, no code execution |
| DSL escapes to SQL | Adapter whitelist + parameterized queries |
| Runaway loop | FOREACH limits + timeout + rate limiter |
| Finance data leak | Local-only, redaction, provider isolation |
| Unauthorized destructive action | Review queue + scope check + audit |
| Event storm | Dedup, queue cap, rate limiter |
| Composition spam | Max active compositions + AI suggestion limits |
| Main-thread blocking | Async scheduler, optional validator worker, limits |
| Crash during execution | Execution status tracking, startup recovery |
| User mistake | Pause, archive, kill switch, dry run |

---

## 8. UI Component Tree

```txt
CompositionsPage
├── CompositionsHeader
│   ├── PageTitle
│   ├── GlobalKillSwitch
│   ├── AISuggestButton
│   └── NewCompositionButton
│
├── CompositionStatsStrip
│   ├── StatActive
│   ├── StatPaused
│   ├── StatErrors
│   └── StatExecutionsToday
│
├── CompositionToolbar
│   ├── SearchInput
│   ├── StatusFilter
│   ├── ReviewFilter
│   └── SortSelect
│
├── CompositionDashboard
│   ├── CompositionCardGrid
│   │   └── CompositionCard
│   │       ├── StatusBadge
│   │       ├── ScopeChips
│   │       ├── LastRunSummary
│   │       ├── ToggleSwitch
│   │       ├── RunButton
│   │       ├── EditButton
│   │       └── ErrorBadge
│   │
│   ├── EmptyState
│   ├── LoadingSkeletonGrid
│   └── ErrorState
│
├── CompositionEditorModal
│   ├── EditorTabs
│   │   ├── GuidedBuilderTab
│   │   └── DslEditorTab
│   ├── ValidationPanel
│   ├── ScopePanel
│   ├── TriggerPanel
│   ├── ConditionPanel
│   ├── ActionPanel
│   ├── RiskPanel
│   └── EditorFooter
│       ├── ValidateButton
│       ├── SaveDraftButton
│       └── ActivateButton
│
├── CompositionDetailDrawer
│   ├── CompositionSummary
│   ├── DslSourceBlock
│   ├── ExecutionHistory
│   ├── ActionLog
│   ├── AuditTrail
│   └── DetailActions
│       ├── Edit
│       ├── Run
│       ├── Pause
│       ├── Approve
│       └── Delete
│
├── ActivityFeedPanel
│   ├── ActivityFilter
│   └── ActivityRow
│       ├── ActivityIcon
│       ├── CompositionName
│       ├── ResultSummary
│       └── Timestamp
│
└── AISuggestionModal
    ├── SuggestionExplanation
    ├── DslPreview
    ├── RiskBadge
    ├── ValidationState
    ├── AcceptButton
    ├── EditButton
    └── RejectButton
```

---

## 9. State Management

### 9.1 React Context

```ts
interface CompositionsContextValue {
  compositions: CompositionRecord[];
  loading: boolean;
  error: string | null;
  settings: CompositionSettings | null;
  manifests: DataSourceManifest[];
  selectedCompositionId: number | null;
  editorOpen: boolean;
  detailOpen: boolean;
  activityOpen: boolean;

  refresh(): Promise<void>;
  createComposition(input: CreateCompositionInput): Promise<void>;
  updateComposition(input: UpdateCompositionInput): Promise<void>;
  deleteComposition(id: number): Promise<void>;
  toggleComposition(id: number, active: boolean): Promise<void>;
  runComposition(id: number, mode?: 'live' | 'dry'): Promise<void>;
  validate(source: string): Promise<ValidationResult>;
  setKillSwitch(enabled: boolean): Promise<void>;
}
```

---

### 9.2 Hooks

```ts
useCompositions();
useComposition(id: number);
useCompositionExecutions(compositionId?: number);
useCompositionSettings();
useCompositionManifests();
useCompositionSuggestions();
```

---

### 9.3 Local UI Preferences

Stored in `localStorage` with try/catch:

```txt
compositions:view_mode
compositions:editor_tab
compositions:status_filter
compositions:activity_filter
compositions:detail_width
```

Example:

```ts
try {
  localStorage.setItem('compositions:editor_tab', tab);
} catch (err) {
  console.error('Failed to save compositions UI pref', err);
}
```

---

## 10. High-Fidelity UI Specification

All new components must use the established DeskFlow glass pattern.

### 10.1 Glass Card Base

```tsx
className={`
  relative overflow-hidden rounded-xl p-5
  bg-[rgba(24,24,27,0.80)] backdrop-blur-xl
  border border-[rgba(63,63,70,0.50)]
  before:absolute before:inset-x-0 before:top-0 before:h-px
  before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)]
`}
```

---

### 10.2 Design Tokens

| Token | Value |
|---|---|
| Card background | `rgba(24,24,27,0.80)` |
| Card border | `rgba(63,63,70,0.50)` |
| Primary text | `#d4d4d8` |
| Secondary text | `#a1a1aa` |
| Muted text | `#71717a` |
| Emerald accent | `#10b981` |
| Amber accent | `#f59e0b` |
| Red accent | `#ef4444` |
| Purple accent | `#8b5cf6` |
| Blue accent | `#3b82f6` |
| Body font | Geist |
| Mono font | JetBrains Mono |
| Radius | `rounded-xl` |
| Card padding | `p-5` |
| Grid gap | `gap-4` |

---

### 10.3 Page Layout

```tsx
<div className="h-full overflow-y-auto p-6 space-y-6">
  <CompositionsHeader />
  <CompositionStatsStrip />
  <CompositionToolbar />
  <CompositionDashboard />
  <ActivityFeedPanel />
</div>
```

---

### 10.4 Header

Layout:

```txt
[Title + subtitle]                    [Kill switch] [AI Suggest] [New Composition]
```

Classes:

```tsx
<div className="flex items-start justify-between gap-4">
  <div className="space-y-1">
    <h1 className="text-2xl font-semibold text-[#d4d4d8]">
      Compositions
    </h1>
    <p className="text-sm text-[#a1a1aa]">
      Connect goals, finance, learning, IDE, and system data with safe automated rules.
    </p>
  </div>

  <div className="flex items-center gap-3">
    <GlobalKillSwitch />
    <AISuggestButton />
    <NewCompositionButton />
  </div>
</div>
```

Button styles:

```tsx
<Button className="bg-[#10b981] text-black hover:bg-[#0ea271]">
  <Plus className="h-4 w-4" />
  New Composition
</Button>
```

AI button:

```tsx
<Button variant="outline" className="border-[rgba(63,63,70,0.50)] text-[#d4d4d8]">
  <Sparkles className="h-4 w-4 text-[#8b5cf6]" />
  Ask AI
</Button>
```

---

### 10.5 Global Kill Switch

Visual:

```txt
[ Shield icon ] System automation   [Switch]
```

Classes:

```tsx
<div className={`
  flex items-center gap-3 rounded-xl px-4 h-10
  bg-[rgba(24,24,27,0.80)] backdrop-blur-xl
  border border-[rgba(63,63,70,0.50)]
`}>
  <ShieldAlert className="h-4 w-4 text-[#f59e0b]" />
  <span className="text-sm text-[#d4d4d8]">
    Automation
  </span>
  <Switch checked={enabled} onCheckedChange={onChange} />
</div>
```

When disabled, show banner:

```tsx
<div className={`
  rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10
  px-4 py-3 text-sm text-[#ef4444]
`}>
  Global kill switch is enabled. All compositions are paused.
</div>
```

---

### 10.6 Stats Strip

Layout:

```txt
[Active] [Paused] [Errors] [Executions Today]
```

Classes:

```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard label="Active" value={activeCount} accent="#10b981" icon={Activity} />
  <StatCard label="Paused" value={pausedCount} accent="#a1a1aa" icon={Pause} />
  <StatCard label="Errors" value={errorCount} accent="#ef4444" icon={AlertTriangle} />
  <StatCard label="Runs Today" value={runsToday} accent="#3b82f6" icon={Clock} />
</div>
```

Stat value:

```tsx
<div className="text-2xl font-semibold text-[#d4d4d8]">
  {value}
</div>
```

Stat label:

```tsx
<div className="text-xs uppercase tracking-wide text-[#71717a]">
  {label}
</div>
```

---

### 10.7 Composition Card

Card grid:

```tsx
<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
  {compositions.map((composition) => (
    <CompositionCard key={composition.id} composition={composition} />
  ))}
</div>
```

Card structure:

```txt
┌──────────────────────────────────────────────┐
│ [Status badge]                    [Toggle]   │
│ Composition title                            │
│ Short description                            │
│                                              │
│ [READ goals] [READ system] [WRITE goals]     │
│                                              │
│ Last run: 2 minutes ago                      │
│ Result: Auto-failed sleep goal               │
│                                              │
│ [Run] [Edit] [Details] [Delete]              │
└──────────────────────────────────────────────┘
```

Status badge colors:

```tsx
active:
  className="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30"

paused:
  className="bg-[#71717a]/10 text-[#a1a1aa] border border-[#71717a]/30"

error:
  className="bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30"

pending_review:
  className="bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30"

draft:
  className="bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30"
```

Scope chips:

```tsx
<span className={`
  text-[11px] px-2 py-1 rounded-md
  border border-[rgba(63,63,70,0.50)]
  bg-[rgba(39,39,42,0.6)]
  text-[#a1a1aa]
`}>
  READ goals
</span>
```

Last run:

```tsx
<div className="text-xs text-[#71717a]">
  Last run: {formatRelativeTime(composition.last_run_at)}
</div>
```

Result summary:

```tsx
<div className="text-sm text-[#d4d4d8] line-clamp-2">
  {composition.last_result_summary || 'No evaluation yet'}
</div>
```

Error state:

```tsx
<div className={`
  mt-3 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10
  px-3 py-2 text-xs text-[#ef4444]
`}>
  {composition.last_error}
</div>
```

---

### 10.8 Empty State

Shown when no compositions exist.

Layout:

```txt
[Sparkles icon]
No compositions yet
Connect your existing DeskFlow data into automated rules.
Ask the AI to propose one, or build your own.

[Ask AI] [Create Composition]
```

Classes:

```tsx
<div className={`
  flex flex-col items-center justify-center gap-4
  rounded-xl p-12 text-center
  bg-[rgba(24,24,27,0.80)] backdrop-blur-xl
  border border-dashed border-[rgba(63,63,70,0.50)]
`}>
  <div className="rounded-full border border-[rgba(63,63,70,0.50)] bg-[rgba(39,39,42,0.6)] p-4">
    <Sparkles className="h-6 w-6 text-[#8b5cf6]" />
  </div>

  <div className="space-y-1">
    <h3 className="text-lg font-medium text-[#d4d4d8]">
      No compositions yet
    </h3>
    <p className="max-w-md text-sm text-[#a1a1aa]">
      Compositions let DeskFlow safely connect goals, finance, learning,
      IDE activity, and system data.
    </p>
  </div>

  <div className="flex items-center gap-3">
    <Button variant="outline">
      <Sparkles className="h-4 w-4 text-[#8b5cf6]" />
      Ask AI
    </Button>
    <Button className="bg-[#10b981] text-black hover:bg-[#0ea271]">
      <Plus className="h-4 w-4" />
      Create Composition
    </Button>
  </div>
</div>
```

---

### 10.9 Loading State

Use shadcn `Skeleton`.

```tsx
<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
  {Array.from({ length: 4 }).map((_, i) => (
    <div key={i} className="glass-card space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-12" />
      </div>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  ))}
</div>
```

---

### 10.10 Composition Editor Modal

Use shadcn `Dialog`.

Size:

```tsx
<Dialog className="max-w-5xl">
```

Header:

```txt
Create Composition                         [Guided] [DSL]
```

Body layout:

```txt
┌───────────────────────────────┬──────────────────────────────┐
│ Left builder                  │ Right preview / validation   │
│                               │                              │
│ Name                          │ DSL source                   │
│ Description                   │                              │
│ Trigger                       │ Validation errors            │
│ Data reads                    │                              │
│ Condition                     │ Warnings                     │
│ Actions                       │                              │
│ Scope                         │ Risk level                   │
└───────────────────────────────┴──────────────────────────────┘
```

Tabs:

```tsx
<Tabs defaultValue="guided">
  <TabsList>
    <TabsTrigger value="guided">Guided Builder</TabsTrigger>
    <TabsTrigger value="dsl">DSL Editor</TabsTrigger>
  </TabsList>
</Tabs>
```

DSL editor:

```tsx
<textarea
  spellCheck={false}
  className={`
    w-full min-h-[420px] resize-y rounded-xl p-4
    bg-[rgba(9,9,11,0.6)]
    border border-[rgba(63,63,70,0.50)]
    font-mono text-sm text-[#d4d4d8]
    focus:outline-none focus:ring-1 focus:ring-[#10b981]/50
  `}
/>
```

Validation error item:

```tsx
<div className={`
  rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10
  px-3 py-2 text-xs text-[#ef4444]
`}>
  Line {error.line}: {error.message}
</div>
```

Warning item:

```tsx
<div className={`
  rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10
  px-3 py-2 text-xs text-[#f59e0b]
`}>
  Line {warning.line}: {warning.message}
</div>
```

Footer:

```tsx
<div className="flex items-center justify-between gap-3 border-t border-[rgba(63,63,70,0.35)] pt-4">
  <div className="text-xs text-[#71717a]">
    {validation.requiresReview
      ? 'This composition requires approval before activation.'
      : 'No approval required.'}
  </div>

  <div className="flex items-center gap-3">
    <Button variant="outline" onClick={validate}>
      Validate
    </Button>
    <Button variant="secondary" onClick={saveDraft}>
      Save Draft
    </Button>
    <Button className="bg-[#10b981] text-black hover:bg-[#0ea271]" onClick={activate}>
      Activate
    </Button>
  </div>
</div>
```

---

### 10.11 Guided Rule Builder

Inner panel style:

```tsx
<div className={`
  rounded-xl border border-[rgba(63,63,70,0.35)]
  bg-[rgba(39,39,42,0.45)] p-4 space-y-3
`}>
```

Trigger builder fields:

```txt
Trigger Type: [Event] [Interval] [Daily Time] [Manual]
Source:       [finance.transaction.created]
Filter:       amount > 1000
```

Condition builder:

```txt
Dataset: [goals]
Field:   [status]
Op:      [=]
Value:   [active]
```

Action builder:

```txt
Action: [goals.abandon_goal]
goal_id: [goal.id]
note:    [Auto-failed by DeskFlow]
```

The guided builder writes DSL internally. The DSL tab always shows the canonical generated source.

---

### 10.12 Composition Detail Drawer

Right-side drawer:

```tsx
<div className="fixed inset-0 z-50 flex justify-end">
  <div className="absolute inset-0 bg-black/50" onClick={onClose} />
  <div className={`
    relative h-full w-[520px] max-w-full overflow-y-auto
    bg-[rgba(24,24,27,0.92)] backdrop-blur-xl
    border-l border-[rgba(63,63,70,0.50)]
    p-6 space-y-6
  `}>
    <DetailHeader />
    <DslSourceBlock />
    <ExecutionHistory />
    <ActionLog />
    <AuditTrail />
  </div>
</div>
```

DSL source block:

```tsx
<pre className={`
  rounded-xl border border-[rgba(63,63,70,0.50)]
  bg-[rgba(9,9,11,0.6)] p-4
  font-mono text-xs text-[#d4d4d8]
  overflow-x-auto
`}>
  {composition.source}
</pre>
```

Execution row:

```tsx
<div className={`
  rounded-xl border border-[rgba(63,63,70,0.35)]
  bg-[rgba(39,39,42,0.45)] p-4
`}>
  <div className="flex items-center justify-between">
    <StatusBadge status={execution.status} />
    <span className="text-xs text-[#71717a]">
      {formatTime(execution.started_at)}
    </span>
  </div>

  <p className="mt-2 text-sm text-[#d4d4d8]">
    {execution.result_summary}
  </p>
</div>
```

---

### 10.13 Activity Feed

Feed row:

```txt
[icon] Sleep judge evaluated
       Auto-failed sleep goal
       2 minutes ago
```

Classes:

```tsx
<div className={`
  flex items-start gap-3 border-b border-[rgba(63,63,70,0.35)] py-3
`}>
  <ActivityIcon status={row.status} />
  <div className="space-y-1">
    <div className="text-sm text-[#d4d4d8]">
      {row.title}
    </div>
    <div className="text-xs text-[#a1a1aa]">
      {row.summary}
    </div>
    <div className="text-xs text-[#71717a]">
      {formatRelativeTime(row.createdAt)}
    </div>
  </div>
</div>
```

Icon colors:

```txt
success: #10b981
error:   #ef4444
skipped: #71717a
review:  #f59e0b
info:    #3b82f6
```

---

### 10.14 AI Suggestion Modal

Layout:

```txt
┌──────────────────────────────────────────────┐
│ AI Suggested Composition            [Risk]   │
│                                              │
│ Title                                        │
│ Explanation                                  │
│                                              │
│ DSL preview                                  │
│                                              │
│ Validation state                             │
│                                              │
│ [Reject] [Edit] [Accept]                     │
└──────────────────────────────────────────────┘
```

Risk badge:

```tsx
low:
  text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10

medium:
  text-[#f59e0b] border-[#f59e0b]/30 bg-[#f59e0b]/10

high:
  text-[#ef4444] border-[#ef4444]/30 bg-[#ef4444]/10
```

Accept behavior:

- If AI approval setting is enabled, accepted composition starts as `pending_review`.
- If finance/destructive scope is present, it must be approved before activation.
- If safe and approval not required, it may be saved as draft or activated based on user choice.

---

## 11. Interaction Flows

### 11.1 Create Composition

```txt
User                  Renderer              Main IPC            CompositionEngine       SQLite
 │                      │                      │                      │                  │
 │ click New            │                      │                      │                  │
 │─────────────────────▶│                      │                      │                  │
 │                      │ open editor          │                      │                  │
 │                      │                      │                      │                  │
 │ type DSL / guided    │                      │                      │                  │
 │─────────────────────▶│                      │                      │                  │
 │                      │ compositions:validate│                      │                  │
 │                      │─────────────────────▶│                      │                  │
 │                      │                      │ validateSource()     │                  │
 │                      │                      │─────────────────────▶│                  │
 │                      │                      │                      │ lex/parse/scope  │
 │                      │                      │                      │─────────────────▶│
 │                      │                      │                      │  audit log       │
 │                      │                      │                      │                  │
 │                      │ validation result    │                      │                  │
 │                      │◀─────────────────────│                      │                  │
 │                      │                      │                      │                  │
 │ click Activate       │                      │                      │                  │
 │─────────────────────▶│                      │                      │                  │
 │                      │ compositions:create  │                      │                  │
 │                      │─────────────────────▶│                      │                  │
 │                      │                      │ createComposition()  │                  │
 │                      │                      │─────────────────────▶│                  │
 │                      │                      │                      │ insert tables    │
 │                      │                      │                      │─────────────────▶│
 │                      │                      │                      │                  │
 │                      │ compositions:changed │                      │                  │
 │                      │◀─────────────────────│                      │                  │
 │                      │                      │                      │                  │
 │ see new card         │                      │                      │                  │
 │◀─────────────────────│                      │                      │                  │
```

---

### 11.2 Event-Triggered Execution

```txt
Finance Service        EventBus          CompositionEngine       RateLimiter       DataAdapter       ActionExecutor
 │                      │                      │                      │                  │                  │
 │ transaction created  │                      │                      │                  │                  │
 │─────────────────────▶│                      │                      │                  │                  │
 │                      │ publish event        │                      │                  │                  │
 │                      │─────────────────────▶│                      │                  │                  │
 │                      │                      │ check kill switch    │                  │                  │
 │                      │                      │ check status         │                  │                  │
 │                      │                      │ check trigger filter │                  │                  │
 │                      │                      │─────────────────────▶│                  │                  │
 │                      │                      │ canEvaluate?         │                  │                  │
 │                      │                      │◀─────────────────────│                  │                  │
 │                      │                      │                      │                  │                  │
 │                      │                      │ create execution     │                  │                  │
 │                      │                      │ read datasets        │                  │                  │
 │                      │                      │─────────────────────────────────────────▶│                  │
 │                      │                      │                      │                  │                  │
 │                      │                      │ evaluate condition   │                  │                  │
 │                      │                      │                      │                  │                  │
 │                      │                      │ execute actions      │                  │                  │
 │                      │                      │────────────────────────────────────────────────────────────▶│
 │                      │                      │                      │                  │                  │
 │                      │                      │ write audit          │                  │                  │
 │                      │                      │ update composition   │                  │                  │
 │                      │                      │ emit UI event        │                  │                  │
```

---

### 11.3 Scheduled Sleep Judge

```txt
Scheduler Tick        CompositionEngine       DataAdapter          Goals Service       AuditLogger
 │                      │                      │                      │                  │
 │ tick 22:15           │                      │                      │                  │
 │─────────────────────▶│                      │                      │                  │
 │                      │ find due AT trigger  │                      │                  │
 │                      │ start execution      │                      │                  │
 │                      │                      │                      │                  │
 │                      │ read goal            │                      │                  │
 │                      │─────────────────────▶│                      │                  │
 │                      │                      │ SELECT goals         │                  │
 │                      │                      │                      │                  │
 │                      │ read foreground      │                      │                  │
 │                      │─────────────────────▶│                      │                  │
 │                      │                      │ in-memory tracker    │                  │
 │                      │                      │                      │                  │
 │                      │ condition true       │                      │                  │
 │                      │                      │                      │                  │
 │                      │ abandon_goal         │                      │                  │
 │                      │────────────────────────────────────────────▶│                  │
 │                      │                      │                      │ UPDATE goals     │
 │                      │                      │                      │                  │
 │                      │ log execution        │                      │                  │
 │                      │───────────────────────────────────────────────────────────────▶│
 │                      │                      │                      │                  │
 │                      │ emit changed         │                      │                  │
```

---

### 11.4 Error Recovery

```txt
CompositionEngine       AuditLogger        Renderer
 │                      │                  │
 │ action throws        │                  │
 │─────────────────────▶│                  │
 │                      │ execution.error  │
 │                      │                  │
 │ increment errors     │                  │
 │ if threshold hit     │                  │
 │ status = error       │                  │
 │                      │                  │
 │ compositions:changed │                  │
 │─────────────────────────────────────────▶
 │                      │                  │
 │                      │        card shows red badge
 │                      │                  │
 │ user clicks Edit     │                  │
 │◀─────────────────────────────────────────
 │                      │                  │
 │ user fixes DSL       │                  │
 │ status -> draft/active                  │
 │ error_count reset    │                  │
```

---

### 11.5 Kill Switch

```txt
User          Renderer          Main IPC          CompositionEngine       Scheduler/EventBus
 │               │                  │                      │                      │
 │ toggle off    │                  │                      │                      │
 │──────────────▶│                  │                      │                      │
 │               │ kill-switch      │                      │                      │
 │               │─────────────────▶│                      │                      │
 │               │                  │ setKillSwitch(true)  │                      │
 │               │                  │─────────────────────▶│                      │
 │               │                  │                      │ stop scheduler       │
 │               │                  │                      │─────────────────────▶│
 │               │                  │                      │ skip event handlers  │
 │               │                  │                      │─────────────────────▶│
 │               │                  │                      │ audit log            │
 │               │ settings-changed │                      │                      │
 │               │◀─────────────────│                      │                      │
 │ banner shown  │                  │                      │                      │
 │◀──────────────│                  │                      │                      │
```

---

### 11.6 AI Suggestion Flow

```txt
User          Renderer          Main IPC          SuggestionService       ProviderRouter       CompositionEngine
 │               │                  │                      │                      │                      │
 │ Ask AI        │                  │                      │                      │                      │
 │──────────────▶│                  │                      │                      │                      │
 │               │ compositions:suggest                    │                      │                      │
 │               │─────────────────▶│                      │                      │                      │
 │               │                  │ suggest(prompt)      │                      │                      │
 │               │                  │─────────────────────▶│                      │                      │
 │               │                  │                      │ build grammar prompt │                      │
 │               │                  │                      │─────────────────────▶│                      │
 │               │                  │                      │                      │ call provider        │
 │               │                  │                      │                      │                      │
 │               │                  │                      │ JSON DSL suggestion  │                      │
 │               │                  │                      │◀─────────────────────│                      │
 │               │                  │                      │ validate DSL         │                      │
 │               │                  │                      │─────────────────────────────────────────────▶
 │               │                  │                      │                      │                      │
 │               │ suggestion modal │                      │                      │                      │
 │               │◀─────────────────│                      │                      │                      │
 │               │                  │                      │                      │                      │
 │ Accept        │                  │                      │                      │                      │
 │──────────────▶│                  │                      │                      │                      │
 │               │ accept-suggestion│                      │                      │                      │
 │               │─────────────────▶│                      │                      │                      │
 │               │                  │ create composition   │                      │                      │
 │               │                  │────────────────────────────────────────────────────────────────────▶
 │               │                  │                      │                      │                      │
 │               │ composition card │                      │                      │                      │
 │               │◀─────────────────│                      │                      │                      │
```

---

## 12. Implementation Phases

### Phase 0 — Specification Lock

Tasks:

- finalize DSL grammar
- finalize manifest format
- finalize DB schema
- finalize IPC names
- confirm existing subsystem event hook points

Exit criteria:

- all checklist items reviewed
- no new npm packages required
- no changes required to existing feature contracts

---

### Phase 1 — Database and IPC Skeleton

Tasks:

- add new tables
- add settings seed
- add IPC handlers
- add preload bindings
- add renderer context provider
- add empty Compositions page

Exit criteria:

- `compositions:list` returns `{ compositions: [] }`
- settings can be read and updated
- kill switch toggle persists
- page uses glass pattern

---

### Phase 2 — DSL Core

Tasks:

- implement lexer
- implement parser
- implement AST types
- implement validator
- implement scope checker
- implement dry-run planner

Exit criteria:

- example compositions parse successfully
- invalid syntax returns line/column errors
- unknown datasets/actions fail validation
- scope escalation fails validation
- AST can be stored as JSON

---

### Phase 3 — Data Source Registry and Adapters

Tasks:

- implement manifest registry
- implement goals adapter
- implement system adapter
- implement learning adapter
- implement IDE adapter
- implement finance adapter
- implement canvas bridge

Exit criteria:

- DSL READ statements resolve to safe queries
- finance locked state is respected
- all queries are parameterized
- limits are enforced
- manifests are exposed through IPC

---

### Phase 4 — Event Bus and Scheduler

Tasks:

- implement EventBus
- add event publishing to existing subsystems
- implement trigger extraction
- implement scheduler tick
- implement startup catch-up
- implement dedupe and queue limits

Exit criteria:

- event-triggered compositions run
- interval compositions run
- daily AT compositions run
- duplicate events are ignored
- kill switch stops all triggers

---

### Phase 5 — Action Executor and Audit

Tasks:

- implement action manifests
- implement parameter validation
- implement review queue
- implement audit logging
- implement execution snapshots
- implement state store

Exit criteria:

- whitelisted actions execute
- non-whitelisted actions fail
- finance writes require approval
- every execution has audit record
- `SET_STATE` persists correctly

---

### Phase 6 — Dashboard UI

Tasks:

- build composition cards
- build stats strip
- build toolbar
- build empty/loading/error states
- build detail drawer
- build activity feed

Exit criteria:

- cards reflect live status
- toggle pause/active works
- run now works
- execution history visible
- error badge visible

---

### Phase 7 — Editor UI

Tasks:

- build DSL editor
- build guided builder
- build validation panel
- build scope/risk panel
- build save draft/activate flow
- build approval flow

Exit criteria:

- guided builder generates valid DSL
- DSL editor validates on demand
- finance compositions enter review
- user can edit from detail drawer
- activation blocked when validation fails

---

### Phase 8 — AI Suggestions

Tasks:

- build suggestion service
- integrate existing provider router
- build suggestion modal
- build accept/edit/reject flow
- store suggestions in DB

Exit criteria:

- AI returns valid DSL JSON
- invalid AI output is rejected
- accepted AI compositions require approval when configured
- suggestions work only when provider available
- no user data is sent unless explicitly included

---

### Phase 9 — Hardening

Tasks:

- optional validator worker thread
- performance profiling
- execution timeout enforcement
- circuit breaker tuning
- audit export
- template export/import
- redaction review

Exit criteria:

- main thread remains responsive under load
- runaway compositions are stopped
- error states never crash app
- kill switch works instantly
- all executions are auditable

---

### Phase 10 — Template Gallery and Expansion

Tasks:

- template registry UI
- import/export JSON
- featured safe templates
- composition duplication
- composition sharing

Exit criteria:

- user can save composition as template
- templates validate before import
- imported compositions cannot exceed manifest scope
- AI can suggest from template library

---

## 13. Example Manifest Snippets

### 13.1 Goals Action Manifest

```ts
{
  name: 'goals.abandon_goal',
  description: 'Mark a goal as abandoned with an optional note.',
  scope: 'WRITE goals',
  requiresReview: false,
  destructive: true,
  params: [
    {
      name: 'goal_id',
      type: 'number',
      required: true,
    },
    {
      name: 'note',
      type: 'string',
      required: false,
      maxLength: 500,
    },
  ],
}
```

---

### 13.2 Finance Action Manifest

```ts
{
  name: 'finance.create_transaction',
  description: 'Create a finance transaction.',
  scope: 'WRITE finance',
  requiresReview: true,
  destructive: false,
  financeSensitive: true,
  params: [
    {
      name: 'account_id',
      type: 'number',
      required: true,
    },
    {
      name: 'wallet_id',
      type: 'number',
      required: false,
    },
    {
      name: 'category_id',
      type: 'number',
      required: true,
    },
    {
      name: 'type',
      type: 'string',
      required: true,
      enum: ['income', 'expense', 'transfer'],
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'description',
      type: 'string',
      required: false,
      maxLength: 500,
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
  ],
}
```

---

### 13.3 System Notify Manifest

```ts
{
  name: 'system.notify',
  description: 'Show a local desktop notification.',
  scope: 'WRITE system',
  requiresReview: false,
  destructive: false,
  params: [
    {
      name: 'title',
      type: 'string',
      required: true,
      maxLength: 120,
    },
    {
      name: 'body',
      type: 'string',
      required: true,
      maxLength: 500,
    },
  ],
}
```

---

## 14. Existing Subsystem Integration Plan

The composition system is additive. Existing handlers should publish events after successful writes.

### 14.1 Goals Integration

After existing IPC handlers:

```txt
goals:create       -> publish goals.created
goals:update       -> publish goals.updated
goals:delete       -> publish goals.deleted
goals:save-review  -> publish goals.review_saved
```

Payload example:

```json
{
  "id": 12,
  "title": "Sleep by 22:00",
  "status": "active",
  "tier": "daily_habit",
  "progress": 0
}
```

---

### 14.2 Finance Integration

After existing finance handlers:

```txt
addTransaction       -> finance.transaction_created
updateTransaction    -> finance.transaction_updated
deleteTransaction    -> finance.transaction_deleted
addSubscription      -> finance.subscription_created
markFixedExpensePaid -> finance.fixed_expense_paid
```

Payloads must respect finance lock and redaction settings.

---

### 14.3 Learning Integration

```txt
learn:update-lesson    -> learning.lesson_updated
learn:save-flashcard   -> learning.flashcard_created
learn:update-flashcard -> learning.flashcard_reviewed
```

---

### 14.4 IDE Integration

```txt
create-ide-project -> ide.project_created
update-ide-project -> ide.project_updated
ai usage insert    -> ide.ai_usage_saved
line stats upsert  -> ide.line_stats_updated
```

---

### 14.5 System/Tracking Integration

```txt
foreground change -> system.foreground_changed
browser event     -> system.browser_changed
app resume        -> system.app_resumed
midnight rollover -> system.day_changed
```

The system adapter maintains an in-memory latest-state object:

```ts
{
  last_active_at: string | null;
  last_app_name: string | null;
  last_window_title: string | null;
  last_url: string | null;
  daily_active_sec: number;
}
```

This allows ambient evaluation without requiring new raw tracking tables.

---

## 15. Performance Plan

### 15.1 Main Thread Protection

- scheduler tick every 15 seconds
- evaluations are async
- long evaluations are timed out
- DB reads use prepared statements and limits
- FOREACH loops are capped
- event queue is capped
- heavy validation can move to worker thread

---

### 15.2 Worker Thread Option

Use Node built-in `worker_threads` for:

- DSL parsing
- AST validation
- AI suggestion validation

Worker does not get DB access.

Worker input:

```json
{
  "source": "COMPOSITION ...",
  "manifests": []
}
```

Worker output:

```json
{
  "validation": {}
}
```

---

### 15.3 Database Performance

Indexes are added for:

- composition status
- trigger topic
- trigger next run
- execution composition
- execution status
- execution start time
- audit created time

Execution snapshots are JSON blobs to avoid expensive joins.

---

## 16. Acceptance Tests

### 16.1 DSL Tests

- valid sleep composition parses
- invalid token returns error
- unknown dataset fails
- unknown action fails
- missing scope fails
- FOREACH over limit fails
- nested FOREACH over depth fails
- source over max length fails

---

### 16.2 Execution Tests

- manual run creates execution
- interval trigger fires once per interval
- AT trigger fires once per day
- event trigger respects filter
- duplicate event is ignored
- rate limiter blocks excess runs
- timeout marks execution as timeout
- consecutive errors set status error

---

### 16.3 Safety Tests

- finance write enters review
- destructive action enters review when setting enabled
- kill switch blocks execution
- paused composition does not run
- archived composition does not run
- AI suggestion with invalid DSL is rejected
- provider failure does not break compositions

---

### 16.4 UI Tests

- empty state appears with zero compositions
- skeleton appears during load
- card status badge matches state
- toggle pauses/activates composition
- editor validation shows line errors
- detail drawer shows executions
- activity feed updates on execution
- kill switch banner appears when disabled

---

## 17. Verify Checklist

- [x] DSL grammar is defined in BNF and auditable by a human
- [x] Every subsystem has a data source manifest
- [x] Composition storage uses existing SQLite DB with new tables
- [x] IPC channels follow lowercase colon-separated convention
- [x] Preload bindings follow camelCase convention
- [x] All new components use glass pattern
- [x] Existing shadcn components are used
- [x] No new npm packages required
- [x] System can be disabled with a single kill switch
- [x] Error states handled gracefully
- [x] Design supports DSL editor and guided builder
- [x] Event bus supports typed pub/sub, async dispatch, dedup
- [x] Scheduler supports polling, interval, daily time, and manual triggers
- [x] Action executor limited to manifest-defined safe actions
- [x] Audit trail logs evaluations, actions, errors, lifecycle events
- [x] Rate limiter prevents runaway evaluations
- [x] Security sandbox blocks arbitrary SQL/code execution
- [x] Finance writes require review
- [x] AI cannot generate code, only DSL compositions
- [x] System works offline except optional AI suggestions

---

## 18. Final Summary

This specification gives DeskFlow a safe self-expanding agentic layer.

It does not give the AI code access.

It does not allow arbitrary execution.

It does not generate new app features directly.

Instead, it gives the AI and the user a controlled composition fabric:

```txt
Existing Data + Existing Events + Existing Actions
                    ↓
              DSL Composition
                    ↓
        Safe Automated Behavior
                    ↓
          Full Audit Trail
```

The result is a system where DeskFlow can grow new capabilities by connecting what already exists:

- Goals can be judged by system activity.
- Finance can trigger goals.
- Learning mastery can create milestones.
- IDE staleness can create reminders.
- Canvas can summarize cross-domain state.
- AI can propose new rules, but humans approve them.

This is the safest practical version of a self-expanding agentic system for DeskFlow.
```