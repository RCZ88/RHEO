interface ProjectBackupManifest {
  id: string;
  projectId: string;
  label: string;
  timestamp: string;
  fileCount: number;
  totalSize: number;
  compressionRatio: number;
  autoBackup: boolean;
  trigger?: string;
}

interface ProjectBackupDiff {
  added: string[];
  deleted: string[];
  modified: string[];
  unchanged: string[];
  totalChanged: number;
}

interface BackupManifest {
  createdAt: string;
  trigger: 'startup' | 'interval' | 'quit' | 'manual' | 'pre-restore' | 'agent-session';
  dbPath: string;
  backupFile: string;
  bytes: number;
  sha256: string;
  rowCounts: Record<string, number>;
  totalRows: number;
  integrityOk: boolean;
}

interface BackupSettings {
  mirrorDir: string;
  retention: { hourly: number; daily: number; weekly: number; monthly: number };
  autoBackup: boolean;
}

interface BackupStatus {
  settings: BackupSettings;
  backupDir: string;
  dbPath: string;
  lastBackup: BackupManifest | null;
  backupCount: number;
  totalBytes: number;
  schedulerRunning: boolean;
  intervalMs: number;
  triggers: string[];
}

interface DeskflowAPI {
  onForegroundChange: (cb: (data: any) => void) => () => void;
  onTrackingHeartbeat: (cb: (data: any) => void) => () => void;
  onBrowserTrackingEvent: (cb: (data: any) => void) => () => void;
  onTrackerMindInitProgress: (cb: (data: any) => void) => () => void;
  onRecapProgress: (cb: (data: { month: string; stage: 'reading' | 'analyzing' | 'writing' | 'saving' | 'done' }) => void) => () => void;
  getLogs: () => Promise<any[]>;
  getLogsByPeriod: (params: { period: 'today' | 'week' | 'month' | 'all'; dateOffset?: number }) => Promise<any[]>;
  getDashboardData: (params: { period: string; dateOffset?: number }) => Promise<{ success: boolean; data?: any; error?: string }>;
  getPageStats: (params: { page: string; period: string; dateOffset?: number }) => Promise<{ success: boolean; data?: any; error?: string }>;
  getRankings: (params: { period: string; dateOffset?: number }) => Promise<{
    success: boolean;
    data?: {
      apps: { name: string; category: string; totalSeconds: number; sessions: number; tier: string; percentage: number }[];
      websites: { name: string; category: string; totalSeconds: number; sessions: number; tier: string; percentage: number }[];
      aiTools: { name: string; totalTokens: number; totalCost: number; sessions: number; messages: number; lastUsed: string; costPer1kTokens: number }[];
      totals: { appSeconds: number; websiteSeconds: number };
      period: string;
      dateRange: { start: string; end: string };
    };
    error?: string;
  }>;
  getPeriodRankings: (params: { period: string; dateOffset?: number; granularity: string; metric: string }) => Promise<{
    success: boolean;
    data?: {
      periods: {
        key: string; label: string; start: string; end: string; days: number; rank: number;
        productivityScore: number; prodPct: number; distPct: number;
        prodSec: number; neutSec: number; distSec: number; totalSec: number; sessions: number;
        focusCount: number; focusCompleted: number; focusFailed: number; focusSec: number; focusRate: number;
        goalsDone: number; goalsAll: number; goalRate: number;
        extTotal: number; extActivities: Record<string, number>; extTypes: Record<string, number>;
        sleepSec: number; sleepSessions: number; sleepAvgMin: number; sleepDeficitMin: number;
        groupUsage: Record<string, { sessions: number; sec: number }>;
      }[];
      summary: {
        avgScore: number; bestPeriod: any; worstPeriod: any;
        totalProductiveSec: number; totalSec: number; totalFocusSec: number;
        totalGoalsDone: number; totalSleepMin: number;
        periodCount: number; granularity: string; metric: string;
        currentStreak: number; longestStreak: number;
      };
    };
    error?: string;
  }>;
  backfillAggregations: () => Promise<{ success: boolean; message?: string }>;
  getStats: () => Promise<any[]>;
  getAppStats: (period?: 'today' | 'week' | 'month' | 'all') => Promise<any[]>;
  getDailyStats: (period: 'week' | 'month' | 'all') => Promise<any>;
  toggleTracking: () => Promise<boolean>;
  setTracking: (enabled: boolean) => Promise<boolean>;
  clearData: () => Promise<boolean>;
  clearToday: () => Promise<boolean>;
  getDbPath: () => Promise<string>;
  getStorageStatus: () => Promise<{
    type: 'sqlite' | 'json' | 'none';
    working: boolean;
    path: string;
    error?: string;
    logCount: number;
  }>;
  getPreferences: () => Promise<Record<string, any>>;
  setPreference: (key: string, value: any) => Promise<boolean>;
  sttGetStatus: () => Promise<{ engine: 'api' | 'native' | 'browser'; apiConfigured: boolean; nativeAvailable: boolean; label: string }>;
  sttTranscribe: (payload: { audioBase64: string; mime?: string; lang?: string }) => Promise<{ ok: boolean; text?: string; error?: string }>;
  sttNativeStart: (lang?: string) => Promise<{ ok: boolean; error?: string }>;
  sttNativeStop: () => Promise<{ ok: boolean }>;
  onSttNativeEvent: (callback: (ev: { type: string; text?: string }) => void) => () => void;
  getBrowserLogs: () => Promise<any[]>;
  getBrowserDomainStats: () => Promise<any[]>;
  getAllBrowserDomainStats: () => Promise<any[]>;
  getBrowserCategoryStats: () => Promise<any[]>;
  setBrowserTracking: (enabled: boolean) => Promise<boolean>;
  getBrowserTrackingStatus: () => Promise<{
    enabled: boolean;
    serverRunning: boolean;
    port: number;
    excludedDomains: string[];
  }>;
  setBrowserExcludedDomains: (domains: string[]) => Promise<boolean>;
  setRecordingMode: (type: 'browser' | 'app', mode: 'always' | 'on-view') => Promise<boolean>;
  getRecordingModes: () => Promise<{
    browser: string;
    app: string;
    browserPageVisible: boolean;
    dashboardPageVisible: boolean;
  }>;
  setPageVisibility: (page: 'browser' | 'dashboard', visible: boolean) => Promise<boolean>;
  getDailyProductivity: (date: string) => Promise<any>;
  getProductivityRange: (startDate: string, endDate: string) => Promise<any[]>;
  saveProductivitySession: (session: any) => Promise<any>;
  getProductivitySessions: (opts?: any) => Promise<any>;
  clearProductivitySessions: () => Promise<void>;
  getLongestFocus: () => Promise<{ today: any[]; week: any[]; allTime: any[] }>;
  getCurrentForeground: () => Promise<any>;
  cleanCorruptedData: () => Promise<{ success: boolean; deletedCount: number; error?: string }>;
  deepCleanAndRebuild: () => Promise<{ success: boolean; logsCleared?: number; aggregatesCleared?: number; message?: string }>;
  migrateToAggregates: () => Promise<{ success: boolean; aggregatesUpdated?: number; browserAggregatesUpdated?: number; message?: string }>;
  getDailyAggregates: () => Promise<any[]>;
  getBrowserSessions: () => Promise<any[]>;
  getSessions: () => Promise<any[]>;
  getTableSchema: (tableName: string) => Promise<any>;
  getDatabaseTables: () => Promise<{ tables: string[]; type: string; error?: string }>;
  getTableData: (tableName: string, limit?: number, offset?: number) => Promise<any[] | { error: string }>;
  getTableDataCount: (tableName: string) => Promise<{ total: number; error?: string }>;
  getTableChanges: (tableName: string, limit?: number) => Promise<{ changes: any[]; error?: string }>;
  updateCategoriesFromOverrides: (appOverrides: Record<string, string>, domainOverrides: Record<string, string>) => Promise<{ success: boolean; updatedCount: number; error?: string }>;
  previewCategoriesFromOverrides: (appOverrides: Record<string, string>, domainOverrides: Record<string, string>) => Promise<{ success: boolean; preview: boolean; totalMismatch: number; mismatches: { kind: 'app' | 'domain'; key: string; current: string | null; next: string; count: number }[]; byCategory: Record<string, number>; error?: string }>;
  saveFile: (options: { content: string; filename: string; fileType: string }) => Promise<{ success: boolean; path?: string; message?: string }>;
  pickFolder: () => Promise<{ success: boolean; path: string | null }>;
  scanCustomDirectory: (rootDir: string) => Promise<{ success: boolean; projects: any[] }>;
  getCustomScanDirs: () => Promise<string[]>;
  saveCustomScanDirs: (dirs: string[]) => Promise<{ success: boolean }>;
  detectIDEs: () => Promise<any[]>;
  getIDEs: () => Promise<any[]>;
  getExtensions: (ideId?: string) => Promise<any[]>;
  scanTools: () => Promise<any[]>;
  getTools: (category?: string) => Promise<any[]>;
  getToolCategories: () => Promise<{ category: string }[]>;
  agentSend: (terminalId: string, data: string, agentType?: string) => Promise<{
    success: boolean;
    queued?: boolean;
    written?: boolean;
    verified?: boolean;
    error?: string;
  }>;
  resetTools: () => Promise<{ success: boolean; message: string }>;
  addProject: (data: { name: string; path: string; repositoryUrl?: string; vcsType?: string; primaryLanguage?: string; defaultIde?: string }) => Promise<{ success: boolean; id?: string; name?: string; message?: string }>;
  getProjects: () => Promise<any[]>;
  getProjectTools: (projectId: string) => Promise<any[]>;
  removeProject: (projectId: string) => Promise<{ success: boolean }>;
  openProject: (projectId: string, ideId?: string) => Promise<{ success: boolean; ide?: string; message?: string }>;
  getAIUsageSummary: (period?: string, dateOffset?: number, projectId?: string) => Promise<any>;
  getAIUsageDetails: (period?: string, dateOffset?: number) => Promise<{ languageDistribution: Record<string, { count: number; tokens: number }>; avgResponseTime: number; responseTimeByDay: Record<string, number> }>;
  getCommitStats: (projectId?: string, period?: string) => Promise<any>;
  getIDEProjectsOverview: (period?: string, dateOffset?: number) => Promise<any>;
  getCodeChangeStats: (period?: string, dateOffset?: number, projectId?: string) => Promise<any>;
  getCodeActivityStats: (period?: string, dateOffset?: number, projectId?: string) => Promise<any>;
  scanIdeDefaultProjects: () => Promise<{ ide: string; projects: { name: string; path: string }[] }[]>;
  detectProjectScripts: (projectPath: string) => Promise<any>;
  getProjectRunConfig: (projectId: string) => Promise<any>;
  saveProjectRunConfig: (projectId: string, config: any) => Promise<any>;
  getAllRunConfigs: () => Promise<{ success: boolean; configs?: Array<{ projectId: string; name: string; path: string; config: any }>; message?: string }>;
  runProject: (projectId: string, config: any) => Promise<any>;
  executeProjectCommand: (terminalId: string, command: string) => Promise<any>;
  stopProject: (terminalId: string) => Promise<any>;
  getRunningProjects: () => Promise<any>;
  openUrl: (url: string) => Promise<any>;
  syncAIUsage: () => Promise<{ success: boolean; [key: string]: number | boolean | string }>;
  onAISyncProgress: (callback: (data: any) => void) => () => void;
  debugAIAgents: () => Promise<Record<string, { detected: boolean; paths: string[] }>>;
  // Word Tracker
  wordTrackerGetWords: () => Promise<Array<{ id: number; word: string; label: string; color: string; enabled: number; tolerance: string; created_at: string }>>;
  wordTrackerAddWord: (word: string, label?: string, color?: string, tolerance?: string) => Promise<{ success: boolean; id?: number; message?: string }>;
  wordTrackerRemoveWord: (wordId: number) => Promise<{ success: boolean; message?: string }>;
  wordTrackerToggleWord: (wordId: number, enabled: boolean) => Promise<{ success: boolean }>;
  wordTrackerSetTolerance: (wordId: number, tolerance: string) => Promise<{ success: boolean }>;
  wordTrackerEditWord: (wordId: number, updates: { word?: string; label?: string; color?: string; tolerance?: string }) => Promise<{ success: boolean; message?: string }>;
  wordTrackerCounts: (projectId?: string) => Promise<Array<{ id: number; word_id: number; project_id: string | null; count: number; last_scanned_at: string | null; word: string; label: string; color: string }>>;
  wordTrackerCountsByProject: (wordId: number) => Promise<Array<{ id: number; word_id: number; project_id: string | null; count: number; last_scanned_at: string | null; project_name: string | null }>>;
  wordTrackerGetConfig: (key: string) => Promise<string | null>;
  wordTrackerSetConfig: (key: string, value: string) => Promise<{ success: boolean; message?: string }>;
  wordTrackerResetCounts: () => Promise<{ success: boolean; message?: string }>;
  wordTrackerScanJsonl: (projectId?: string) => Promise<{ success: boolean; scanned: number; counts: Record<string, number>; message?: string }>;
  wordTrackerCountText: (text: string, projectId?: string) => Promise<{ success: boolean; counts: Record<string, number>; message?: string }>;
  getUserTimezone: () => Promise<string>;
  syncCommits: (projectId: string, repoPath?: string) => Promise<{ success: boolean; count: number }>;
  syncGitHubCommits: (projectId: string, owner: string, repo: string, token?: string) => Promise<{ success: boolean; count: number }>;
  getDORAMetrics: (projectId: string, period?: 'week' | 'month') => Promise<any>;
  getCommitHistory: (projectId: string, limit?: number) => Promise<any[]>;
  getContributorStats: (projectId: string) => Promise<any>;
  createTerminalWindow: () => Promise<boolean>;
  spawnTerminal: (terminalId: string, cwd?: string, agentType?: string, cols?: number, rows?: number) => Promise<boolean>;
  writeTerminal: (terminalId: string, data: string) => Promise<boolean>;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<boolean>;
  killTerminal: (terminalId: string) => Promise<boolean>;
  onTerminalData: (callback: (data: { terminalId: string; data: string }) => void) => void;
  onTerminalExit: (callback: (data: { terminalId: string; exitCode: number; signal: number }) => void) => void;
  getTerminalPresets: (projectId?: string) => Promise<any[]>;
  addTerminalPreset: (preset: { projectId?: string; name: string; command: string; workingDirectory?: string; category?: string }) => Promise<{ success: boolean; id?: string; message?: string }>;
  removeTerminalPreset: (presetId: string) => Promise<{ success: boolean; message?: string }>;
  executeTerminalPreset: (presetId: string, terminalId?: string) => Promise<{ success: boolean; command?: string; terminalId?: string; message?: string }>;
  saveTerminalLayout: (layout: { id?: string; name: string; layoutData: string; isActive?: boolean }) => Promise<{ success: boolean; id?: string; message?: string }>;
  getTerminalLayouts: (projectId?: string) => Promise<any[]>;
  deleteTerminalLayout: (layoutId: string) => Promise<{ success: boolean; message?: string }>;
  setActiveTerminalLayout: (layoutId: string) => Promise<{ success: boolean; message?: string }>;
  saveTerminalSession: (session: { projectId?: string; agent: string; resumeId?: string; topic?: string; workingDirectory?: string; totalTokens?: number; totalCost?: number; category?: string; status?: string; productArea?: string; description?: string; autoTags?: string[]; categoryConfirmed?: boolean }) => Promise<{ success: boolean; id?: string }>;
  getTerminalSessions: (projectId?: string, limit?: number) => Promise<any[]>;
  getTerminalSessionResumeId: (sessionId: string) => Promise<string | null>;
  deleteTerminalSession: (sessionId: string) => Promise<{ success: boolean }>;
  getSessionMessages: (sessionId: string, agentType?: string) => Promise<{ success: boolean; data: any[] }>;
  saveTerminalMessage: (data: { sessionId: string; role: string; content: string }) => Promise<{ success: boolean; id?: any }>;
  getPromptHistory: (opts?: { projectId?: string; limit?: number }) => Promise<{ success: boolean; data: any[]; error?: string }>;
  deleteTerminalMessage: (id: number) => Promise<{ success: boolean; error?: string }>;
  getPromptStatus: () => Promise<{ success: boolean; data: any[] }>;
  aiTaskAdd: (data: { terminalId: string; prompt: string; agent: string; sessionId: string; projectPath: string }) => void;
  aiTaskWatch: (projectPath: string) => Promise<any>;
  aiTaskStopWatch: (projectPath: string) => Promise<any>;
  onAiTaskUpdated: (callback: (data: any) => void) => () => void;
  onAiTaskFileChanged: (callback: (data: any) => void) => () => void;
  updateSessionCategory: (data: { sessionId: string; category?: string; productArea?: string; description?: string; status?: string; tags?: string[]; categoryConfirmed?: boolean }) => Promise<{ success: boolean }>;
  getParsedSessionItems: (sessionId: string) => Promise<{ success: boolean; data: any[] }>;
  analyzeSessionCategory: (sessionId: string) => Promise<{ success: boolean; category: string; confidence: number; tags: string[]; productArea: string }>;
  saveSessionConfig: (sessionId: string, config: any, projectPath?: string) => Promise<{ success: boolean; error?: string }>;
  loadSessionConfig: (sessionId: string, projectPath?: string) => Promise<{ success: boolean; data: any; error?: string }>;
  listInitFiles: (projectPath?: string) => Promise<{ success: boolean; data: string[] }>;
  resolveAtMention: (data: { input: string; terminalTabs: Array<{ id: string; name: string }> }) => Promise<{ terminalId: string | null; message: string; resolved: boolean }>;
  getAISyncStatus: () => Promise<{ lastRunAt: string | null; agentLastRun: Record<string, string>; paths: Record<string, any> }>;
  calculateProjectHealth: (projectId: string) => Promise<{ healthScore: number; activityLevel: string; aiSessions: number; commits: number }>;
  getProjectDetails: (projectId: string) => Promise<{ project: any; tools: any[]; sessions: any[]; health: any; presets: any[]; aiUsage: any }>;
  getModelImprovementStats: (opts?: { terminalId?: string }) => Promise<{ messageCounts: Record<string, number>; reinjectionCount: number; threshold: number; actionsAttempted: number; actionsFailed: number } | null>;
  setReinjectThreshold: (payload: { threshold: number }) => Promise<{ success: boolean; error?: string }>;
  setModelDebug: (payload: { enabled: boolean }) => Promise<{ success: boolean; error?: string }>;
  readActionsErrorLog: () => Promise<{ entries: string[]; exists: boolean }>;
  routePrompt: (request: { prompt: string; projectPath?: string }) => Promise<{ action: string; sessionId?: string; sessionName?: string; terminalId?: string; confidence?: number; suggestedName?: string; suggestedSummary?: string; reason?: string }>;
  aiDebugLog: (ev: { source?: string; event: string; feature?: string; provider?: string; model?: string; contextId?: string; role?: string; payload?: unknown; tokensIn?: number; tokensOut?: number }) => Promise<{ ok: boolean }>;
  aiDebugQuery: (opts: { sources?: string[]; events?: string[]; search?: string; fromMs?: number; toMs?: number; limit?: number; offset?: number }) => Promise<{ events: Array<{ id: number; ts: string; epochMs: number; source: string; event: string; feature?: string; provider?: string; model?: string; contextId?: string; role?: string; tokensIn: number; tokensOut: number; payload?: string }>; total: number; error?: string }>;
  aiDebugStats: () => Promise<{ total: number; bySource: Record<string, number>; byEvent: Record<string, number>; oldestMs: number | null; newestMs: number | null; capturePoints: Array<{ source: string; where: string; captures: string }>; error?: string }>;
  aiDebugExport: (opts: { sources?: string[]; events?: string[]; search?: string; fromMs?: number; toMs?: number; limit?: number }) => Promise<{ markdown: string; count: number; total: number; error?: string }>;
  aiDebugClear: (opts: { sources?: string[]; events?: string[]; olderThanMs?: number }) => Promise<{ deleted: number; error?: string }>;

