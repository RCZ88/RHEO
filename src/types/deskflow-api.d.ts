// Type definitions for window.deskflowAPI exposed by preload.ts via contextBridge

export interface DeskflowAPI {
  // Index signature allows any dynamically-accessed method from preload.ts
  [key: string]: any

  // ── Habit completions ──
  // Habits ARE goals (goals.is_habit = 1); completion history now lives in the
  // `habit_completions` table rather than a localStorage key, so it is backed
  // up, synced, and survives a profile reset.
  /** Habits in a date range. The handler has always existed in main; this
   *  exposure is what makes `api.getHabits?.()` stop resolving to undefined. */
  getHabits: (startDate: string, endDate: string) => Promise<any>
  /* ── the training log ──
   * `Promise<any>` on the read shapes is deliberate for now: the shared modules
   * (`src/shared/{captureParse,srs,weeklyScore,phaseRules,weeklyReview,planMode,
   * aiPlanSchema}.ts`) already return typed objects and the handlers pass them
   * through unchanged, so the types exist at the real boundary. Duplicating them
   * in this .d.ts would be a second, hand-typed copy of the same shapes — the
   * exact thing that lets a field get renamed in one place and silently keep
   * compiling in the other. They get declared properly when the training UI is
   * the only consumer. The ERROR shapes are typed, because the UI branches on
   * them and a typo there is a silent no-op. */
  onFocusCapture: (cb: () => void) => () => void
  trainingGetPrefs: () => Promise<{ minimumDayMinutes: number; weeklyWinDays: number }>
  trainingSetPrefs: (patch: { minimumDayMinutes?: number; weeklyWinDays?: number }) =>
    Promise<{ minimumDayMinutes: number; weeklyWinDays: number }>
  captureParse: (payload: { text: string; nowMinutes?: number; foreground?: { app?: string; category?: string } | null }) => Promise<{
    success: boolean; error?: string; canCommit: boolean;
    parsed?: import('../shared/captureParse').CaptureParse;
    foreground?: { app: string; category: string } | null;
  }>
  captureCommit: (payload: {
    date?: string; count?: number | null; minutes?: number | null; pattern?: string | null;
    result?: string | null; platform?: string; topic?: string; app?: string | null; category?: string | null;
  }) => Promise<{ success: boolean; error?: string; logId?: string | null; outcomeId?: string; cardId?: string | null }>
  trainingOutcomesList: (startDate: string, endDate: string) => Promise<{ success: boolean; error?: string; outcomes: any[] }>
  trainingCardsDue: (today?: string) => Promise<{ success: boolean; error?: string; today?: string; cards: any[]; total?: number }>
  trainingCardReview: (payload: { cardId: string; rating: 'recalled' | 'partial' | 'forgotten'; today?: string }) =>
    Promise<{ success: boolean; error?: string; due?: string | null; scheduledDays?: number; weakened?: boolean }>
  trainingWeekScore: (weekOf: string) => Promise<{ success: boolean; error?: string; score?: import('../shared/weeklyScore').WeeklyScore; copy?: any }>
  trainingReviewWeekly: (weekOf: string) => Promise<{ success: boolean; error?: string; cached?: boolean; review?: import('../shared/weeklyReview').WeeklyReview; accepted?: boolean }>
  trainingReviewAccept: (payload: { weekKey: string; text?: string }) => Promise<{ success: boolean; error?: string }>
  trainingPhaseCurrent: () => Promise<{
    success: boolean; error?: string; phase?: any; rules?: any; label?: string;
    summary?: string; driftQuestion?: any; cooldownDays?: number;
  }>
  trainingPhaseSetMode: (payload: { phaseId: string; mode: 'learn' | 'burn_down'; checklist?: unknown[] }) =>
    Promise<{ success: boolean; error?: string; mode?: string; checklist?: unknown[]; summary?: string }>
  trainingPhaseAnswerDrift: (payload: { answer: 'yes' | 'not_now' | 'no'; reason?: string }) =>
    Promise<{ success: boolean; error?: string; askAgainAfter?: string }>
  planModeStatus: (payload?: { coreIds?: string[]; doneIds?: string[] }) =>
    Promise<{ success: boolean; error?: string; verdict?: import('../shared/planMode').PlanVerdict; breaksThisWeek?: number; warning?: string | null }>
  planModeBreak: (payload: { phrase: string; outstanding?: number }) =>
    Promise<{ success: boolean; error?: string; breaksThisWeek?: number; warning?: string | null }>
  trainingPlanPrepare: (raw: string) => Promise<{
    success: boolean; error?: string; ok?: boolean; report?: import('../shared/aiPlanSchema').ValidationReport;
    diff?: string[]; repairPrompt?: string | null;
  }>
  trainingPlanPrompt: () => Promise<{ success: boolean; error?: string; prompt?: string }>
  trainingPlanCommit: (raw: string) => Promise<{ success: boolean; error?: string; applied?: { tasks: number; outcomes: number; moved: number }; issues?: any[] }>

