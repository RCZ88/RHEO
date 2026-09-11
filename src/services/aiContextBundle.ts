type AnyRec = Record<string, unknown>

function bridge(): AnyRec | undefined {
  const w = window as unknown as { deskflowAPI?: AnyRec }
  return w.deskflowAPI
}

async function safe<T>(fn: (() => Promise<T> | T) | undefined, fallback: T): Promise<T> {
  try {
    if (typeof fn !== "function") return fallback
    const v = await fn()
    return (v ?? fallback) as T
  } catch {
    return fallback
  }
}

export function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
}

export const PAGE_CATALOG = [
  "You are DeskFlow AI, an assistant embedded in the user's productivity tracker.",
  "Be concise, concrete, and reference the user's real data below when relevant.",
  "",
  "## App pages you can reason about",
  "- Dashboard (/): productive timer, recent sessions, 7x24 heatmap, weekly overview.",
  "- Stats (/stats): per-app totals, sessions list, live foreground app + category.",
  "- IDE Projects (/ide): detected projects, AI tool usage/cost, per-project git stats.",
  "- Browser (/browser): domain groups, top sites, time per site.",
  "- External (/external): logged off-device activity, sleep tracking, time audit.",
  "- Terminal (/terminal): AI agent workspace sessions, terminal tabs, saved workspaces.",
  "- Settings (/settings): category tiers, browser rules, AI providers, tracking config.",
  "- Insights (/reports): hourly day view, weekly comparison, per-activity analysis.",
  "- Finance (/finance): transactions, budgets, net worth, crypto, subscriptions.",
  "- AI (/ai): goals/focus, long-term plan, daily digest, connectors, and this chat.",
  "",
  "## Canvas Card System (CRITICAL — how your output becomes visible)",
  "The AI page has a CANVAS MODE where your structured JSON responses become interactive cards.",
  "When you output the correct JSON format below, a card is automatically created on the user's canvas.",
  "If a card of that type already exists, your new data is MERGED into it (not duplicated).",
  "",
  "### Card types you can create:",
  "",
  "1. FOCUS CARD (goal_suggestion) — shows as a checklist of goals",
  "   Output: { type: \"goal_suggestion\", goals: [{title, category, reason, priority}], source }",
  "   - title: short goal name (e.g. \"Review PR #42\")",
  "   - category: \"work\" | \"personal\" | \"health\" | \"learning\" | \"finance\"",
  "   - reason: why this goal matters (1 sentence)",
  "   - priority: 1 (high) to 5 (low)",
  "   - source: why you suggested this (e.g. \"based on your recent coding activity\")",
  "   - When to use: user asks for goals, focus suggestions, what to do today, productivity advice",
  "",
  "2. PLAN CARD (plan_update) — shows as a long-term goals list with categories",
  "   Output: { type: \"plan_update\", changes: [{action: \"add\"|\"modify\"|\"complete\", goal: {title, priority, category}}], note }",
  "   - action \"add\": adds a new goal to the plan",
  "   - action \"complete\": marks a goal as done",
  "   - action \"modify\": changes an existing goal's properties",
  "   - note: optional commentary about the changes",
  "   - When to use: user wants to plan long-term, update goals, mark goals complete",
  "",
  "3. FINANCE CARD (stats_summary) — shows balance, income, expense with metrics",
  "   Output: { type: \"stats_summary\", metrics: [{label, value, change, icon, format}], period }",
  "   - Required metrics: \"Balance\" (total), \"Income\" (monthly), \"Expense\" (monthly)",
  "   - icon: \"Activity\" | \"Clock\" | \"Flame\" | \"Target\" | \"Zap\" | \"BarChart3\"",
  "   - format: \"number\" | \"duration\" | \"hours\" | \"percent\"",
  "   - change: percentage change from last period (e.g. 12.5 for +12.5%)",
  "   - When to use: user asks about finances, spending, income, budget status",
  "",
  "4. DIGEST CARD (digest_item) — shows research topics with summaries",
  "   Output: { type: \"digest_item\", topic, summary, sources: [{title, url}] }",
  "   - topic: research area (e.g. \"React 19 new features\")",
  "   - summary: 2-3 sentence overview",
  "   - sources: links to relevant articles/docs",
  "   - When to use: user asks for research, digest, topic summary, what's trending",
  "",
  "5. ACTION CARD (action_list) — shows actionable items with approve/reject buttons",
  "   Output: { type: \"action_list\", actions: [{label, description, priority, actionButton: {label, ipc, payload}}], note }",
  "   - label: short action name",
  "   - description: what this action does",
  "   - priority: 1 (high) to 5 (low)",
  "   - actionButton: optional IPC call when approved (label=button text, ipc=handler name, payload=data)",
  "   - When to use: user needs confirmation for something, approval workflow, batch actions",
  "",
  "6. CONNECTOR CARD (connector_status) — shows email/calendar connector health",
  "   Output: { type: \"connector_status\", connectors: [{name, status, lastSync, itemsCount, id}] }",
  "   - status: \"connected\" | \"error\" | \"syncing\" | \"idle\"",
  "   - When to use: user asks about email, calendar, connected services",
  "",
  "7. FORM CARD (form_fill) — shows a structured form with fields",
  "   Output: { type: \"form_fill\", title, submitLabel, fields: [{name, label, type, value, options}] }",
  "   - field type: \"text\" | \"number\" | \"select\" | \"toggle\"",
  "   - options: for select type, array of {label, value}",
  "   - When to use: user needs to input structured data, fill a form, configure settings",
  "",
  "8. CHART CARD (chart_data) — shows a bar/line/pie chart",
  "   Output: { type: \"chart_data\", chartType: \"bar\"|\"line\"|\"pie\", labels: [], datasets: [{label, data, color}], title }",
  "   - data: array of numbers matching labels",
  "   - color: hex color for the dataset",
  "   - When to use: user asks for visualization, comparison, data over time",
  "",
  "9. ERROR CARD (error) — shows error with recovery suggestion",
  "   Output: { type: \"error\", message, recovery }",
  "   - When to use: something went wrong and you need to tell the user what happened and how to fix it",
  "",
  "### Rules for structured output:",
  "- Output ONLY the JSON block — no prose around it (the card UI replaces your text)",
  "- Use ```json fenced blocks for the JSON",
  "- For ordinary conversation, reply in plain text (no JSON)",
  "- NEVER mix prose and a JSON block in the same message",
  "- When data is already on the canvas, UPDATE the existing card by merging data",
  "- Multiple structured responses in one message: output multiple separate JSON blocks",
  "- If the user asks a question AND you have structured data, answer the question first (plain text), then output the JSON block",
  "",
  "## Structured output contract",
  "When a rich, actionable answer fits one of these shapes, reply with ONLY a fenced",
  "```json block (no prose outside it) using one of these `type` values:",
  '- goal_suggestion: { type, goals:[{title,category,reason}], source }',
  '- plan_update: { type, changes:[{action:"add"|"modify"|"complete", goal:{title,priority,category}}] }',
  '- stats_summary: { type, metrics:[{label,value,change,icon,format}], period }',
  '- action_list: { type, actions:[{label,description,priority,actionButton:{label,ipc,payload}}] }',
  '- digest_item: { type, topic, summary, sources:[{title,url}] }',
  '- connector_status: { type, connectors:[{name,status,lastSync,itemsCount,id}] }',
  '- form_fill: { type, title, submitLabel, fields:[{name,label,type,value,options}] }',
  '- chart_data: { type, chartType:"bar"|"line"|"pie", labels:[], datasets:[{label,data,color}], title }',
  '- error: { type, message, recovery }',
  "For ordinary conversation, reply in plain text (no JSON). Never mix prose and a JSON block.",
  'Valid metric `icon` values: Activity, Clock, Flame, Target, Zap, BarChart3.',
  'Valid `format` values: number, duration (seconds), hours (seconds), percent.',
  "",
  "## Canvas Control",
  "You can control the user's canvas through structured JSON responses:",
  "- To ADD a card: output the appropriate JSON type (goal_suggestion, plan_update, etc.) — a card is created automatically",
  "- To UPDATE an existing card: output the same type — the data is merged into the existing card of that type",
  "- To HIGHLIGHT a card: output { type: \"highlight\", cardType: \"<type>\" } — the canvas will flash the matching card",
  "- To SAVE the canvas: output { type: \"canvas_action\", action: \"save\" }",
  "- To ARRANGE cards: output { type: \"canvas_action\", action: \"arrange\" }",
  "- To CLEAR the canvas: output { type: \"canvas_action\", action: \"clear\" } — only with user confirmation",
  "",
  "## Automation Creation",
  "When the user asks to create an automation, output a fenced ```automation block:",
  '```automation',
  '{ "name": "Daily standup reminder", "config": { "trigger": { "type": "cron", "expression": "0 9 * * *" }, "actions": [{ "type": "send_message", "text": "Good morning! Time for standup." }], "priority": "medium", "category": "productivity", "lifecycle": "active" } }',
  '```',
  "The system will automatically create the automation rule from this block.",
  "",
  "## Conversation Style",
  "- Be concise and actionable — the user is productive and values speed",
  "- When showing data, prefer cards/visuals over text dumps",
  "- When the user asks vague questions, clarify with 1-2 specific options",
  "- Proactively suggest actions based on context (e.g. 'You have 3 unread emails' → offer to show them)",
  "- When the user seems overwhelmed, simplify and prioritize",
  "- Match the user's energy — if they're casual, be casual; if they're focused, be precise",
  "- Reference the user's ACTUAL data from the context below, not generic advice",
  "",
  "## What You Have Access To",
  "The user's productivity data is provided in the live context below. You can see:",
  "- Today's goals and their completion status",
  "- Long-term goals and their progress",
  "- Finance summary (balance, income, expenses)",
  "- App usage stats (which apps, how long)",
  "- Sleep data from last night",
  "- Email and calendar connector status",
  "- Research digest topics",
  "- Active projects",
  "- Planning notes",
  "- What cards exist on the canvas right now",
  "Use this data to give personalized, data-driven responses — not generic advice.",
].join("\n")

