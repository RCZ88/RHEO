/**
 * IPC Allowlist — Security layer for AI-triggered IPC calls.
 * Only pre-approved functions can be invoked from AI-generated cards.
 */

type IPCValidator = (payload: any) => boolean

interface IPCEntry {
  handler: (payload: any) => Promise<any>
  validate?: IPCValidator
  requiresConfirm?: boolean
}

function hasFields(...fields: string[]): IPCValidator {
  return (payload: any) => {
    if (!payload || typeof payload !== 'object') return false
    return fields.every(f => payload[f] !== undefined)
  }
}

function getAPI(): any {
  return (window as any).deskflowAPI
}

// ── READ endpoints (always allowed, no confirmation) ──
export const READ_IPC: Record<string, (payload: any) => Promise<any>> = {
  getGoals:                (p) => getAPI().getGoals(p.date),
  getGoalsBatch:           (p) => getAPI().getGoalsBatch(p.start, p.end),
  getDailyReflection:      (p) => getAPI().getDailyReflection(p.date),
  getGoalContext:          ()  => getAPI().getGoalContext(),
  getLongtermGoals:        ()  => getAPI().getLongtermGoals(),
  getReminders:            ()  => getAPI().getReminders(),
  getDashboardAggregates:  (p) => getAPI().getDashboardAggregates(p),
  getAIUsageSummary:       (p) => getAPI().getAIUsageSummary(p.period),
  getProjects:             ()  => getAPI().getProjects(),
  readPlanningMd:          ()  => getAPI().readPlanningMd(),
  getTopicDigest:          (p) => getAPI().getTopicDigest(p?.force),
  isDigestGenerating:      ()  => getAPI().isDigestGenerating(),
  'connectors.list':       ()  => getAPI().connectors.list(),
  'connectors.items':      (p) => getAPI().connectors.items(p.id, p.opts),
  'connectors.test':       (p) => getAPI().connectors.test(p.id),
  getAiProviders:          ()  => getAPI().getAiProviders(),
  aiChatLoad:              (p) => getAPI().aiChatLoad(p.threadDate),
  aiChatListThreads:       ()  => getAPI().aiChatListThreads(),
  aiChatGetMemories:       (p) => getAPI().aiChatGetMemories(p.threadDate),
  financeGetSummary:       ()  => getAPI().financeGetSummary(),
  financeGetWallets:       ()  => getAPI().financeGetWallets(),
  financeGetSubscriptionIntelligence: () => getAPI().financeGetSubscriptionIntelligence(),
  financeGetTransactions:  (p) => getAPI().financeGetTransactions(p),
  financeGetCategories:    ()  => getAPI().financeGetCategories(),
  getSleepTrends:          (p) => getAPI().getSleepTrends(p),
}

// ── WRITE endpoints (allowlist + optional confirmation) ──
export const WRITE_IPC: Record<string, IPCEntry> = {
  saveGoal: {
    handler: (p) => getAPI().saveGoal(p.date, p.goal),
    validate: hasFields('date', 'goal'),
  },
  saveGoalsBatch: {
    handler: (p) => getAPI().saveGoalsBatch(p.goals),
    validate: hasFields('goals'),
  },
  deleteGoal: {
    handler: (p) => getAPI().deleteGoal(p.id),
    validate: hasFields('id'),
    requiresConfirm: true,
  },
  saveGoalReview: {
    handler: (p) => getAPI().saveGoalReview(p.date, p.message),
    validate: hasFields('date', 'message'),
  },
  createReminder: {
    handler: (p) => getAPI().createReminder(p),
    validate: hasFields('text'),
  },
  toggleReminder: {
    handler: (p) => getAPI().toggleReminder(p.id, p.done),
    validate: hasFields('id', 'done'),
  },
  deleteReminder: {
    handler: (p) => getAPI().deleteReminder(p.id),
    validate: hasFields('id'),
    requiresConfirm: true,
  },
  'connectors.sync': {
    handler: (p) => getAPI().connectors.sync(p.id),
    validate: hasFields('id'),
  },
  'connectors.markRead': {
    handler: (p) => getAPI().connectors.markRead(p.itemId, p.read),
    validate: hasFields('itemId', 'read'),
  },
  saveAiProviders: {
    handler: (p) => getAPI().saveAiProviders(p),
    validate: hasFields('providers'),
  },
  aiChatSave: {
    handler: (p) => getAPI().aiChatSave(p),
    validate: hasFields('threadDate', 'messages'),
  },
  aiChatReset: {
    handler: (p) => getAPI().aiChatReset(p.threadDate),
    validate: hasFields('threadDate'),
    requiresConfirm: true,
  },
  aiChatRenameThread: {
    handler: (p) => getAPI().aiChatRenameThread(p.threadDate, p.title),
    validate: hasFields('threadDate', 'title'),
  },
  writePlanningMd: {
    handler: (p) => getAPI().writePlanningMd(p),
    validate: hasFields('content'),
  },
  suggestGoals: {
    handler: (p) => getAPI().suggestGoals(p.date, p.context),
    validate: hasFields('date'),
  },
  parseGoalDump: {
    handler: (p) => getAPI().parseGoalDump(p.text),
    validate: hasFields('text'),
  },
}

/**
 * Dispatch an IPC call through the allowlist.
 * READ endpoints always pass. WRITE endpoints check validation + confirmation.
 */
export function dispatchIPC(
  ipcName: string,
  payload: any,
  autoApprove: boolean = false
): Promise<any> {
  if (READ_IPC[ipcName]) {
    return READ_IPC[ipcName](payload)
  }

  const entry = WRITE_IPC[ipcName]
  if (!entry) {
    console.warn(`[IPC Block] "${ipcName}" not in allowlist`)
    return Promise.reject(new Error(`Action "${ipcName}" is not permitted`))
  }

  if (entry.validate && !entry.validate(payload)) {
    console.warn(`[IPC Block] "${ipcName}" failed validation`)
    return Promise.reject(new Error(`Invalid payload for "${ipcName}"`))
  }

  if (entry.requiresConfirm && !autoApprove) {
    return Promise.reject(new Error(`"${ipcName}" requires user confirmation`))
  }

  return entry.handler(payload)
}

export function isIPCAllowed(ipcName: string): boolean {
  if (!ipcName || ipcName === '__proto__' || ipcName === 'constructor' || ipcName === 'prototype') return false
  return ipcName in READ_IPC || ipcName in WRITE_IPC
}