  habitCompletionsList: (startDate: string, endDate: string) => Promise<any>
  /** Omit `done` (or set true) to record; pass `done: false` to clear. */
  habitCompletionsSet: (payload: {
    habitId: string; date: string; minutes?: number; done?: boolean; source?: string;
  }) => Promise<any>
  /** Weekly score: countedDays / winTarget / isWin. Monday-anchored. */
  habitCompletionsWeekly: (weekOf: string) => Promise<any>
  habitCompletionsMigrateLegacy: (legacy: Array<{
    commitmentId: string; date: string; completedAt?: number; source?: string;
  }>) => Promise<any>

  // ── Provider / AI Chat ──
  providerChatCall: (data: any) => Promise<any>
  providerChatBasic: (data: any) => Promise<any>
  onProviderChunk: (cb: (data: any) => void) => void
  aiChatLoad: (threadDate: string) => Promise<any>
  aiChatSave: (data: any) => Promise<any>
  aiChatReset: (threadDate: string) => Promise<any>
  aiChatRenameThread: (threadDate: string, title: string) => Promise<any>
  aiChatGetMemories: (threadDate: string) => Promise<any>
  aiChatExtractMemories: (data: any) => Promise<any>
  aiChatListThreads: () => Promise<any>
  aiChatSend: (data: any) => Promise<any>

  // ── Context Brain ──
  brainSearch: (query: string, strategies?: string[]) => Promise<any>
  brainGetEntity: (name: string) => Promise<any>
  brainGetEntityHistory: (name: string) => Promise<any>
  brainLogEpisode: (source: string, content: string, sourceRef?: string) => Promise<any>
  brainStats: () => Promise<any>
  brainExport: () => Promise<any>
  brainGetEpisodes: (opts?: any) => Promise<any>
  brainGetEntities: (opts?: any) => Promise<any>
  brainGetFacts: (opts?: any) => Promise<any>
  brainGetEntityRelated: (entityId: string) => Promise<any>
  brainGetJobs: () => Promise<any>
  brainRetryJob: (jobId: string) => Promise<any>
  brainCreateEpisode: (data: any) => Promise<any>
  brainMcpStatus: () => Promise<any>
  brainReindexEmbeddings: () => Promise<any>

  // ── Context Signals ──
  contextGetProfile: () => Promise<any>
  contextUpdateProfile: (patch: any) => Promise<any>
  contextAddSignal: (signalType: string, content: string, source: string, confidence?: number) => Promise<any>
  contextGetSignals: (signalType?: string, source?: string, limit?: number) => Promise<any>
  contextRebuild: () => Promise<any>
  contextGetGrowth: () => Promise<any>
  contextGetMemoryHighlights: () => Promise<any>
  contextGetDebug: () => Promise<any>
  contextRunNow: (kind: string) => Promise<any>

  // ── AI Context ──
  aiContextList: (opts?: any) => Promise<any>
  aiContextStats: () => Promise<any>
  aiContextDelete: (id: number) => Promise<any>
  aiContextClear: (provider?: string) => Promise<any>
  aiContextGetBrainLinks: (captureId: number) => Promise<any>
  aiContextTopics: () => Promise<any>
  aiContextUpdate: (id: number, metadata: any) => Promise<any>
  aiContextGroups: () => Promise<any>
  aiContextGroupCreate: (name: string, color?: string) => Promise<any>
  aiContextGroupRename: (id: number, name: string) => Promise<any>
  aiContextGroupDelete: (id: number) => Promise<any>