function clip(v: unknown, max = 1200): string {
  let s: string
  try {
    s = typeof v === "string" ? v : JSON.stringify(v)
  } catch {
    return ""
  }
  if (!s) return ""
  return s.length > max ? s.slice(0, max) + "\u2026" : s
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '\u2026' : s
}

// CHANGED — return type now includes warnings for silent degradation
export interface ContextBundleResult {
  content: string
  warnings: string[]
}

const MAX_CONTEXT_CHARS = 12000  // ~3000 tokens — enough for prompt + live data

export async function buildContextBundle(): Promise<string> {
  const result = await buildContextBundleDetailed()
  return result.content
}

export async function buildContextBundleDetailed(): Promise<ContextBundleResult> {
  const b = bridge()
  const date = todayIso()
  const warnings: string[] = []

  const [goals, longterm, goalCtx, usage, projects, planning, sleep, externalSessions] = await Promise.all([
    safe<unknown>(b && (() => (b.getGoals as (d: string) => Promise<unknown>)(date)), null),
    safe<unknown>(b && (() => (b.getLongtermGoals as () => Promise<unknown>)()), null),
    safe<unknown>(b && (() => (b.getGoalContext as () => Promise<unknown>)()), null),
    safe<unknown>(
      b && (() => (b.getAIUsageSummary as (p?: string) => Promise<unknown>)("today")),
      null,
    ),
    safe<unknown>(b && (() => (b.getProjects as () => Promise<unknown>)()), null),
    safe<unknown>(b && (() => (b.readPlanningMd as () => Promise<unknown>)()), null),
    safe<unknown>(b && (() => (b.getSleepForDate as (d: string) => Promise<unknown>)(date)), null),
    safe<unknown>(b && (() => (b.getExternalSessions as (p: string) => Promise<unknown>)('today')), null),
  ])

  // ADDED — connectors context (enhanced)
  let connectors: any[] = []
  try {
    const listResult = b && await (b.connectors?.list as () => Promise<any>)()
    connectors = listResult?.connectors || []
  } catch {
    warnings.push('Connectors context failed')
  }

  // ADDED — active goals as current focus
  let activeGoals: unknown = null
  try {
    const goalsResult = goals as any
    activeGoals = goalsResult?.goals?.filter?.((g: any) => g.status === 'active').slice(0, 5) ?? null
  } catch {
    /* already warned above */
  }

  // ADDED — finance context
  let financeSummary: any = null
  let financeWallets: any[] = []
  let financeSubscriptions: any = null
  try {
    financeSummary = await safe<unknown>(b && (() => (b.financeGetSummary as () => Promise<unknown>)()), null)
    financeWallets = (await safe<any[]>(b && (() => (b.financeGetWallets as () => Promise<any>)()), [])) || []
    financeSubscriptions = await safe<unknown>(b && (() => (b.financeGetSubscriptionIntelligence as () => Promise<unknown>)()), null)
  } catch {
    warnings.push('Finance context failed')
  }

  const dash = await safe<unknown>(
    b && (() => (b.getDashboardAggregates as (a: AnyRec) => Promise<unknown>)({ period: "today" })),
    null,
  )

  // ADDED — canvas state (what cards exist)
  let canvasCards: any[] = []
  try {
    const activeId = localStorage.getItem('deskflow-canvas-active')
    if (activeId) {
      const raw = localStorage.getItem('deskflow-canvas-' + activeId)
      if (raw) {
        const snapshot = JSON.parse(raw)
        if (snapshot?.state?.cards) {
          canvasCards = Object.values(snapshot.state.cards).filter((c: any) => !c.dismissedAt)
        }
      }
    }
  } catch {
    // canvas state not available
  }

  // ADDED — user context profile
  let userProfile: any = null
  try {
    userProfile = await safe<any>(b && (() => (b.contextGetProfile as () => Promise<any>)()), null)
  } catch {
    // context profile not available
  }

  const lines: string[] = ["## Live user context (" + date + ")"]

  // Canvas cards — tells the AI what already exists so it can update instead of duplicate
  if (canvasCards.length > 0) {
    lines.push("### Existing canvas cards")
    for (const c of canvasCards) {
      const type = c.type
      const pinned = c.pinned ? ' [pinned]' : ''
      const data = c.data || {}
      let summary = ''
      if (type === 'focus') summary = `${(data.goals || []).length} goals`
      else if (type === 'plan') summary = `${(data.goals || []).length} goals, notes: ${data.notes ? 'yes' : 'no'}`
      else if (type === 'finance') summary = `balance: ${data.summary?.totalBalance || '?'}`
      else if (type === 'digest') summary = `${(data.topics || []).length} topics`
      else if (type === 'approval') summary = `${(data.actions || []).length} actions`
      else if (type === 'connectors') summary = `${(data.connectors || []).length} connectors`
      else if (type === 'response') summary = data.content ? data.content.slice(0, 80) + '...' : 'response'
      else if (type === 'annotation') summary = data.text || 'note'
      else summary = type
      lines.push(`- ${type.toUpperCase()}${pinned}: ${summary}`)
    }
    lines.push("")
  }
  if (goals) lines.push("### Today's goals", clip(goals))
  else warnings.push('Goals unavailable')
  if (longterm) lines.push("### Long-term goals", clip(longterm))
  if (goalCtx) lines.push("### 7-day goal trends", clip(goalCtx, 800))
  if (dash) lines.push("### Today's app usage", clip(dash, 900))
  if (usage) lines.push("### AI usage today", clip(usage, 600))
  if (projects) lines.push("### Active projects", clip(projects, 800))
  if (planning) lines.push("### Planning notes", clip(planning, 900))

  // ADDED — connectors in context (enhanced with items)
  if (connectors.length > 0) {
    lines.push("### Active connectors")
    for (const c of connectors) {
      lines.push(`- ${c.displayName} (${c.type}/${c.provider}) \u2014 ${c.status}`)
      if (c.status === "connected") {
        try {
          const itemsResult = await b.connectors?.items(c.id, { limit: c.type === "email" ? 5 : 3 })
          if (itemsResult?.success && itemsResult.items?.length > 0) {
            for (const item of itemsResult.items) {
              if (c.type === "email") {
                const from = item.metadata?.from ? ` from ${item.metadata.from}` : ""
                const read = item.is_read ? "" : " [UNREAD]"
                lines.push(`  \u{1F4E7} ${item.subject || "(no subject)"}${from}${read} \u2014 ${item.date?.slice(0, 10)}`)
              } else if (c.type === "calendar") {
                const start = item.metadata?.startTime ? ` at ${item.metadata.startTime.slice(11, 16)}` : ""
                lines.push(`  \u{1F4C5} ${item.summary || "(no title)"}${start} \u2014 ${item.date?.slice(0, 10)}`)
              }
            }
          }
        } catch {
          // silently skip items for this connector
        }
      }
    }
    lines.push("")
  }

  // ADDED — finance data
  if (financeSummary) lines.push("### Finance summary", clip(financeSummary, 800))
  if (financeWallets.length > 0) {
    const walletSummary = financeWallets.map((w: any) => ({
      name: w.name,
      type: w.type,
      balance: w.balance,
      currency: w.currency,
    }))
    lines.push("### Wallets", clip(walletSummary, 600))
  }
  if (financeSubscriptions) lines.push("### Subscriptions", clip(financeSubscriptions, 600))

  // Sleep data
  if (sleep) {
    const sleepData = sleep as any
    if (sleepData.sleeps && sleepData.sleeps.length > 0) {
      const last = sleepData.sleeps[0]
      const hours = last.total_sleep_seconds ? Math.round(last.total_sleep_seconds / 3600 * 10) / 10 : '?'
      lines.push(`### Sleep last night: ${hours}h (quality: ${last.quality || 'unknown'})`)
    } else if (sleepData.total_sleep_seconds) {
      const hours = Math.round(sleepData.total_sleep_seconds / 3600 * 10) / 10
      lines.push(`### Sleep last night: ${hours}h`)
    }
  }

  // External/off-device sessions
  if (externalSessions) {
    const ext = externalSessions as any
    const sessions = ext?.sessions || ext || []
    if (Array.isArray(sessions) && sessions.length > 0) {
      lines.push("### Off-device activity today")
      for (const s of sessions.slice(0, 5)) {
        const dur = s.duration_minutes ? `${s.duration_minutes}m` : s.duration || '?'
        lines.push(`- ${s.activity || s.type || 'unknown'}: ${dur}`)
      }
    }
  }

  // ADDED — current focus (active goals)
  if (activeGoals) lines.push("### Current focus", clip(activeGoals, 400))

  // Available card types (so the AI knows what it can create)
  lines.push("### Available card types on canvas")
  lines.push("focus, plan, finance, digest, reflect, connectors, schedule, deadlines, planner, response, annotation, approval, group")

  // User profile (who this person is)
  if (userProfile) {
    const p = userProfile as any
    const traitKeys = Object.keys(p.traits || {})
    const interestKeys = Object.keys(p.interests || {})
    const habitKeys = Object.keys(p.habits || {})
    const commKeys = Object.keys(p.communicationStyle || {})

    if (traitKeys.length > 0 || interestKeys.length > 0 || habitKeys.length > 0) {
      lines.push("### User profile (auto-derived from interactions)")
      if (traitKeys.length > 0) {
        lines.push("Traits: " + traitKeys.map((k: string) => {
          const t = p.traits[k]
          return `${t.content} (${Math.round((t.confidence || 0) * 100)}% confidence, seen ${t.occurrences || 1}x)`
        }).join('; '))
      }
      if (interestKeys.length > 0) {
        lines.push("Interests: " + interestKeys.map((k: string) => {
          const i = p.interests[k]
          return `${i.content}`
        }).join(', '))
      }
      if (habitKeys.length > 0) {
        lines.push("Habits: " + habitKeys.map((k: string) => {
          const h = p.habits[k]
          return `${h.content}`
        }).join(', '))
      }
      if (commKeys.length > 0) {
        lines.push("Communication style: " + commKeys.map((k: string) => {
          const c = p.communicationStyle[k]
          return `${c.content}`
        }).join(', '))
      }
    }
  }

  if (lines.length === 1) lines.push("(No live data available right now.)")

  let content = PAGE_CATALOG + "\n\n" + lines.join("\n")

  // ADDED — truncate to fit token budget
  if (content.length > MAX_CONTEXT_CHARS) {
    content = content.slice(0, MAX_CONTEXT_CHARS) + '\n\n[Context truncated to fit token budget]'
    warnings.push('Context truncated to fit token budget')
  }

  return { content, warnings }
}
