import type { AccentKey } from "../tokens"

export interface ParsedGoal {
  title: string
  category?: string
  reason?: string
  priority?: number
}

export interface PlanChange {
  action: "add" | "modify" | "complete"
  goal: { title: string; priority?: number; category?: string }
}

export interface StatMetric {
  label: string
  value: number
  change?: number
  icon?: string
  format?: "number" | "duration" | "percent" | "hours"
}

export interface ActionItem {
  label: string
  description?: string
  priority?: number
  actionButton?: { label: string; ipc: string; payload?: Record<string, unknown> }
}

export interface SourceLink {
  title: string
  url: string
}

export interface ConnectorStatusItem {
  name: string
  status: "connected" | "error" | "syncing" | "idle" | string
  lastSync?: string
  itemsCount?: number
  id?: string
}

export type FormFieldType = "text" | "number" | "select" | "toggle"

export interface FormField {
  name: string
  label: string
  type: FormFieldType
  value?: string | number | boolean
  options?: Array<{ label: string; value: string }>
  placeholder?: string
  required?: boolean
}

export interface ChartDataset {
  label: string
  data: number[]
  color?: string
}

export type ParsedMessage =
  | { type: "text"; text?: string }
  | { type: "goal_suggestion"; goals: ParsedGoal[]; source?: string }
  | { type: "plan_update"; changes: PlanChange[]; note?: string }
  | { type: "stats_summary"; metrics: StatMetric[]; period?: string }
  | { type: "action_list"; actions: ActionItem[]; note?: string }
  | { type: "digest_item"; topic: string; summary: string; sources?: SourceLink[] }
  | { type: "connector_status"; connectors: ConnectorStatusItem[] }
  | { type: "form_fill"; title?: string; submitLabel?: string; fields: FormField[] }
  | {
      type: "chart_data"
      chartType: "bar" | "line" | "pie"
      labels: string[]
      datasets: ChartDataset[]
      title?: string
    }
  | { type: "error"; message: string; recovery?: string }
  | { type: "reminder_create"; text: string; dueDate?: string; goalId?: string }
  | { type: "goal_event_link"; goalId: string; eventId: string; eventTitle: string }

export type ParsedType = ParsedMessage["type"]

export type CardAction =
  | { kind: "accept-goal"; goal: ParsedGoal }
  | { kind: "dismiss-goal"; goal: ParsedGoal }
  | { kind: "apply-plan"; changes: PlanChange[] }
  | { kind: "run-ipc"; ipc: string; payload?: Record<string, unknown>; label?: string }
  | { kind: "submit-form"; values: Record<string, string | number | boolean> }
  | { kind: "sync-connector"; id?: string; name: string }
  | { kind: "open-url"; url: string }
  | { kind: "retry" }
  | { kind: "send-text"; text: string }
  | { kind: "create-reminder"; text: string; dueDate?: string; goalId?: string }
  | { kind: "link-goal-event"; goalId: string; eventId: string; eventTitle: string }

export interface CardActionHandlers {
  acceptGoal?: (payload: any) => void;
  viewDetail?: (payload: any) => void;
  dismiss?: (messageId: string) => void;
  retry?: (payload: any) => void;
  applyPlan?: (changes: PlanChange[]) => void;
  runIpc?: (ipc: string, payload?: Record<string, unknown>) => void;
  submitForm?: (values: Record<string, string | number | boolean>) => void;
  syncConnector?: (id?: string, name?: string) => void;
  openUrl?: (url: string) => void;
  sendText?: (text: string) => void;
}

export function handleCardAction(
  action: CardAction,
  messageId: string,
  handlers: CardActionHandlers,
): void {
  switch (action.kind) {
    case 'accept-goal':
      handlers.acceptGoal?.(action.goal);
      break;
    case 'dismiss-goal':
      handlers.dismiss?.(messageId);
      break;
    case 'apply-plan':
      handlers.applyPlan?.(action.changes);
      break;
    case 'run-ipc':
      handlers.runIpc?.(action.ipc, action.payload);
      break;
    case 'submit-form':
      handlers.submitForm?.(action.values);
      break;
    case 'sync-connector':
      handlers.syncConnector?.(action.id, action.name);
      break;
    case 'open-url':
      handlers.openUrl?.(action.url);
      break;
    case 'retry':
      handlers.retry?.(undefined);
      break;
    case 'send-text':
      handlers.sendText?.(action.text);
      break;
    case 'create-reminder':
      handlers.runIpc?.('createReminder', { text: action.text, dueDate: action.dueDate, goalId: action.goalId });
      break;
    case 'link-goal-event':
      handlers.runIpc?.('linkGoalEvent', { goalId: action.goalId, eventId: action.eventId, eventTitle: action.eventTitle });
      break;
    default:
      break;
  }
}

const ACCENT_BY_TYPE: Record<ParsedType, AccentKey> = {
  text: "pink",
  goal_suggestion: "emerald",
  plan_update: "violet",
  stats_summary: "cyan",
  action_list: "pink",
  digest_item: "cyan",
  connector_status: "cyan",
  form_fill: "violet",
  chart_data: "amber",
  error: "red",
  reminder_create: "emerald",
  goal_event_link: "cyan",
}

export function accentForType(t: ParsedType): AccentKey {
  return ACCENT_BY_TYPE[t] ?? "pink"
}

const KNOWN_TYPES: string[] = [
  "text",
  "goal_suggestion",
  "plan_update",
  "stats_summary",
  "action_list",
  "digest_item",
  "connector_status",
  "form_fill",
  "chart_data",
  "error",
  "reminder_create",
  "goal_event_link",
]

export function isParsedMessage(v: unknown): v is ParsedMessage {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as { type?: unknown }).type === "string" &&
    KNOWN_TYPES.includes((v as { type: string }).type)
  )
}

export function parseAssistantContent(
  raw: string,
  storedJson?: string | null,
): { text: string; parsed?: ParsedMessage } {
  if (storedJson) {
    try {
      const obj = JSON.parse(storedJson)
      if (isParsedMessage(obj)) {
        const t = obj.type === "text" && obj.text ? String(obj.text) : raw || ""
        return { text: obj.type === "text" ? t : "", parsed: obj }
      }
    } catch {
      /* fall through */
    }
  }
  const text = raw ?? ""
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) {
    try {
      const obj = JSON.parse(fence[1].trim())
      if (isParsedMessage(obj)) {
        return { text: text.replace(fence[0], "").trim(), parsed: obj }
      }
    } catch {
      /* not a payload */
    }
  }
  const trimmed = text.trim()
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed)
      if (isParsedMessage(obj)) return { text: "", parsed: obj }
    } catch {
      /* plain prose that happens to start with a brace */
    }
  }
  return { text }
}

export function serializeParsed(parsed?: ParsedMessage): string | undefined {
  if (!parsed) return undefined
  try {
    return JSON.stringify(parsed)
  } catch {
    return undefined
  }
}

export function formatStat(value: number, format?: StatMetric["format"]): string {
  if (format === "duration") {
    const s = Math.max(0, Math.round(value))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (h > 0) return h + "h " + m + "m"
    if (m > 0) return m + "m"
    return s + "s"
  }
  if (format === "hours") return (Math.round((value / 3600) * 10) / 10) + "h"
  if (format === "percent") return Math.round(value) + "%"
  return new Intl.NumberFormat().format(Math.round(value))
}