  // ── Memory ──
  memoryGetHot: (limit?: number) => Promise<any>
  memoryGetByTier: (tier: string, limit?: number) => Promise<any>
  memorySearch: (query: string) => Promise<any>
  memoryAdd: (content: string, category: string) => Promise<any>
  memoryDelete: (id: string) => Promise<any>
  memoryStats: () => Promise<any>
  memoryCompact: () => Promise<any>

  // ── Compositions ──
  compositionsList: () => Promise<any>
  compositionsGet: (id: string) => Promise<any>
  compositionsCreate: (data: any) => Promise<any>
  compositionsUpdate: (id: string, data: any) => Promise<any>
  compositionsDelete: (id: string) => Promise<any>
  compositionsCompile: (dslSource: string) => Promise<any>
  compositionsValidate: (dslSource: string, manifestId: string) => Promise<any>
  compositionsEvaluate: (ruleId: string, context?: any) => Promise<any>
  compositionsHistory: (ruleId?: string, limit?: number) => Promise<any>
  compositionsStatus: (ruleId?: string) => Promise<any>
  compositionsSettingsGet: (key: string) => Promise<any>
  compositionsSettingsSet: (key: string, value: string) => Promise<any>

  // ── Smart Search ──
  smartSearchIndex: (segments: any[]) => Promise<any>
  smartSearchUnindexPage: (pageId: string) => Promise<any>
  smartSearchQuery: (query: string, opts?: Record<string, any>) => Promise<any>
  smartSearchSuggest: (query: string, opts?: Record<string, any>) => Promise<any>
  smartSearchClear: () => Promise<any>
  smartSearchStats: () => Promise<any>

  // ── Tracking ──
  toggleTracking: () => Promise<any>
  setTracking: (enabled: boolean) => Promise<any>
  restartTracking: () => Promise<any>
  getTrackingMode: () => Promise<any>
  setTrackingMode: (mode: string) => Promise<any>

  // ── Stats / Dashboard ──
  getStats: () => Promise<any>
  getDailyStats: (period: string) => Promise<any>
  getDashboardData: (params: any) => Promise<any>
  getPageStats: (params: any) => Promise<any>
  getLogs: () => Promise<any>
  /** Cheap change probe for the logs table (count + MAX(id)). Lets the renderer
   *  skip the full ~10 MB getLogs() fetch when no row was added. */
  getLogsVersion: () => Promise<{ count: number; maxId: number }>
  clearData: () => Promise<any>
  clearToday: () => Promise<any>

  // ── Platform ──
  getPlatformInfo: () => Promise<any>
  getAvailableBrowsers: () => Promise<any>

  // ── AI Agent Paths ──
  getAIAgentCustomPaths: () => Promise<any>
  setAIAgentCustomPath: (pluginId: string, dirPath: string) => Promise<any>
  syncAIUsage: () => Promise<any>
  // Full re-read of every agent, ignoring per-path change tracking.
  forceSyncAIUsage: () => Promise<any>
  getAISyncStatus: () => Promise<any>
  clearAISyncState: () => Promise<any>
  // Display-only shift (minutes) applied when rendering AI timestamps.
  getAIDisplayTimezoneOffset: () => Promise<any>
  setAIDisplayTimezoneOffset: (offsetMinutes: number) => Promise<any>
  getAiProviders: () => Promise<any>
  saveAiProviders: (state: any) => Promise<any>
  testAiProvider: (providerId: string) => Promise<any>

  // ── AI Chat ──
  aiChatRenameThread: (threadDate: string, title: string) => Promise<any>

  // ── Preferences ──
  getPreferences: () => Promise<any>

  // ── App Logs ──
  getLogsByPeriod: (params: any) => Promise<any>
  updateAppLog: (id: number, data: any) => Promise<any>
  deleteAppLog: (id: number) => Promise<any>
  getAppStats: (request: any) => Promise<any>
  getDomainStats: (request: any) => Promise<any>
  getPeriodRankings: (request: any) => Promise<any>
  backfillAggregations: () => Promise<any>
  getDashboardAggregates: (request: any) => Promise<any>
  getDailyAggregates: () => Promise<any>
  getDailyProductivity: (date: string) => Promise<any>