  // AI Context Captures (external AI conversations from browser extension)
  aiContextList: (opts?: { provider?: string; search?: string; limit?: number; offset?: number }) => Promise<{ captures: Array<{ id: number; provider: string; messages: Array<{ role: string; content: string }>; url?: string; title?: string; source?: string; timestamp?: string; dedup_key?: string; captured_at: number }>; total: number }>;
  aiContextStats: () => Promise<{ total: number; byProvider: Record<string, number>; newestMs: number | null; capturesByDay: Array<{ day: string; count: number }> }>;
  aiContextDelete: (id: number) => Promise<{ ok: boolean; error?: string }>;
  aiContextClear: (provider?: string) => Promise<{ ok: boolean; error?: string }>;
  onAiContextCaptured: (cb: (data: { count: number }) => void) => void;
  aiContextGetBrainLinks: (captureId: number) => Promise<{ episodes: Array<any>; entities: Array<any>; facts: Array<any>; signals: Array<any> }>;
  aiContextTopics: () => Promise<{ topics: Array<any> }>;
  aiContextUpdate: (id: number, metadata: { nickname?: string; note?: string; tags?: string[]; group_id?: number | null; pinned?: boolean }) => Promise<{ ok: boolean }>;
  aiContextGroups: () => Promise<{ groups: Array<{ id: number; name: string; color: string; created_at: number }> }>;
  aiContextGroupCreate: (name: string, color?: string) => Promise<{ ok: boolean; id: number }>;
  aiContextGroupRename: (id: number, name: string) => Promise<{ ok: boolean }>;
  aiContextGroupDelete: (id: number) => Promise<{ ok: boolean }>;
  extensionQueueCommand: (cmd: any) => Promise<{ ok: boolean }>;

