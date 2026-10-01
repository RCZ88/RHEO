// Type definitions for window.deskflowAPI exposed by preload.ts via contextBridge

export interface DeskflowAPI {
  // Index signature allows any dynamically-accessed method from preload.ts
  [key: string]: any

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
}

declare global {
  interface Window {
    deskflowAPI?: DeskflowAPI
  }
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
export interface LlmProviderConfig {
  id: string
  provider: LlmProvider
  apiKey: string
  model: string
}