  // ── Categories ──
  updateCategoriesFromOverrides: (appOverrides: any, domainOverrides: any) => Promise<any>

  // ── Browser ──
  setBrowserExcludedDomains: (domains: string[]) => Promise<any>
  getBrowserDomainStats: (period: string, dateOffset?: number) => Promise<any>

  // ── Resume ──
  getResumeSettings: () => Promise<any>
  saveAiSettings: (settings: any) => Promise<any>
  getAiSettings: () => Promise<any>
  testAiConnection: (settings: any) => Promise<any>

  // ── Speech-to-Text ──
  // These were entirely absent from this file, so every STT call in the app was
  // silently falling through the `[key: string]: any` index signature.
  sttGetStatus: () => Promise<{ engine: 'local' | 'api' | 'native' | 'browser'; apiConfigured: boolean; nativeAvailable: boolean; label: string; localAvailable: boolean; localPython: boolean; localVersion: string | null; localReason: string; localInstall: string }>
  sttTranscribeLocal: (payload: { audioBase64: string; mime?: string; lang?: string }) => Promise<{ ok: boolean; text?: string; engine?: string; model?: string; error?: string; install?: string; needsInstall?: boolean }>
  sttLocalAvailability: () => Promise<{ ok: boolean; python: boolean; version: string | null; reason: string; install: string }>
  sttTranscribe: (payload: { audioBase64: string; mime?: string; lang?: string }) => Promise<{ ok: boolean; text?: string; error?: string }>
  sttNativeStart: (lang?: string) => Promise<{ ok: boolean; error?: string }>
  sttNativeStop: () => Promise<{ ok: boolean }>
  onSttNativeEvent: (cb: (ev: { type: string; text?: string }) => void) => () => void

  sttTranscriptList: () => Promise<SttTranscriptRow[]>
  sttTranscriptSave: (entry: Omit<SttTranscriptRow, 'id'> & { id?: string }) => Promise<{ ok: boolean; id?: string }>
  sttTranscriptUpdate: (id: string, changes: Partial<SttTranscriptRow>) => Promise<{ ok: boolean }>
  sttTranscriptRemove: (id: string) => Promise<{ ok: boolean }>
  sttTranscriptToggleFavorite: (id: string) => Promise<{ ok: boolean }>

  // Floating dictation widget window

  sttLocalStatus: () => Promise<{ ok: boolean; config?: { model: string }; error?: string }>
  sttLocalStartRecording: () => Promise<{ ok: boolean; error?: string }>
  sttLocalStopRecording: () => Promise<{ ok: boolean; text?: string; error?: string }>
  sttGetRegisteredShortcut: () => Promise<{ shortcut: string }>
  sttRegisterShortcut: (shortcut: string) => Promise<{ ok: boolean; error?: string }>
  onSttShortcutTriggered: (cb: () => void) => () => void

  // ── App performance profiler ──
  // `perf:ping` is a no-op main-process handler. The renderer brackets it in a
  // monotonic clock, so both ends of the subtraction come from the same clock
  // family — see the handler in main.ts for why that matters.
  perfPing: () => Promise<PerfPingResult>
  /** Host CPU / memory / GPU. Main-process numbers, not renderer. */
  consoleMetrics: () => Promise<{ success: boolean; data: HostMetrics }>
  getResourceStats: () => Promise<any>
  getSystemStats: () => Promise<any>
  onResourceStats: (
    cb: (stats: Record<string, {
      pid: number | null
      alive: boolean
      memMB: number
      cpuPct: number
      eventLoopLagMs: number
      ts: number
    }>) => void,
  ) => () => void
}

/** Row shape returned by `stt:transcript-list` (main.ts maps SQLite columns). */
export interface SttTranscriptRow {
  id: string
  text: string
  title: string
  note: string
  prompt: string
  project: string
  createdAt: string
  durationMs: number
  category: string
  tags: string[]
  projectId?: string | null
  projectName?: string | null
  isFavorite: boolean
  source?: string | null
}