  updateSessionSummary: (request: { sessionId: string; force?: boolean }) => Promise<{ success: boolean; skipped?: boolean; summary?: string; topic?: string; autoNamed?: boolean; reason?: string; error?: string }>;
  getRoutingCosts: () => Promise<{ today: any; week: any; month: any; total: any; byType: any[] }>;
  resetRoutingCosts: () => Promise<{ success: boolean }>;
  getAutoAssignConfig: () => Promise<any>;
  saveAutoAssignConfig: (config: any) => Promise<{ success: boolean }>;
  lockFile: (filePath: string, terminalId: string, sessionId?: string | null, action?: string) => Promise<{ acquired: boolean; heldBy?: string }>;
  releaseFileLock: (filePath: string, terminalId: string) => Promise<{ success: boolean }>;
  preAcquireFileLock: (data: { filePath: string; terminalId: string; sessionId?: string; timeoutMs?: number }) => Promise<{ acquired: boolean; heldBy?: string; heldSince?: number; ttlMs?: number; message?: string; stashRef?: string | null }>;
  releasePreLock: (data: { filePath: string; terminalId: string }) => Promise<{ success: boolean }>;
  gitSnapshotBeforeEdit: (filePath: string, terminalId: string) => Promise<string | null>;
  gitRestoreOnCorrupt: (filePath: string, stashRef: string) => Promise<boolean>;
  getFileLocks: () => Promise<Array<{ filePath: string; terminalId: string; sessionId: string | null; timestamp: number; action: string }>>;
  getLocksForTerminal: (terminalId: string) => Promise<Array<{ filePath: string; terminalId: string; sessionId: string | null; timestamp: number; action: string }>>;
  getTouchedFiles: (opts?: { terminalId?: string; filePath?: string; limit?: number }) => Promise<{ success: boolean; data: any[]; error?: string }>;
  compileSyncSummary: (terminalId: string) => Promise<{ success: boolean; summary: string; error?: string }>;
  broadcastContextDelta: (data: { terminalId: string; type: string; payload: any }) => Promise<{ success: boolean; sentCount: number }>;
  onFileConflict: (callback: (data: { filePath: string; requestingTerminal: string; lockingTerminal: string; sessionId: string | null; timestamp: number }) => void) => () => void;
  getCrossSessionSyncConfig: () => Promise<{ enabled: boolean; lockTTL: number; contextBroadcast: boolean; conflictWarningMode: string; syncCommand: boolean }>;
  setCrossSessionSyncConfig: (config: any) => Promise<{ success: boolean }>;
  executeCommand: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; error?: string }>;
  getTopicDigest: () => Promise<{ success: boolean; topics?: any[]; error?: string }>;
  saveAiConfig: (config: any) => Promise<{ success: boolean }>;
  getAiConfig: () => Promise<any>;
  getAiProviders: () => Promise<any>;
  saveAiProviders: (state: any) => Promise<{ success: boolean }>;
  testAiProvider: (providerId: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  getInterestTopics: () => Promise<string[]>;
  addInterestTopic: (topic: string) => Promise<{ success: boolean }>;
  removeInterestTopic: (topic: string) => Promise<{ success: boolean }>;
  // Knowledge Base (R5: self-contained context/RAG — deskflow-kb.json + BM25)
  kbIngest: (file: { name: string; type: string; content: string }) => Promise<{ success: boolean; docId?: string; chunkCount?: number; error?: string }>;
  kbQuery: (query: string, limit?: number) => Promise<Array<{ id: string; docId: string; docName: string; content: string }>>;
  kbList: () => Promise<Array<{ id: string; name: string; type: string; addedAt: number }>>;
  kbRemove: (docId: string) => Promise<{ success: boolean; error?: string }>;
  // Feature Studio: AI Director pipeline
  featureStudioCompile: (script: string) => Promise<{ success: boolean; content?: string; providerId?: string; error?: string }>;

  // Content Engine: ideas/themes/scripts/gates/seo/analytics/lessons/frameworks
  contentEngine?: ContentEngineApi;
  readPlanningMd: () => Promise<{ content: string; error?: string }>;
  writePlanningMd: (content: string) => Promise<{ success: boolean; error?: string }>;
  writeFeatureSpecFile: (content: string) => Promise<{ success: boolean; error?: string }>;
  getGoalContext: () => Promise<{ success: boolean; last7dByCategory?: any[]; yesterday?: any; error?: string }>;
  parseGoalFeedback: (data: { message: string; goals: string[] }) => Promise<{ completed: string[]; added: any[]; note: string }>;
  // Life Phases Timeline (The River of Years)
  lifePhaseGet: () => Promise<{ ok: boolean; data?: any[]; error?: string }>;
  lifePhaseGetSummary: () => Promise<{ ok: boolean; data?: string | null; error?: string }>;
  lifePhaseSave: (phase: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
  lifePhaseDelete: (phaseId: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
  lifePhaseSaveAll: (phases: any[]) => Promise<{ ok: boolean; data?: any[]; error?: string }>;
  lifePhaseAiAssist: (params: { kind?: string; context?: any }) => Promise<{ ok: boolean; data?: { questions: string[] }; error?: string }>;
  lifePhaseGetPeriodContext: (params: { startDate: string; endDate: string }) => Promise<{ ok: boolean; data?: any; error?: string }>;
  lifePhaseAiReflect: (params: any) => Promise<{ ok: boolean; data?: any; error?: string }>;
  lifePhaseAiEraTrends: (params: { startYear: number; endYear: number | null; title: string }) => Promise<{ ok: boolean; data?: string; error?: string }>;
  lifePhaseAiSummarize: (phases: any[]) => Promise<{ ok: boolean; data?: string; error?: string }>;
  connectors: {
    list: () => Promise<{ success: boolean; connectors: any[]; error?: string }>;
    add: (connector: { type: string; provider: string; displayName: string; config: any }) => Promise<{ success: boolean; connector?: any; error?: string }>;
    remove: (id: string) => Promise<{ success: boolean; error?: string }>;
    test: (id: string) => Promise<{ success: boolean; message: string; latencyMs?: number }>;
    sync: (id: string) => Promise<{ success: boolean; itemsAdded: number; itemsUpdated: number; error?: string }>;
    items: (id: string, opts?: { type?: string; limit?: number }) => Promise<{ success: boolean; items: any[]; error?: string }>;
    status: (id: string) => Promise<{ success: boolean; status: string; lastSync?: string; errorMessage?: string }>;
  };
  mcpListTools: (serverId: string) => Promise<{ success: boolean; tools: any[]; error?: string }>;
  mcpCallTool: (serverId: string, toolName: string, args: Record<string, any>) => Promise<{ success: boolean; result: any; error?: string }>;
  mcpServerStatus: (serverId: string) => Promise<{ status: string; toolCount?: number; uptime?: number }>;
  mcpStartServer: (serverId: string) => Promise<{ success: boolean; tools?: any[]; error?: string }>;
  mcpStopServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
  aceternityFetchRegistry: () => Promise<{ success: boolean; components: any[]; total: number; error?: string }>;
  aceternityFetchComponent: (slug: string) => Promise<{ success: boolean; component?: any; error?: string }>;
  aceternityInstallComponent: (slug: string, cwd: string) => Promise<{ success: boolean; filesWritten?: string[]; error?: string }>;
  fetchReferoCatalog: (forceRefresh?: boolean, query?: string) => Promise<{ success: boolean; systems: any[]; total: number; error?: string }>;
  fetchReferoSystem: (slug: string) => Promise<{ success: boolean; system?: any; error?: string }>;
  searchReferoSystems: (query: string) => Promise<{ success: boolean; systems: any[]; total: number; error?: string }>;
  getDesignLibraryConfig: () => Promise<any>;
  setDesignLibraryConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
  getDesignCachedData: (key: string) => Promise<{ success: boolean; data?: any; timestamp?: number; stale?: boolean }>;
  testDesignLibraryConnection: (serverId: string) => Promise<{ success: boolean; latency?: number; toolCount?: number; error?: string }>;
  financeGetAccounts: () => Promise<any[]>;
  financeCreateAccount: (data: any) => Promise<any>;
  financeUpdateAccount: (data: any) => Promise<any>;
  financeArchiveAccount: (id: number) => Promise<any>;
  financeGetWallets: (accountId?: number) => Promise<any[]>;
  financeCreateWallet: (data: any) => Promise<any>;
  financeUpdateWallet: (data: any) => Promise<any>;
  financeAdjustBalance: (id: number, newBalance: number) => Promise<any>;
  financeGetCategories: () => Promise<any[]>;
  financeCreateCategory: (data: any) => Promise<any>;
  financeUpdateCategory: (data: any) => Promise<any>;
  financeGetTransactions: (filters?: any) => Promise<any[]>;
  financeCreateTransaction: (data: any) => Promise<any>;
  financeCreateTransfer: (data: any) => Promise<any>;
  financeUpdateTransaction: (data: any) => Promise<any>;
  financeDeleteTransaction: (id: number) => Promise<any>;
  financeBatchUpdateCategory: (ids: number[], categoryId: number) => Promise<{ success: boolean; updated?: number; error?: string }>;
  financeGetSummary: () => Promise<any>;
  financeGetSpendingByCategory: () => Promise<any[]>;
  financeGetMonthlyTrends: () => Promise<any[]>;
financeGetOnBehalfOfSummary: () => Promise<{ totalExpense: number; breakdown: { label: string; total: number; count: number }[] }>;
financeLastTransactionDate: () => Promise<{ lastUpdated: string; lastDate: string } | null>;
financeGetFtPersons: () => Promise<{ id: number; name: string; email: string | null; phone: string | null; notes: string; created_at: string; updated_at: string; transaction_count: number; total_owed: number; total_paid: number; balance: number; wallet_id: number | null }[]>;
  financeGetFtPersonBalances: () => Promise<{ id: number; name: string; email: string | null; phone: string | null; total_owed: number; total_repaid: number; transaction_count: number }[]>;
  financeCreateFtPerson: (data: { name: string; email?: string; phone?: string; notes?: string }) => Promise<{ id: number; name: string; email: string | null; phone: string | null; notes: string; transaction_count: number; total_owed: number; total_paid: number } | null>;
  financeUpdateFtPerson: (data: { id: number; name?: string; email?: string; phone?: string; notes?: string }) => Promise<{ success: boolean; error?: string }>;
  financeDeleteFtPerson: (id: number) => Promise<{ success: boolean }>;
  financeRecordFtRepayment: (data: {
    originalTxId: number; personId?: number; amount: number; date: string;
    walletId?: number; accountId?: number; description?: string; isOverpayment?: boolean;
  }) => Promise<{ success: boolean; repaymentTxId?: number; error?: string }>;
  financeGetDashboardOverview: (currency?: string) => Promise<{
    summary: { totalIncome: number; totalExpense: number; netBalance: number };
    recentTransactions: any[];
    monthlyTrends: any[];
    spendingByCategory: any[];
    subscriptionCount: number;
  }>;
  financeIsLocked: () => Promise<any>;
  financeGetLockState: () => Promise<any>;
  financeUnlock: (password: string) => Promise<any>;
  financeLock: () => Promise<any>;
  financeSetPassword: (password: string) => Promise<any>;
  financeChangePassword: (currentPassword: string, nextPassword: string) => Promise<any>;
  financeCheckPasswordSetup: () => Promise<any>;
  financeSetRememberDevice: (remember: boolean, days: number) => Promise<any>;
  financeSetLockTimeout: (timeoutMs: number) => Promise<any>;
  financeGetSecuritySettings: () => Promise<any>;
  financeCheckPageAccess: () => Promise<any>;
  financeBiometricUnlock: () => Promise<any>;
  financeGetWebAuthnCredential: () => Promise<any>;
  financeStoreWebAuthnCredential: (credentialId: string) => Promise<any>;
  financeGetDisplayCurrency: () => Promise<{ currency: string }>;
  financeSetDisplayCurrency: (currency: string) => Promise<{ success: boolean }>;
  financeRecapList: () => Promise<{ ok: boolean; data?: any[]; error?: string }>;
  financeRecapGet: (month: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
  financeRecapGenerate: (month: string, force?: boolean) => Promise<{ ok: boolean; data?: any; error?: string }>;
  financeRecapDelete: (month: string) => Promise<{ ok: boolean; error?: string }>;
  financeRecapMonthsWithData: () => Promise<{ ok: boolean; data?: string[]; error?: string }>;
  financeCryptoCacheStatus: () => Promise<{ lastFetch: number; cacheAgeS: number; rateLimited: boolean; retryIn: number; coinsTracked: number }>;
  financeFetchCryptoPrices: (coinIds: string[], currency?: string) => Promise<any[]>;
  financeGetCryptoHistory: (coinId: string, days?: number, currency?: string) => Promise<any[]>;
  financeRecalculateBalances: (walletId: number, dryRun?: boolean) => Promise<{ success: boolean; newBalance?: number; oldBalance?: number; breakdown?: any[]; initialBalance?: number; walletName?: string; error?: string }>;
  financeApplyRecalculatedBalance: (walletId: number) => Promise<{ success: boolean; newBalance?: number; oldBalance?: number; breakdown?: any[]; initialBalance?: number; walletName?: string; error?: string }>;
  financeUpdateTransactionSortOrder: (updates: { id: number; sort_order: number }[]) => Promise<{ success: boolean; error?: string }>;
  financeRecalculateAllBalances: () => Promise<{ success: boolean; results?: any[]; error?: string }>;
  auditList: (params?: { entityType?: string; entityId?: number; limit?: number; offset?: number }) => Promise<{ rows: any[]; total: number }>;
  auditGet: (id: number) => Promise<any>;
  learnGetProfile: (key: string) => Promise<string | null>;
  learnSetProfile: (key: string, value: string) => Promise<{ ok: boolean; error?: string }>;
  learnDeleteProfile: (key: string) => Promise<{ ok: boolean; error?: string }>;
  learnGetAllProfile: () => Promise<Record<string, string>>;

  // Animation Engine
  learnRenderAnimation: (args: { dsl: Record<string, unknown> }) => Promise<{ ok: boolean; issues: string[] }>;
  learnRenderVideoAsset: (args: { lessonId: string; nodeId: string; blockId: string }) => Promise<{ ok: boolean; video_path?: string; poster_path?: string; status?: string; error?: string }>;
  learnGetAnimationPreview: (args: { lessonId: string; blockId: string }) => Promise<{ ok: boolean; poster_path?: string | null }>;

  // Insight Engine
  getDailyFunFact: () => Promise<any | null>;
  buildInsightRollup: (date: string) => Promise<{ ok: boolean; error?: string }>;
  getInsightStrip: (params?: { period?: string }) => Promise<any[]>;
  getRewind: (period: string) => Promise<any | null>;
  logInsightEvent: (atomId: string, eventType: string) => Promise<void>;
  getHomeSummary: () => Promise<{
    focusMinutes: number;
    walletCount: number;
    totalBalance: number;
    dueReviews: number;
    sleepSeconds: number;
    financeLocked: boolean;
  } | null>;

  // Backup & Restore
  backup: {
    create: () => Promise<any>;
    list: () => Promise<any[]>;
    restore: (name: string) => Promise<{ success: boolean; error?: string }>;
    exportJSON: () => Promise<string>;
    exportCSV: (tables: string[]) => Promise<string[]>;
  };

  // Subscriptions
  subscriptionsList: (walletId?: number) => Promise<any[]>;
  subscriptionsCreate: (data: any) => Promise<any>;
  subscriptionsUpdate: (data: any) => Promise<{ success: boolean }>;
  subscriptionsDelete: (id: number) => Promise<{ success: boolean }>;
  subscriptionsGetUpcomingRenewals: (days?: number) => Promise<any[]>;
  subscriptionsGenerateDueTransactions: () => Promise<{ created: number; subscriptions: { subId: number; txnId: number; name: string; amount: number }[] }>;
  subscriptionsSkipRenewal: (id: number) => Promise<{ success: boolean; error?: string }>;

  // Pairing & Relay (mobile phone connection)
  pairGenerateCode: (terminalId: string) => Promise<{
    success: boolean; code?: string; terminalId?: string; expiresAt?: number;
    wsUrl?: string; syncUrl?: string; port?: number; error?: string;
  }>;
  pairRevoke: (code: string) => Promise<{ success: boolean }>;
  onRelayPaired: (callback: (data: { terminalId: string }) => void) => () => void;

  // Device management
  listDevices: () => Promise<{ success: boolean; devices?: any[]; error?: string }>;
  revokeDevice: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
  revokeAllDevices: () => Promise<{ success: boolean; error?: string }>;

  // Auth: register, login, pair generate, state, logout
  authGetState: () => Promise<{ authenticated: boolean; userId: string | null; deviceId: string | null; syncUrl: string }>;
  authRegister: (args: { email: string; password: string }) => Promise<{ success: boolean; userId?: string; deviceId?: string; error?: string }>;
  authLogin: (args: { email: string; password: string }) => Promise<{ success: boolean; userId?: string; deviceId?: string; error?: string }>;
  authPairGenerate: () => Promise<{ success: boolean; code?: string; expiresAt?: number; expiresAtMs?: number; syncUrl?: string; lanHost?: string; syncPort?: string; error?: string }>;
  authLogout: () => Promise<{ success: boolean }>;

  // Learn profile
  learnGetProfile: ({ key }: { key: string }) => Promise<any>;
  learnSetProfile: ({ key, value }: { key: string; value: string }) => Promise<any>;
  learnDeleteProfile: ({ key }: { key: string }) => Promise<any>;
  learnGetAllProfile: () => Promise<Record<string, string>>;

  // Animation Engine
  learnRenderAnimation: (args: { dsl: Record<string, unknown> }) => Promise<any>;
  learnRenderVideoAsset: (args: { lessonId: string; nodeId: string; blockId: string }) => Promise<any>;
  learnGetAnimationPreview: (args: { lessonId: string; blockId: string }) => Promise<any>;

  // Deep Focus Sessions
  focus: {
    start: (cfg: { durationSec: number; strictness?: 'distracting' | 'non_allowed'; allowed?: { apps?: string[]; domains?: string[]; tiers?: string[] } }) => Promise<any>;
    end: (outcome?: string) => Promise<void>;
    getState: () => Promise<{ active: boolean; endsAt: number | null; remainingSec: number; strictness: string; paused: boolean }>;
    history: (opts?: { limit?: number }) => Promise<any[]>;
    onState: (cb: (state: { active: boolean; endsAt: number | null; remainingSec: number; strictness: string; paused: boolean }) => void) => (() => void);
    onEnded: (cb: (data: { outcome: string; reason: string | null; id: number }) => void) => (() => void);
  };

  // Focus goals (daily per-strictness targets)
  focusGoal: {
    get: () => Promise<{ lenient_goal_sec: number; strict_goal_sec: number; updated_at: string | null }>;
    save: (cfg: { lenient_goal_sec?: number; strict_goal_sec?: number }) => Promise<{ lenient_goal_sec: number; strict_goal_sec: number; updated_at: string | null }>;
  };

  // Activity Goals (per-external-activity targets)
  activityGoalSave: (activityId: number, config: {
    goal_enabled?: boolean;
    daily_target_minutes?: number;
    weekly_target_days?: number;
    reminder_enabled?: boolean;
    reminder_time?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  activityGoalGetAll: () => Promise<Array<{
    id: number; name: string; type: string; color: string; icon: string;
    goal_enabled: number; daily_target_minutes: number | null;
    weekly_target_days: number | null; reminder_enabled: number;
    reminder_time: string | null; today_seconds: number;
  }>>;
  activityGoalGetProgress: (activityId: number, date: string) => Promise<{
    activity_id: number; date: string; achieved_seconds: number;
    target_seconds: number; percent_complete: number; completed: boolean;
  } | null>;
  activityGoalGetProgressBatch: (date: string) => Promise<Array<{
    activity_id: number; name: string; color: string;
    daily_target_minutes: number; achieved_seconds: number;
  }>>;

  // Finance Goals (spending targets)
  financeGoalSave: (goal: {
    id?: string; title: string; description?: string; target_amount: number;
    currency?: string; category?: string; period?: string;
    start_date: string; end_date?: string;
  }) => Promise<{ success: boolean; id?: string; error?: string }>;
  financeGoalGetAll: () => Promise<Array<{
    id: string; title: string; description: string | null;
    target_amount: number; current_amount: number; currency: string;
    category: string | null; period: string; start_date: string;
    end_date: string | null; status: string; created_at: string;
    completed_at: string | null;
  }>>;
  financeGoalUpdateProgress: (goalId: string, amount: number) => Promise<{ success: boolean; completed?: boolean; error?: string }>;
  financeGoalDelete: (goalId: string) => Promise<{ success: boolean; error?: string }>;

  // Reflection Goals (journal text on goals)
  reflectionGoalSave: (goalId: string, date: string, text: string) => Promise<{ success: boolean; error?: string }>;
  reflectionGoalGet: (goalId: string) => Promise<{ journal_text: string | null } | null>;

  // Cross-Feature Goal Progress
  getCrossFeatureProgress: (goalId: string) => Promise<{ success: boolean; progress: number; target: number; percentComplete: number; details: string }>;

  // AI Goal Monitor
  goalAiMonitor: () => Promise<{ success: boolean; proposals: Array<{ goalId: string; action: 'reschedule' | 'adjust_target' | 'split' | 'retire' | 'celebrate'; reason: string; newConfig?: any }> }>;
  goalAiApplyProposal: (goalId: string, newConfig: any) => Promise<{ success: boolean; error?: string }>;
  goalAiParseLanguage: (text: string) => Promise<{ success: boolean; parsedGoal: any; error?: string }>;

  // Habit Tracker
  getHabits: (startDate: string, endDate: string) => Promise<{ success: boolean; habits: any[] }>;
  toggleHabitDay: (goalId: string, date: string, completed: boolean) => Promise<{ success: boolean; newStreak: number }>;

  // Focus Groups (named allowed-app sets for Deep Focus sessions)
  focusGroup: {
    list: () => Promise<any[]>;
    get: (id: number) => Promise<any>;
    save: (g: any) => Promise<{ success: boolean; id?: number; error?: string }>;
    remove: (id: number) => Promise<{ success: boolean; error?: string }>;
    startWith: (id: number, durationSec?: number, strictness?: string) => Promise<any>;
    startWithMany: (ids: number[], durationSec?: number, strictness?: string) => Promise<any>;
    linkUsage: (args: { sessionId: number; groupId: number; goalIds: string[] }) => Promise<{ success: boolean; error?: string }>;
    getUsage: () => Promise<Array<{ group_id: number; session_id: number }>>;
  };

  // ========== Project Backup (Design Workspace) ==========
  projectBackup: {
    create: (projectId: string, projectPath: string, label?: string, extra?: Record<string, unknown>) => Promise<{ success: boolean; data?: ProjectBackupManifest; error?: string }>;
    list: (projectId?: string) => Promise<{ success: boolean; data: ProjectBackupManifest[]; error?: string }>;
    get: (backupId: string) => Promise<{ success: boolean; data?: ProjectBackupManifest; error?: string }>;
    delete: (backupId: string, projectId: string) => Promise<{ success: boolean; error?: string }>;
    restore: (projectId: string, backupId: string) => Promise<{ success: boolean; data?: { restoredCount: number }; error?: string }>;
    diff: (projectId: string, backupId: string) => Promise<{ success: boolean; data?: ProjectBackupDiff; error?: string }>;
    schedule: (projectId: string, minutes: number, projectPath?: string) => Promise<{ success: boolean; error?: string }>;
    getSchedules: () => Promise<{ success: boolean; data?: Array<{ projectId: string; minutes: number; projectPath?: string; enabled: boolean; lastRunAt?: string | null }>; error?: string }>;
  };

  // ========== Database Backup ==========
  backup: {
    create: () => Promise<BackupManifest>;
    list: () => Promise<BackupManifest[]>;
    restore: (name: string) => Promise<{ success: boolean }>;
    exportJSON: () => Promise<string>;
    exportCSV: (tables: string[]) => Promise<string[]>;
    status: () => Promise<BackupStatus>;
    verify: (name: string) => Promise<{ ok: boolean; rows: number; error?: string }>;
    settingsGet: () => Promise<BackupSettings>;
    settingsSet: (patch: Partial<BackupSettings>) => Promise<BackupSettings>;
    pickMirrorDir: () => Promise<{ canceled: boolean; mirrorDir?: string; settings?: BackupSettings }>;
  };

  // ========== Git Safety Layer ==========
  gitSafety: {
    check: (command: string) => Promise<GitSafetyCheckResult>;
    getSettings: () => Promise<GitSafetySettings>;
    setSettings: (settings: Partial<GitSafetySettings>) => Promise<{ success: boolean }>;
    getPending: () => Promise<GitSafetyPending | null>;
    confirmPending: (terminalId: string) => Promise<{ success: boolean; command?: string }>;
    cancelPending: (terminalId: string) => Promise<{ success: boolean }>;
  };

  // ========== Manual Time Assignments ==========
  manualAssignList: (date: string) => Promise<ManualAssignment[]>;
  manualAssignDayContext: (date: string) => Promise<{ tracked: Array<{ started_at: string; ended_at: string; app?: string | null }>; manual: ManualAssignment[] }>;
  manualAssignCreate: (data: { startedAt: string; endedAt: string; mode?: 'random' | 'custom'; app?: string | null; category?: string | null }) => Promise<{ ok: boolean; id?: number; durationSeconds?: number; error?: string }>;
  manualAssignDelete: (id: number) => Promise<{ ok: boolean; error?: string }>;

  // ========== User Context Profile ==========
  contextGetProfile: () => Promise<any>;
  contextUpdateProfile: (patch: any) => Promise<void>;
  contextAddSignal: (signalType: string, content: string, source: string, confidence?: number) => Promise<void>;
  contextGetSignals: (signalType?: string, source?: string, limit?: number) => Promise<any[]>;
  contextRebuild: () => Promise<void>;
  contextGetGrowth: () => Promise<any>;
  contextGetMemoryHighlights: () => Promise<Array<{ content: string; source: string; importance: number }>>;
  contextGetDebug: () => Promise<any>;
  contextRunNow: (kind: string) => Promise<any>;

  // ========== Context Brain ==========
  brainSearch: (query: string, strategies?: string[]) => Promise<any>;
  brainGetEntity: (name: string) => Promise<any>;
  brainGetEntityHistory: (name: string) => Promise<any>;
  brainLogEpisode: (source: string, content: string, sourceRef?: string) => Promise<any>;
  brainStats: () => Promise<any>;
  brainExport: () => Promise<any>;
  brainGetEpisodes: (opts?: any) => Promise<{ items: any[]; total: number }>;
  brainGetEntities: (opts?: any) => Promise<{ items: any[]; total: number }>;
  brainGetFacts: (opts?: any) => Promise<{ items: any[]; total: number }>;
  brainGetEntityRelated: (entityId: string) => Promise<any[]>;
  brainGetJobs: () => Promise<{ jobs: any[]; stats: any }>;
  brainRetryJob: (jobId: string) => Promise<{ ok: boolean }>;
  brainCreateEpisode: (data: { source: string; content: string; sourceRef?: string; metadata?: any }) => Promise<{ ok: boolean; episodeId?: string }>;
  brainMcpStatus: () => Promise<{ running: boolean; port: number }>;
  brainReindexEmbeddings: () => Promise<{ ok: boolean; processed: number; skipped: number }>;

  // ========== Life Graph — Unified Orchestration ==========
  getUnifiedGraph: () => Promise<{
    nodes: Array<{ id: string; type: string; title: string; metadata: any }>;
    edges: Array<{ source: string; target: string; type: string; weight: number }>;
    profileSignals: Array<{ trait: string; value: number; evidence: string[] }>;
    error?: string;
  }>;
  getTodayContext: () => Promise<{
    activeScheduleId: string | null;
    todaysGoalIds: string[];
    approachingDeadlineIds: string[];
    relevantNoteIds: string[];
    activeEntityIds: string[];
    error?: string;
  }>;
}

export interface ManualAssignment {
  id: number;
  date: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  mode: 'random' | 'custom';
  app?: string | null;
  category?: string | null;
  created_at?: string;
}

export interface GitSafetySettings {
  enabled: boolean;
  blockHardReset: boolean;
  blockForcePush: boolean;
  blockDestructive: boolean;
  blockBranchDelete: boolean;
  customPatterns: string[];
  askBeforeAction: boolean;
}

export interface GitSafetyCheckResult {
  dangerous: boolean;
  patterns: string[];
  command: string;
  suggestion: string;
}

export interface GitSafetyPending {
  terminalId: string;
  command: string;
  patterns: string[];
  suggestion: string;
  timestamp: number;
}

// ── Content Engine types ──────────────────────────────────
export interface RetentionEvidence {
  criteria: string[];
  mechanism: string;
  evidence: string;
  score: number;
}

export interface ScriptFrame {
  index: number;
  text: string;
  duration_seconds: number;
  frame_type: 'hook' | 'value' | 'transition' | 'call_to_action' | 'visual_only';
  visual: string;
  retention: RetentionEvidence;
  timestamp: string;
  rejected?: boolean;
  rejection_reasons?: string[];
}

export interface GateCheck {
  pass: boolean;
  reason: string;
}

export interface GatesResult {
  scroll_stop: GateCheck;
  hard_cut: GateCheck;
  asset_ready: GateCheck;
  overall: 'pass' | 'fail';
  suggestions: string[];
  checked_at?: string;
}

export interface ContentIdea {
  id?: number;
  title: string;
  hook?: string;
  format_type?: string;
  status?: 'raw' | 'refined' | 'approved' | 'used';
  priority?: number;
  series?: string | null;
  niche?: string | null;
  frames?: string[];
  synthesized_from?: number[];
  gates?: GatesResult | null;
  brainstorm_id?: number | null;
}

export interface ContentBrainstorm {
  id?: number;
  thought: string;
  category?: string;
  format_type?: string | null;
  niche_hint?: string | null;
  suggested_title?: string | null;
  reason?: string | null;
  summary?: any;
  idea_id?: number | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContentEpisode {
  id?: number;
  title: string;
  idea_id?: number | null;
  theme_id?: number | null;
  series_id?: number | null;
  episode_number?: number | null;
  status?: 'draft' | 'scripted' | 'gated' | 'filming' | 'published';
  niche?: string | null;
  script?: ScriptFrame[];
  seo?: any;
  gates?: GatesResult | null;
  gate_override?: boolean;
  scheme_id?: string;
  published_at?: string | null;
  process?: Record<string, any>;
}

export interface ContentSeries {
  id?: number;
  name: string;
  description?: string | null;
  niche?: string | null;
  tone?: string | null;
  visual_style?: string | null;
  pacing?: string | null;
  target_duration?: string | null;
  brand_colors?: Record<string, string>;
  episode_format?: 'standard' | 'short' | 'long' | 'variable';
  frame_mode?: 'strict' | 'flexible';
  arc_outline?: Array<{ episode: number; title: string; summary: string }>;
  status?: 'active' | 'paused' | 'completed' | 'archived';
  episodes?: Array<{ id: number; title: string; status: string; episode_number: number }>;
}

export interface ContentVideo {
  id?: number;
  episode_id?: number | null;
  platform?: string;
  url?: string | null;
  title: string;
  views?: number;
  likes?: number;
  saves?: number;
  shares?: number;
  comments?: number;
  completion_pct?: number | null;
  retention_curve?: Array<{ t: number; pct: number }>;
  audience?: { ages?: Array<{ range: string; pct: number }>; countries?: Array<{ code: string; name: string; pct: number }> } | null;
  dropoffs?: Array<{ t: number; pct: number }>;
  published_at?: string | null;
}

export interface ContentLesson {
  id?: number;
  video_id?: number | null;
  episode_id?: number | null;
  lesson: string;
  evidence?: Array<{ metric: string; value: string; note?: string }>;
  confidence?: number;
  applies_to?: string | null;
  status?: 'active' | 'applied' | 'dismissed' | 'confirmed';
}

export interface ContentFramework {
  id?: number;
  name: string;
  description?: string;
  rules?: Array<{ id: string; rule: string }>;
  version?: number;
  is_builtin?: boolean;
  is_active?: boolean;
  history?: Array<{ version: number; rules: any[]; saved_at: string }>;
}

export interface ScoringSchemeInfo {
  id: 'signal_builder' | 'audience_builder' | 'media_operator';
  name: string;
  tier: 'A' | 'B' | 'C';
  description: string;
  weights: Record<string, number>;
  duration?: string;
}

export interface FrameScoreBreakdown {
  index: number;
  text: string;
  score: number;
  weighted: number;
  rejected: boolean;
  nonNegotiableFails: string[];
  criteria: string[];
}

export interface ReflectionAnalysis {
  characteristics: Array<{ name: string; value: string }>;
  intuitions: string[];
  contradictions: Array<{ gut: string; data: string; resolution: string }>;
  format_fit: { format: string; verdict: 'SUITS' | 'DOES NOT SUIT'; reasoning: string };
  extracted_pattern: string;
  suggested_lesson: { lesson: string; applies_to: string; confidence: number };
}

export interface VideoReflection {
  id?: number;
  episode_id?: number | null;
  video_id?: number | null;
  reflection_text: string;
  analysis?: ReflectionAnalysis | null;
  created_at?: string;
}

export interface ProcessEvent {
  id: number;
  episode_id: number | null;
  event_type: string;
  label: string | null;
  detail: any;
  ai_model?: string | null;
  created_at: string;
}

export interface ProcessGalleryItem {
  episode_id: number;
  title: string;
  status: string;
  steps: number;
  ai_calls: number;
  pivots: number;
  duration_min: number;
  score: number | null;
  views: number;
  lessons: number;
  lesson_text: string | null;
  updated_at: string;
  scheme_id: string;
}

export interface CalibrationReport {
  accuracy: number;
  per_criterion: Array<{ criterion: string; predicted_avg: number; actual_metric: string; actual_value: number; criterion_accuracy: number; notes: string }>;
  most_accurate: string;
  least_accurate: string;
  recommendations: string[];
}

export interface AnalyticsCandidate {
  platform: string;
  views: number | null;
  likes: number | null;
  saves: number | null;
  shares: number | null;
  comments: number | null;
  followers_gained: number | null;
  completion_pct: number | null;
  avg_watch_seconds: number | null;
  published_at: string | null;
  retention_curve: Array<{ t: number; pct: number }>;
  audience: { ages: Array<{ range: string; pct: number }>; countries: Array<{ code: string; name: string; pct: number }> } | null;
  dropoffs: Array<{ t: number; pct: number }>;
}

export interface ContentEngineApi {
  ideasList: () => Promise<ContentIdea[]>;
  ideaSave: (idea: ContentIdea) => Promise<{ ok: boolean; id?: number; error?: string }>;
  ideaDelete: (id: number) => Promise<{ ok: boolean }>;
  episodesList: (opts?: { ideaId?: number }) => Promise<ContentEpisode[]>;
  episodeGet: (id: number) => Promise<ContentEpisode | null>;
  episodeSave: (ep: ContentEpisode) => Promise<{ ok: boolean; id?: number; error?: string }>;
  episodeDelete: (id: number) => Promise<{ ok: boolean }>;
  episodePlanFull: (payload: { episodeId: number; elements?: string[] }) => Promise<{ ok: boolean; plan?: { script_frames: ScriptFrame[]; hook_stack: any; curiosity_gaps: any[]; keywords_seo: any[]; algorithm_poison: string[]; caption: string; pinned_comment: string; timeline: any[]; gates: any }; error?: string }>;
  scriptGenerate: (payload: { episodeId?: number; ideaId?: number }) => Promise<{ ok: boolean; frames?: ScriptFrame[]; gates?: GatesResult; error?: string }>;
  scriptRegenerateLine: (payload: { episodeId: number; frameIndex: number; instruction?: string }) => Promise<{ ok: boolean; frame?: ScriptFrame; error?: string }>;
  validateScriptEvidence: (payload: { episodeId: number }) => Promise<{ ok: boolean; results?: any[]; script?: ScriptFrame[]; error?: string }>;
  validateGates: (payload: { ideaId?: number; episodeId?: number }) => Promise<{ ok: boolean; gates?: GatesResult; error?: string }>;
  gateOverride: (payload: { episodeId: number; override: boolean }) => Promise<{ ok: boolean }>;
  injectSeo: (payload: { episodeId: number; niche?: string }) => Promise<{ ok: boolean; phrases?: any[]; error?: string }>;
  synthesizeIdeas: (payload?: { note?: string; count?: number }) => Promise<{ ok: boolean; ideas?: ContentIdea[]; error?: string }>;
  brainstormClassify: (payload: { thought: string }) => Promise<{ ok: boolean; category?: 'content_idea' | 'framework_update' | 'system_improvement' | 'analytics' | 'general_thought'; reason?: string; suggested_title?: string; format_type?: string; niche_hint?: string; error?: string }>;
  brainstormSummary: (payload?: { note?: string }) => Promise<{ ok: boolean; summary?: any[]; error?: string }>;
  brainstormList: () => Promise<ContentBrainstorm[]>;
  brainstormSave: (b: ContentBrainstorm) => Promise<{ ok: boolean; id?: number; error?: string }>;
  brainstormDelete: (id: number) => Promise<{ ok: boolean }>;
  externalBuildClassifyPrompt: (payload: { thought: string; templateIds?: string[] }) => Promise<{ ok: boolean; prompt?: string; system?: string; error?: string }>;
  externalBuildSynthesizePrompt: (payload: { note?: string; count?: number; templateIds?: string[] }) => Promise<{ ok: boolean; prompt?: string; system?: string; error?: string }>;
  externalBuildScriptPrompt: (payload: { episodeId: number; templateIds?: string[]; frameMode?: string; sections?: string[] }) => Promise<{ ok: boolean; prompt?: string; system?: string; scheme?: { id: string; name: string }; error?: string }>;
  externalImportClassify: (payload: { thought: string; rawJson: string }) => Promise<{ ok: boolean; id?: number; category?: string; reason?: string; suggested_title?: string; format_type?: string; niche_hint?: string; error?: string }>;
  externalImportSynthesize: (payload: { rawJson: string }) => Promise<{ ok: boolean; count?: number; error?: string }>;
  externalImportScript: (payload: { episodeId: number; rawJson: string }) => Promise<{ ok: boolean; frames?: ScriptFrame[]; gates?: any; error?: string }>;
  seriesList: () => Promise<ContentSeries[]>;
  seriesGet: (id: number) => Promise<(ContentSeries & { episodes: any[] }) | null>;
  seriesSave: (s: ContentSeries) => Promise<{ ok: boolean; id?: number; error?: string }>;
  seriesDelete: (id: number) => Promise<{ ok: boolean }>;
  seriesAddEpisode: (payload: { seriesId: number; episodeId: number }) => Promise<{ ok: boolean; episode_number?: number; error?: string }>;
  seriesRemoveEpisode: (payload: { episodeId: number }) => Promise<{ ok: boolean; error?: string }>;
  seriesReorder: (payload: { seriesId: number; episodeIds: number[] }) => Promise<{ ok: boolean; error?: string }>;
  themesCreate: (theme: any) => Promise<{ ok: boolean; id?: number; error?: string }>;
  themesGenerate: (payload?: { note?: string }) => Promise<{ ok: boolean; id?: number; theme?: any; error?: string }>;
  themesGetAll: () => Promise<any[]>;
  themesApply: (payload: { themeId: number; episodeId: number }) => Promise<{ ok: boolean }>;
  themesDelete: (id: number) => Promise<{ ok: boolean }>;
  analyticsGet: (payload?: { episodeId?: number }) => Promise<{ ok: boolean; videos?: ContentVideo[]; lessons?: ContentLesson[]; aggregate?: any; error?: string }>;
  analyticsUpsertVideo: (video: ContentVideo) => Promise<{ ok: boolean; id?: number; error?: string }>;
  analyticsDeleteVideo: (id: number) => Promise<{ ok: boolean }>;
  analyticsInsight: (payload?: { episodeId?: number }) => Promise<{ ok: boolean; insights?: any[]; verdict?: string; error?: string }>;
  lessonsList: () => Promise<ContentLesson[]>;
  lessonSave: (lesson: ContentLesson) => Promise<{ ok: boolean; id?: number; error?: string }>;
  lessonDelete: (id: number) => Promise<{ ok: boolean }>;
  lessonExtract: (payload: { videoId: number }) => Promise<{ ok: boolean; lessons?: ContentLesson[]; error?: string }>;
  lessonConfirm: (payload: { lessonId: number; confirm: boolean }) => Promise<{ ok: boolean; promoted?: boolean; status?: string; framework?: any; error?: string }>;
  frameworksList: () => Promise<ContentFramework[]>;
  frameworkSave: (fw: ContentFramework) => Promise<{ ok: boolean; id?: number; version?: number; error?: string }>;
  frameworkRollback: (payload: { id: number; version: number }) => Promise<{ ok: boolean; error?: string }>;
  reflectionSave: (payload: { episodeId?: number; videoId?: number; reflectionText: string }) => Promise<{ ok: boolean; id?: number; error?: string }>;
  reflectionGet: (payload?: { episodeId?: number; videoId?: number }) => Promise<VideoReflection[]>;
  reflectionAnalyze: (payload: { reflectionId?: number; episodeId?: number }) => Promise<{ ok: boolean; analysis?: ReflectionAnalysis; id?: number; error?: string }>;
  characteristicsGet: (payload: { episodeId: number }) => Promise<{ ok: boolean; characteristics?: Record<string, string>; error?: string }>;
  characteristicsSave: (payload: { episodeId: number; characteristics: Record<string, string> }) => Promise<{ ok: boolean; error?: string }>;
  analyticsParseRaw: (payload: { raw: string }) => Promise<{ ok: boolean; candidate?: AnalyticsCandidate; error?: string }>;
  scoringSchemes: () => Promise<{ ok: boolean; schemes?: ScoringSchemeInfo[]; rubric_version?: string; threshold?: number; error?: string }>;
  scoringCurrent: (payload: { episodeId: number }) => Promise<{ ok: boolean; scheme?: ScoringSchemeInfo; breakdown?: FrameScoreBreakdown[]; average?: number; threshold?: number; version?: string; error?: string }>;
  scoringCalibrate: (payload: { episodeId: number }) => Promise<{ ok: boolean; calibration?: CalibrationReport; error?: string }>;
  processTimeline: (payload?: { episodeId?: number }) => Promise<ProcessEvent[]>;
  processLog: (payload: { episodeId: number; eventType: string; label?: string; detail?: any }) => Promise<{ ok: boolean; error?: string }>;
  processSummary: (payload: { episodeId: number }) => Promise<{ ok: boolean; summary?: { title: string; narrative: string }; events?: ProcessEvent[]; error?: string }>;
  processGallery: () => Promise<ProcessGalleryItem[]>;
  takesList: (payload: { episodeId: number }) => Promise<any[]>;
  takeSave: (take: any) => Promise<{ ok: boolean; id?: number; error?: string }>;
  takeDelete: (id: number) => Promise<{ ok: boolean }>;
  takeImport: (payload: { episodeId: number; filePath: string; duration?: number }) => Promise<{ ok: boolean; id?: number; take_number?: number; error?: string }>;
  takeTranscribe: (payload: { takeId: number }) => Promise<{ ok: boolean; status?: string; error?: string }>;
  takeSaveSegments: (payload: { takeId: number; segments: Array<{ start_s: number; end_s: number; text: string; seg_type?: string; keep?: boolean | null }> }) => Promise<{ ok: boolean; count?: number; error?: string }>;
  takeSegments: (payload: { takeId: number }) => Promise<any[]>;
  takeSelect: (payload: { takeId: number; segments: Array<{ id: number; keep: boolean }> }) => Promise<{ ok: boolean; error?: string }>;
  takeEvaluate: (payload: { takeId: number }) => Promise<{ ok: boolean; evaluation?: any; error?: string }>;
  editCutlist: (payload: { episodeId: number; takeId: number }) => Promise<{ ok: boolean; cutlist?: any[]; total_duration?: number; error?: string }>;
  editOverlayPlan: (payload: { episodeId: number }) => Promise<{ ok: boolean; plan?: any; error?: string }>;
  analyticsCorrelate: () => Promise<{ ok: boolean; correlations?: any[]; best_performer?: any; worst_performer?: any; recommendations?: string[]; message?: string; error?: string }>;

  // Notes
  notesList: (params?: { search?: string; tag?: string; group?: string; includeDrafts?: boolean; upcomingDeadlines?: boolean }) => Promise<{ success: boolean; notes?: any[]; error?: string }>;
  notesCreate: (data: { title?: string; content: string; tags?: string[]; group_name?: string; deadline?: string; deadline_time?: string; reminder?: string; is_draft?: number; links?: any[]; files?: string[] }) => Promise<{ success: boolean; id?: string; error?: string }>;
  notesUpdate: (data: { id: string; title?: string; content?: string; tags?: string[]; group_name?: string; deadline?: string | null; deadline_time?: string | null; reminder?: string; is_draft?: number; status?: string; links?: any[]; files?: string[] }) => Promise<{ success: boolean; error?: string }>;
  notesDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  notesGroups: () => Promise<{ success: boolean; groups?: string[]; error?: string }>;

  // Links & Files
  dialogOpenFile: () => Promise<{ canceled: boolean; filePath?: string | null; error?: string }>;
  openUrlInBrowser: (url: string, browserId?: string) => Promise<{ success: boolean; openedWith?: string; error?: string }>;
  openPath: (filePath: string, appId?: string) => Promise<{ success: boolean; openedWith?: string; error?: string }>;
  openInAppWindow: (url: string) => Promise<{ success: boolean; error?: string }>;
  getApps: () => Promise<{ success: boolean; apps?: { id: string; name: string; path: string; kind: string }[] }>;

  // ========== Agent Messaging (Task A) ==========
  agent: {
    sendMessage: (data: { from_agent: string; to_agent: string; message_type: string; content: string; mission_id?: string; summary?: string; payload?: any }) => Promise<{ ok: boolean; id?: string; message?: any; error?: string }>;
    getMessages: (data?: { mission_id?: string; agent_filter?: string }) => Promise<{ ok: boolean; messages?: any[]; error?: string }>;
    updateMessageStatus: (data: { id: string; status: 'pending' | 'delivered' | 'completed' | 'failed' }) => Promise<{ ok: boolean; error?: string }>;
    onMessageUpdated: (callback: (msg: any) => void) => () => void;
  };

  // ========== Context Brain Memories (Task D) ==========
  brain: {
    addMemory: (data: { category: string; content: string; source?: string; importance?: number; session_id?: string }) => Promise<{ ok: boolean; id?: string; memory?: any; error?: string }>;
    listMemories: (data?: { category?: string; limit?: number }) => Promise<{ ok: boolean; memories?: any[]; error?: string }>;
    searchMemories: (data: { query: string; category?: string }) => Promise<{ ok: boolean; memories?: any[]; error?: string }>;
  };

  // ========== Missions Persistence (Task E) ==========
  mission: {
    create: (data: { objective: string; agent_config?: any; id?: string }) => Promise<{ ok: boolean; id?: string; mission?: any; error?: string }>;
    list: () => Promise<{ ok: boolean; missions?: any[]; error?: string }>;
    update: (data: { id: string; status?: string; agent_config?: any }) => Promise<{ ok: boolean; error?: string }>;
    get: (id: string) => Promise<{ ok: boolean; mission?: any; error?: string }>;
  };
}

declare global {
  interface Window {
    deskflowAPI?: DeskflowAPI;
  }
}