export interface SttPanelState {
  open: boolean
  pinned: boolean
}

declare global {
  interface Window {
    deskflowAPI?: DeskflowAPI

    /**
     * Halo Island bridge. A SEPARATE global from `deskflowAPI` on purpose: the
     * island is a different window that must never see the ~972-key application
     * surface, so it gets four verbs and nothing else. Every payload is validated
     * in the main process before it is acted on.
     *
     * Replaced the removed `sttPanel*` keys — the standalone dictation panel was
     * deleted when the island took over dictation.
     */
    haloBridge?: HaloBridge
  }
}

export interface HaloIntent {
  inside: boolean
  pinned: boolean
}

export interface HaloSnapshotPayload {
  stopwatch: unknown | null
  currentApp: unknown | null
  dictation: unknown | null
}

export interface HaloBridge {
  getSnapshot?: () => Promise<unknown>
  open?: () => Promise<unknown>
  close?: () => Promise<unknown>
  setPinned?: (pinned: boolean) => Promise<unknown>
  /**
   * Push the stored preferences to the LIVE island window and reconcile its position.
   * Returns the preferences the island actually adopted (normalised), or an error object
   * when no island window exists.
   *
   * This exists because `halo:prefs` used to be sent only on `did-finish-load`, so the
   * renderer never saw a preference change without a relaunch. Settings must call this
   * after every `setPreference(HALO_PREFS_KEY, …)` or the control will be decorative.
   */
  applyPrefs?: () => Promise<unknown>
  /** Displays for the monitor picker: `{ id, label, bounds, scaleFactor, primary }[]`. */
  listDisplays?: () => Promise<unknown>
  /**
   * HALO §51 "click outside -> unpin + collapse". Fired by the island's document-level
   * pointer listener, so it only ever fires for clicks that missed the island. This is what
   * keeps a pinned island from holding a click region over the user's desktop.
   */
  clickOutside?: () => Promise<unknown>
  onPrefs?: (cb: (prefs: unknown) => void) => () => void
  onCommand?: (cb: (cmd: { command: string }) => void) => () => void
  onHover?: (cb: (intent: HaloIntent) => void) => () => void
  onSnapshot?: (cb: (snapshot: HaloSnapshotPayload) => void) => () => void
  /** The size main actually gave the window, after `fitToCanvas` clamped the preset to the
   *  available space. `squeeze` is how far it was clamped (1 = untouched) and `tight` marks a
   *  box too small for the full layout. The renderer needs these because it lays itself out
   *  from the preset alone — without them it overflows a window main already shrank. */
  onGeometry?: (
    cb: (g: {
      expanded: { width: number; height: number }
      compact: { width: number; height: number }
      squeeze: number
      tight: boolean
    }) => void,
  ) => () => void
  /** Halo widget producers. `null` fields mean UNKNOWN, never zero — see halo-slot.probe. */
  /** Report the renderer-owned streams (stopwatch, dictation) up to main, which cannot
   *  compute them, and republishes them to the island. Collapses the island's private
   *  second stopwatch copy into ONE shared clock. */
  reportStream?: (payload: { stopwatch?: unknown; dictation?: unknown }) => void
  /** Navigate the MAIN app window to a route. The island has no router of its own,
   *  so a card's route has to be pushed to the app window. */
  navigate?: (route: string) => void
  getAiUsage?: () => Promise<{ tokensToday: number | null; sessionCount: number | null; topModel: string | null; error?: string }>
  /** `ok:false` = could not read the table (unknown). `ok:true, count:0` = measured zero. */
  getNextDeadline?: () => Promise<{
    ok: boolean
    count: number | null
    title: string | null
    dueAtMs: number | null
    deltaMs: number | null
    isOverdue: boolean | null
    error?: string
  }>
  getTerminalUsage?: () => Promise<{ activeSessions: number | null; commandsToday: number | null; handbookPercent: number | null; error?: string }>
}

export {}

// ── Additional types imported by other modules ──
export interface GitSafetySettings {
  enabled: boolean
  level: 'read' | 'confirm' | 'admin'
  blockedPatterns: string[]
}
export interface GitSafetyCheckResult {
  safe: boolean
  blocked: boolean
  reason?: string
}
export interface ManualAssignment {
  id: string
  source: string
  target: string
  field: string
}
export interface ProjectBackupDiff {
  path: string
  status: 'added' | 'modified' | 'deleted'
  oldContent?: string
  newContent?: string
}
export interface ProjectBackupManifest {
  version: string
  date: string
  files: string[]
}
export interface ScoringSchemeInfo {
  id: string
  name: string
  weights: Record<string, number>
}
export interface FrameScoreBreakdown {
  frameId: string
  score: number
  details: Record<string, number>
}
export interface AnalyticsCandidate {
  id: string
  title: string
  score: number
  category: string
}
export interface CalibrationReport {
  id: string
  tool: string
  score: number
  details: Record<string, any>
}
export interface ProcessGalleryItem {
  id: string
  name: string
  description: string
  steps: ProcessStep[]
}
export interface ProcessStep {
  id: string
  label: string
  type: string
}
export interface ProcessEvent {
  id: string
  stepId: string
  timestamp: number
  data: any
}
export interface ScriptFrame {
  id: string
  type: string
  content: string
  timestamp: number
}
export interface ContentEpisode {
  id: string
  title: string
  content: string
  metadata: Record<string, any>
}
export interface VideoReflection {
  id: string
  title: string
  segments: ReflectionSegment[]
}
export interface ReflectionSegment {
  id: string
  start: number
  end: number
  summary: string
}
export interface ReflectionAnalysis {
  episodeId: string
  insights: string[]
  score: number
}
export interface ContentEngineConfig {
  id: string
  name: string
  settings: Record<string, any>
}
export interface ContentEngineJob {
  id: string
  configId: string
  status: string
  progress: number
}
export interface ContentEngineStep {
  id: string
  jobId: string
  type: string
  status: string
}
export interface ToolExecutionParams {
  toolName: string
  params: Record<string, any>
}
export interface ChatMessage {
  id: string
  role: string
  content: string
  parsed?: any
  timestamp: number
}
export interface ChatMessageParsed {
  type: string
  content: string
  nodes: any[]
  refs: any[]
}
export interface ChatMessageRef {
  type: string
  label: string
  target: string
}
export interface ChatSuggestion {
  id: string
  text: string
  category: string
}
export interface AIBackendConfig {
  id: string
  provider: string
  model: string
  apiKey: string
}
export interface AISettings {
  provider: string
  model: string
  temperature: number
  maxTokens: number
}
export interface KnowledgeGraphConfig {
  id: string
  name: string
  type: string
}
export interface KnowledgeEntry {
  id: string
  content: string
  category: string
  createdAt: number
}
export interface KnowledgeEntryRef {
  entryId: string
  relation: string
}
export interface KnowledgeGraphEdge {
  source: string
  target: string
  relation: string
}
export interface LlmProvider {
  id: string
  name: string
  models: string[]
}

/**
 * Host resource sample returned by the `console:metrics` handler in main.ts.
 * Declared here because the Penguin Console's MetricsPanel and the profiler
 * both consume it and both were casting `(window as any).deskflowAPI` to get at
 * it — the index signature above makes an undeclared method typecheck, which is
 * exactly why the omission went unnoticed.
 */
export interface HostMetrics {
  cpuPct: number | null
  cpuCount: number
  cpuModel: string
  loadAvg: number[]
  memTotalMB: number
  memUsedMB: number
  memPct: number
  /** MAIN-process RSS. Distinct from the renderer heap in `performance.memory`. */
  appRssMB: number
  /** MAIN-process V8 heap. Distinct from the renderer heap. */
  appHeapMB: number
  uptimeH: number
  gpu: {
    available: boolean
    name: string
    utilPct: number | null
    memUsedMB: number | null
    memTotalMB: number | null
  }
}

/** Result of the profiler's no-op round-trip probe. */
export interface PerfPingResult {
  ok: boolean
  /** `performance.now()` sampled in the MAIN process. Monotonic, not epoch. */
  t: number
}
export interface LlmProviderConfig {
  id: string
  provider: LlmProvider
  apiKey: string
  model: string
}

