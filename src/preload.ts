import { contextBridge, ipcRenderer } from 'electron';

// SECURITY: Valid IPC channel allowlist - prevents unauthorized channel access
const VALID_CHANNELS = new Set([
  'foreground-changed', 'tracking-heartbeat', 'browser-tracking-event',
  'browser-identified', 'sleep-detection', 'external-data-changed',
  // Core API
  'get-logs', 'update-app-log', 'delete-app-log',
  'get-dashboard-aggregates', 'get-app-stats', 'get-domain-stats',
  'get-period-rankings', 'get-dashboard-data', 'get-page-stats',
  'backfill-aggregations', 'get-logs-by-period', 'get-stats',
  'get-daily-stats', 'toggle-tracking', 'set-tracking', 'restart-tracking',
  'get-platform-info', 'get-tracking-mode', 'set-tracking-mode',
  'clear-data', 'get-preference', 'set-preference',
  // Session
  'create-session', 'get-sessions', 'update-session', 'delete-session',
  'get-session-state', 'save-session-config', 'update-session-category',
  'update-session-resume-id',
  // Focus
  'focusGroup:list', 'focusGroup:get', 'focusGroup:save', 'focusGroup:remove',
  'focusGroup:startWith', 'focusGroup:startWithMany', 'focusGroup:linkUsage',
  // Goals
  'goal:create', 'goal:list', 'goal:get', 'goal:update', 'goal:delete',
  'goal:progress', 'goal:update-progress',
  // Finance
  'finance:get-wallets', 'finance:create-transaction', 'finance:update-transaction',
  'finance:delete-transaction', 'finance:get-categories', 'finance:get-summary',
  // Categories
  'save-category-config', 'get-category-config', 'get-categories',
  'update-categories-from-overrides',
  // Tracking
  'get-tracking-data', 'get-activity-stats', 'get-browser-stats',
  'get-browser-category-stats', 'get-app-activity',
  // Terminal
  'terminal:create', 'terminal:list', 'terminal:get', 'terminal:update',
  'terminal:delete', 'terminal:get-messages', 'terminal:send-message',
  'save-terminal-message', 'delete-terminal-message', 'save-terminal-session',
  'delete-terminal-session', 'save-terminal-layout', 'delete-terminal-layout',
  'save-terminal-preset', 'terminal:resize',
  // Projects
  'get-projects', 'create-project', 'update-project', 'delete-project',
  'get-project-line-stats', 'delete-project-line-stats',
  'save-project-run-config',
  // AI Context
  'ai-context:list', 'ai-context:get', 'ai-context:create', 'ai-context:update',
  'ai-context:delete', 'ai-context:group-create', 'ai-context:group-delete',
  // Browser
  'get-browser-profiles', 'create-browser-profile', 'delete-browser-profile',
  'update-browser-profile-app', 'get-browser-activity',
  // System
  'backup:create', 'backup:restore', 'get-schema', 'get-database-tables',
  'get-table-schema', 'get-table-data', 'get-table-data-count',
  'get-table-changes', 'get-table-foreign-keys',
  'get-logs-by-duration', 'get-logs-by-app', 'clear-logs',
  'rebuild-daily-stats', 'rebuild-browser-stats', 'rebuild-app-totals',
  // Word Tracker
  'wordTrackerGetWords', 'wordTrackerAddWord', 'wordTrackerRemoveWord',
  'wordTrackerToggleWord', 'wordTrackerSetTolerance', 'wordTrackerEditWord',
  'wordTrackerCounts', 'wordTrackerCountsByProject', 'wordTrackerGetConfig',
  'wordTrackerSetConfig', 'wordTrackerResetCounts', 'wordTrackerScanJsonl',
  'wordTrackerCountText',
  // STT
  'stt:transcript-save', 'stt:transcript-update', 'stt:transcript-delete',
  // Auth
  'auth:update-sync-url', 'auth:get-sync-url',
  // Conductor
  'conductor:send-directive', 'conductor:get-missions', 'conductor:get-status',
  // Agent
  'agent:send', 'agent:get-status', 'agent:list',
  // AIGateway
  'aigateway:send-prompt', 'aigateway:get-status',
  // AI Usage
  'ai-usage:track', 'ai-usage:get-stats', 'ai-usage:cleanup',
  // CLI
  'cli:check-updates',
  // Overlay Studio
  'overlay-studio:save-caption', 'overlay-studio:get-captions',
  // Memory
  'memory:delete', 'memory:get', 'memory:create', 'memory:update',
  // Context
  'context:update-profile', 'context:get-profile',
  // Brain
  'brain:create-episode', 'brain:get-episodes',
  // Composition
  'compositions:validate', 'compositions:evaluate', 'compositions:history',
  'compositions:status', 'compositions:settings:get', 'compositions:settings:set',
  // Gas
  'gas:sync', 'gas:export',
  // Splash
  'boot-animation-config', 'replay-splash', 'splash-complete',
  // File operations
  'save-file', 'read-file', 'delete-file',
  // Sync
  'sync:push', 'sync:pull', 'sync:get-status',
  // Notifications
  'notification:send', 'notification:clear', 'notification:get-all',
  // Tasks
  'task:create', 'task:update', 'task:delete', 'task:get', 'task:list',
]);

// SECURITY: Validate IPC channel before sending
function validateChannel(channel: string): boolean {
  return VALID_CHANNELS.has(channel);
}

// Bridge external-data-changed IPC event to window CustomEvent
// This allows main process to trigger renderer-side data refreshes
ipcRenderer.on('external-data-changed', () => {
  window.dispatchEvent(new CustomEvent('external-data-changed'));
});

contextBridge.exposeInMainWorld('deskflowAPI', {
  // SECURITY: Send an IPC message to the main process after validating the channel
  send: (channel: string, data?: any) => {
    if (VALID_CHANNELS.has(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.error(`[DeskFlow] SECURITY: Invalid IPC channel attempted: ${channel}`);
    }
  },
  // Listen for foreground window changes
  onForegroundChange: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('foreground-changed', handler);
    return () => { ipcRenderer.removeListener('foreground-changed', handler); };
  },

  // Listen for tracking heartbeat
  onTrackingHeartbeat: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('tracking-heartbeat', handler);
    return () => { ipcRenderer.removeListener('tracking-heartbeat', handler); };
  },

  // Listen for browser tracking live events
  onBrowserTrackingEvent: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('browser-tracking-event', handler);
    return () => { ipcRenderer.removeListener('browser-tracking-event', handler); };
  },

  // Listen for browser extension identification (fires when extension calls /browser-identify)
  onBrowserIdentified: (callback: (data: { browser: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('browser-identified', handler);
    return () => { ipcRenderer.removeListener('browser-identified', handler); };
  },

  // Listen for sleep detection events
  onSleepDetection: (callback: (data: any) => void) => {
    ipcRenderer.on('sleep-detection', (_event, data) => callback(data));
  },

  // Get recent activity logs
  getLogs: () => ipcRenderer.invoke('get-logs'),

  // Update/delete individual app log entries
  updateAppLog: (id: number, data: { timestamp?: string; duration_ms?: number; title?: string }) =>
    ipcRenderer.invoke('update-app-log', id, data),
  deleteAppLog: (id: number) => ipcRenderer.invoke('delete-app-log', id),

  // New: pre-aggregated dashboard data (replaces allLogs-based client-side computation)
  getDashboardAggregates: (request: { period: string; dateOffset?: number; weekOffset?: number; platform?: string }) =>
    ipcRenderer.invoke('get-dashboard-aggregates', request),

  // New: app stats for StatsPage
  getAppStats: (request: { period: string; dateOffset?: number }) =>
    ipcRenderer.invoke('get-app-stats', request),

  // Domain/website stats (aggregated in SQL)
  getDomainStats: (request: { period: string; dateOffset?: number }) =>
    ipcRenderer.invoke('get-domain-stats', request),

  // Rankings per period/granularity/metric (used by RankingsPage)
  getPeriodRankings: (request: { period: string; dateOffset?: number; granularity?: string; metric?: string }) =>
    ipcRenderer.invoke('get-period-rankings', request),

  // Get pre-computed dashboard data (single call replaces multiple fetches)
  getDashboardData: (params: { period: string; dateOffset?: number }) => ipcRenderer.invoke('get-dashboard-data', params),

  // Get pre-computed page stats
  getPageStats: (params: { page: string; period: string; dateOffset?: number }) => ipcRenderer.invoke('get-page-stats', params),

  // Backfill aggregations from existing logs
  backfillAggregations: () => ipcRenderer.invoke('backfill-aggregations'),

  // Get logs filtered by period and optional dateOffset
  getLogsByPeriod: (params: { period: 'today' | 'week' | 'month' | 'all'; dateOffset?: number }) => ipcRenderer.invoke('get-logs-by-period', params),

  // Get aggregated stats
  getStats: () => ipcRenderer.invoke('get-stats'),

  // Get daily stats
  getDailyStats: (period: 'week' | 'month' | 'all') => ipcRenderer.invoke('get-daily-stats', period),

  // Toggle tracking on/off
  toggleTracking: () => ipcRenderer.invoke('toggle-tracking'),
  setTracking: (enabled: boolean) => ipcRenderer.invoke('set-tracking', enabled),
  restartTracking: () => ipcRenderer.invoke('restart-tracking'),
  // Platform + tracking mode (Linux Wayland resilience)
  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
  getTrackingMode: () => ipcRenderer.invoke('get-tracking-mode'),
  setTrackingMode: (mode: string) => ipcRenderer.invoke('set-tracking-mode', mode),
  onTrackingStatusChange: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('tracking-status-changed', handler);
    return () => { ipcRenderer.removeListener('tracking-status-changed', handler); };
  },

  // Clear all stored data
  clearData: () => ipcRenderer.invoke('clear-data'),

  // Clear only today's data (preserve history)
  clearToday: () => ipcRenderer.invoke('clear-today'),

  // Get database file path
  getDbPath: () => ipcRenderer.invoke('get-db-path'),

  // Get storage status and health
  getStorageStatus: () => ipcRenderer.invoke('get-storage-status'),

  // Get user preferences
  getPreferences: () => ipcRenderer.invoke('get-preferences'),

  // Get single user preference (R-10: boot animation config)
  getPreference: (key: string) => ipcRenderer.invoke('get-preference', key),

  // Set user preference
  setPreference: (key: string, value: any) => ipcRenderer.invoke('set-preference', key, value),

  // Speech-to-Text (API primary + Windows native fallback)
  sttGetStatus: () => ipcRenderer.invoke('stt:get-status'),
  sttTranscribe: (payload: { audioBase64: string; mime?: string; lang?: string }) => ipcRenderer.invoke('stt:transcribe', payload),
  sttNativeStart: (lang?: string) => ipcRenderer.invoke('stt:native-start', lang),
  sttNativeStop: () => ipcRenderer.invoke('stt:native-stop'),
  onSttNativeEvent: (callback: (ev: { type: string; text?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('stt-native-event', handler);
    return () => {
      ipcRenderer.removeListener('stt-native-event', handler);
    };
  },

  // STT transcript persistence (SQLite)
  sttTranscriptList: () => ipcRenderer.invoke('stt:transcript-list'),
  sttTranscriptSave: (entry: any) => ipcRenderer.invoke('stt:transcript-save', entry),
  sttTranscriptUpdate: (id: string, changes: any) => ipcRenderer.invoke('stt:transcript-update', id, changes),
  sttTranscriptRemove: (id: string) => ipcRenderer.invoke('stt:transcript-remove', id),
  sttTranscriptToggleFavorite: (id: string) => ipcRenderer.invoke('stt:transcript-toggle-favorite', id),

  // ── Local STT overlay (R-46/R-47/R-48) ──
  sttLocalStatus: () => ipcRenderer.invoke('stt:local-status'),
  sttLocalStartRecording: () => ipcRenderer.invoke('stt:local-start-recording'),
  sttLocalStopRecording: () => ipcRenderer.invoke('stt:local-stop-recording'),
  sttLocalVocabAdd: (entry: any) => ipcRenderer.invoke('stt:local-vocab-add', entry),
  sttLocalVocabRemove: (canonical: string) => ipcRenderer.invoke('stt:local-vocab-remove', canonical),
  sttLocalVocabLoad: (filePath?: string) => ipcRenderer.invoke('stt:local-vocab-load', filePath),
  sttGetRegisteredShortcut: () => ipcRenderer.invoke('stt:get-registered-shortcut'),
  sttRegisterShortcut: (shortcut: string) => ipcRenderer.invoke('stt:register-shortcut', shortcut),
  onSttShortcutTriggered: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('stt:shortcut-triggered', handler);
    return () => { ipcRenderer.removeListener('stt:shortcut-triggered', handler); };
  },

  // Keyboard shortcuts
  getKeyboardShortcuts: () => ipcRenderer.invoke('get-keyboard-shortcuts'),
  setKeyboardShortcuts: (shortcuts: Record<string, string>) => ipcRenderer.invoke('set-keyboard-shortcuts', shortcuts),
  // Keyboard shortcuts

  // Set custom path for an AI agent plugin
  setAIAgentCustomPath: (pluginId: string, dirPath: string) => ipcRenderer.invoke('set-ai-agent-custom-path', pluginId, dirPath),
  getAIAgentCustomPaths: () => ipcRenderer.invoke('get-ai-agent-custom-paths'),

  // Browser tracking methods (optional period filter and dateOffset)
  getBrowserLogs: (period: string, dateOffset = 0) => ipcRenderer.invoke('get-browser-logs', period, dateOffset),

  getBrowserDomainStats: (period: string, dateOffset = 0) => ipcRenderer.invoke('get-browser-domain-stats', period, dateOffset),

  getBrowserCategoryStats: (period: string, dateOffset = 0) => ipcRenderer.invoke('get-browser-category-stats', period, dateOffset),
  setBrowserTracking: (enabled: boolean) => ipcRenderer.invoke('set-browser-tracking', enabled),
  getBrowserTrackingStatus: () => ipcRenderer.invoke('get-browser-tracking-status'),
  setBrowserExcludedDomains: (domains: string[]) => ipcRenderer.invoke('set-browser-excluded-domains', domains),
  setRecordingMode: (type: 'browser' | 'app', mode: 'always' | 'on-view') => ipcRenderer.invoke('set-recording-mode', { type, mode }),
  getRecordingModes: () => ipcRenderer.invoke('get-recording-modes'),
  setPageVisibility: (page: 'browser' | 'dashboard', visible: boolean) => ipcRenderer.invoke('set-page-visibility', { page, visible }),
  setBrowserWithExtension: (browser: string) => ipcRenderer.invoke('set-browser-with-extension', browser),
  setBrowsersWithExtension: (browsers: string[]) => ipcRenderer.invoke('set-browsers-with-extension', browsers),

  // AI Context Captures (external AI conversations from browser extension)
  aiContextList: (opts?: { provider?: string; search?: string; limit?: number; offset?: number }) => ipcRenderer.invoke('ai-context:list', opts || {}),
  aiContextStats: () => ipcRenderer.invoke('ai-context:stats'),
  aiContextDelete: (id: number) => ipcRenderer.invoke('ai-context:delete', id),
  aiContextClear: (provider?: string) => ipcRenderer.invoke('ai-context:clear', provider),
  onAiContextCaptured: (cb: (data: { count: number }) => void) => { ipcRenderer.on('ai-context-captured', (_e, data) => cb(data)); },
  aiContextGetBrainLinks: (captureId: number) => ipcRenderer.invoke('ai-context:get-brain-links', captureId),
  aiContextTopics: () => ipcRenderer.invoke('ai-context:topics'),
  aiContextUpdate: (id: number, metadata: any) => ipcRenderer.invoke('ai-context:update', id, metadata),
  aiContextGroups: () => ipcRenderer.invoke('ai-context:groups'),
  aiContextGroupCreate: (name: string, color?: string) => ipcRenderer.invoke('ai-context:group-create', name, color),
  aiContextGroupRename: (id: number, name: string) => ipcRenderer.invoke('ai-context:group-rename', id, name),
  aiContextGroupDelete: (id: number) => ipcRenderer.invoke('ai-context:group-delete', id),
  extensionQueueCommand: (cmd: any) => ipcRenderer.invoke('extension:queue-command', cmd),

  // Game detection - rescan Steam library
  rescanGames: () => ipcRenderer.invoke('rescan-games'),

  // Get tracked browsers (apps categorized as Browser)
  getTrackedBrowsers: () => ipcRenderer.invoke('get-tracked-browsers'),
  getAvailableBrowsers: () => ipcRenderer.invoke('get-available-browsers'),

  // Browser profile management
  getBrowserProfiles: () => ipcRenderer.invoke('get-browser-profiles'),
  toggleBrowserProfile: (args: { profileId: number; isActive: boolean }) => ipcRenderer.invoke('toggle-browser-profile', args),
  renameBrowserProfile: (args: { profileId: number; newName: string }) => ipcRenderer.invoke('rename-browser-profile', args),
  deleteBrowserProfile: (args: { profileId: number }) => ipcRenderer.invoke('delete-browser-profile', args),
  setBrowserProfileColor: (args: { profileId: number; color: string }) => ipcRenderer.invoke('set-browser-profile-color', args),
  upsertBrowserProfile: (args: { browserName: string; profileId: string; profileName: string; browserVersion?: string }) => ipcRenderer.invoke('upsert-browser-profile', args),
  updateBrowserProfileApp: (args: { profileId: number; knownAppName: string }) => ipcRenderer.invoke('update-browser-profile-app', args),

  // Productivity tracking
  getDailyProductivity: (date: string) => ipcRenderer.invoke('get-daily-productivity', date),
  getProductivityRange: (startDate: string, endDate: string) => ipcRenderer.invoke('get-productivity-range', startDate, endDate),

  // Clean corrupted data
  cleanCorruptedData: () => ipcRenderer.invoke('clean-corrupted-data'),

  // Deep cleanup and rebuild
  deepCleanAndRebuild: () => ipcRenderer.invoke('deep-clean-and-rebuild'),

  // Database schema and table management
  migrateToAggregates: () => ipcRenderer.invoke('migrate-to-aggregates'),
  getDailyAggregates: () => ipcRenderer.invoke('get-daily-aggregates'),
  getBrowserSessions: () => ipcRenderer.invoke('get-browser-sessions'),
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  getTableSchema: (tableName: string) => ipcRenderer.invoke('get-table-schema', tableName),
  getDatabaseTables: () => ipcRenderer.invoke('get-database-tables'),
  getTableData: (tableName: string, limit?: number, offset?: number) => ipcRenderer.invoke('get-table-data', tableName, limit, offset),
  getTableDataCount: (tableName: string) => ipcRenderer.invoke('get-table-data-count', tableName),
  getTableChanges: (tableName: string, limit?: number) => ipcRenderer.invoke('get-table-changes', tableName, limit),
  updateCategoriesFromOverrides: (appOverrides: Record<string, string>, domainOverrides: Record<string, string>) => 
    ipcRenderer.invoke('update-categories-from-overrides', appOverrides, domainOverrides, false),
  previewCategoriesFromOverrides: (appOverrides: Record<string, string>, domainOverrides: Record<string, string>) => 
    ipcRenderer.invoke('update-categories-from-overrides', appOverrides, domainOverrides, true),

  // Productivity sessions
  saveProductivitySession: (session: { started_at: string; ended_at?: string; duration_seconds?: number; app_name?: string; category?: string; is_streak?: boolean }) =>
    ipcRenderer.invoke('save-productivity-session', session),
  getProductivitySessions: (opts?: { period?: 'today' | 'week' | 'month' | 'all'; minDuration?: number; limit?: number; offset?: number }) =>
    ipcRenderer.invoke('get-productivity-sessions', opts || {}),
  clearProductivitySessions: () => ipcRenderer.invoke('clear-productivity-sessions'),
  getLongestFocus: () => ipcRenderer.invoke('get-longest-focus'),
  getCurrentForeground: () => ipcRenderer.invoke('get-current-foreground'),

  // App control
  quitApp: () => ipcRenderer.invoke('quit-app'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  windowIsFocused: () => ipcRenderer.invoke('window:isFocused'),
  onWindowFocusChange: (callback: (focused: boolean) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('window:focus-change', handler);
    return () => ipcRenderer.removeListener('window:focus-change', handler);
  },
  // Title bar auto-hide mode
  getTitleBarMode: () => ipcRenderer.invoke('get-title-bar-mode'),
  setTitleBarMode: (mode: 'always' | 'hover' | 'auto') => ipcRenderer.invoke('set-title-bar-mode', mode),
  notifyClick: () => ipcRenderer.invoke('notification-click'),
  getAutoStartStatus: () => ipcRenderer.invoke('get-auto-start-status'),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('set-auto-start', enabled),

  // Category Configuration
  getCategoryConfig: () => ipcRenderer.invoke('get-category-config'),
  setAppCategory: (appName: string, category: string) => ipcRenderer.invoke('set-app-category', appName, category),
  setDomainCategory: (domain: string, category: string) => ipcRenderer.invoke('set-domain-category', domain, category),
  setAppTier: (appName: string, tier: string) => ipcRenderer.invoke('set-app-tier', appName, tier),
  setDomainTier: (domain: string, tier: string) => ipcRenderer.invoke('set-domain-tier', domain, tier),
  clearAppTier: (appName: string) => ipcRenderer.invoke('clear-app-tier', appName),
  clearDomainTier: (domain: string) => ipcRenderer.invoke('clear-domain-tier', domain),
  getAppTierMap: () => ipcRenderer.invoke('get-app-tier-map'),
  getDomainTierMap: () => ipcRenderer.invoke('get-domain-tier-map'),
  setTierAssignments: (assignments: { productive: string[]; neutral: string[]; distracting: string[] }) => ipcRenderer.invoke('set-tier-assignments', assignments),
  applyCategoryToHistorical: (tierAssignments: any) => ipcRenderer.invoke('apply-category-to-historical', tierAssignments),
  getTierAssignments: () => ipcRenderer.invoke('get-tier-assignments'),
  getDefaultCategories: () => ipcRenderer.invoke('get-default-categories'),
  addCategory: (name: string) => ipcRenderer.invoke('add-category', name),
  removeCategory: (name: string) => ipcRenderer.invoke('remove-category', name),
  setDomainDefaultCategory: (domain: string, category: string) => ipcRenderer.invoke('set-domain-default-category', domain, category),
  getDomainDefaultCategory: (domain: string) => ipcRenderer.invoke('get-domain-default-category', domain),
  
  // Locked items & AI change history
  getLockedItems: () => ipcRenderer.invoke('get-locked-items'),
  setLockedItems: (items: { lockedApps?: Record<string, boolean>; lockedDomains?: Record<string, boolean> }) => ipcRenderer.invoke('set-locked-items', items),
  getAiChangeHistory: () => ipcRenderer.invoke('get-ai-change-history'),
  addAiChangeHistory: (entry: { name: string; type: 'app' | 'domain'; previousCategory: string; newCategory: string; source: 'ai' | 'manual' }) => ipcRenderer.invoke('add-ai-change-history', entry),
  undoAiChange: (changeId: string) => ipcRenderer.invoke('undo-ai-change', changeId),
  redoAiChange: (change: { name: string; type: 'app' | 'domain'; previousCategory: string; newCategory: string; source: 'ai' | 'manual' }) => ipcRenderer.invoke('redo-ai-change', change),
  clearAiChangeHistory: () => ipcRenderer.invoke('clear-ai-change-history'),
  
  // NEW: Keyword-based productivity categorization
  getDomainKeywordRules: (domain: string) => ipcRenderer.invoke('get-domain-keyword-rules', domain),
  setDomainKeywordRules: (domain: string, keywordSets: { category: string; keywords: string[] }[]) => ipcRenderer.invoke('set-domain-keyword-rules', domain, keywordSets),
  getKeywordEnabledDomains: () => ipcRenderer.invoke('get-keyword-enabled-domains'),
  addKeywordDomain: (domain: string, keywordSets: { category: string; keywords: string[] }[]) => ipcRenderer.invoke('add-keyword-domain', domain, keywordSets),
  removeKeywordDomain: (domain: string) => ipcRenderer.invoke('remove-keyword-domain', domain),

  // ========== Word Tracker ==========
  wordTrackerGetWords: () => ipcRenderer.invoke('wordTrackerGetWords'),
  wordTrackerAddWord: (word: string, label?: string, color?: string, tolerance?: string) => ipcRenderer.invoke('wordTrackerAddWord', word, label, color, tolerance),
  wordTrackerRemoveWord: (wordId: number) => ipcRenderer.invoke('wordTrackerRemoveWord', wordId),
  wordTrackerToggleWord: (wordId: number, enabled: number) => ipcRenderer.invoke('wordTrackerToggleWord', wordId, enabled),
  wordTrackerSetTolerance: (wordId: number, tolerance: string) => ipcRenderer.invoke('wordTrackerSetTolerance', wordId, tolerance),
  wordTrackerEditWord: (wordId: number, updates: any) => ipcRenderer.invoke('wordTrackerEditWord', wordId, updates),
  wordTrackerCounts: (projectId?: string) => ipcRenderer.invoke('wordTrackerCounts', projectId),
  wordTrackerCountsByProject: (wordId: number) => ipcRenderer.invoke('wordTrackerCountsByProject', wordId),
  wordTrackerGetConfig: (key: string) => ipcRenderer.invoke('wordTrackerGetConfig', key),
  wordTrackerSetConfig: (key: string, value: any) => ipcRenderer.invoke('wordTrackerSetConfig', key, value),
  wordTrackerResetCounts: () => ipcRenderer.invoke('wordTrackerResetCounts'),
  wordTrackerScanJsonl: (projectId?: string) => ipcRenderer.invoke('wordTrackerScanJsonl', projectId),
  wordTrackerCountText: (text: string, projectId?: string) => ipcRenderer.invoke('wordTrackerCountText', text, projectId),

  // AI Features
  generateAIColors: (apps: string[]) => ipcRenderer.invoke('generate-ai-colors', apps),
  generateAICategorization: (items: Array<{name: string, category: string}>) => ipcRenderer.invoke('generate-ai-categorization', items),
  testOpenRouterKey: () => ipcRenderer.invoke('test-openrouter-key'),
  summarizeWithLLM: (prompt: string, options?: { maxTokens?: number; model?: string }) =>
    ipcRenderer.invoke('summarize-with-llm', prompt, options),

  // AI Digest & Config Features
  getTopicDigest: (opts?: { force?: boolean }) => ipcRenderer.invoke('get-topic-digest', opts),
  isDigestGenerating: () => ipcRenderer.invoke('is-digest-generating'),
  onDigestGenerationComplete: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('digest-generation-complete', handler);
    return () => ipcRenderer.removeListener('digest-generation-complete', handler);
  },
  getAiConfig: () => ipcRenderer.invoke('get-ai-config'),
  saveAiConfig: (config: { apiKey?: string; enabled?: boolean; briefModel?: string; weeklyModel?: string; digestModel?: string; anomalyModel?: string; autoGenerateBrief?: boolean }) => ipcRenderer.invoke('save-ai-config', config),
  getInterestTopics: () => ipcRenderer.invoke('get-interest-topics'),
  addInterestTopic: (topic: string) => ipcRenderer.invoke('add-interest-topic', topic),
  removeInterestTopic: (topic: string) => ipcRenderer.invoke('remove-interest-topic', topic),

  // Knowledge Base (R5: self-contained context/RAG — deskflow-kb.json + BM25)
  kbIngest: (file: { name: string; type: string; content: string }) => ipcRenderer.invoke('kb:ingest', file),
  kbQuery: (query: string, limit?: number) => ipcRenderer.invoke('kb:query', query, limit),
  kbList: () => ipcRenderer.invoke('kb:list'),
  kbRemove: (docId: string) => ipcRenderer.invoke('kb:remove', docId),

  // Feature Studio: AI Director pipeline (runs provider chain via main process)
  featureStudioCompile: (script: string) => ipcRenderer.invoke('feature-studio:compile', { script }),

  // Overlay Studio: auto-transcribe video/audio via faster-whisper
  overlayStudioTranscribe: (payload: { filePath: string }) => ipcRenderer.invoke('overlay-studio:transcribe', payload),

  // Content Engine: ideas/themes/scripts/gates/seo/analytics/lessons/frameworks
  contentEngine: {
    ideasList: () => ipcRenderer.invoke('content:ideas:list'),
    ideaSave: (idea: any) => ipcRenderer.invoke('content:ideas:save', idea),
    ideaDelete: (id: number) => ipcRenderer.invoke('content:ideas:delete', id),
    episodesList: (opts?: any) => ipcRenderer.invoke('content:episodes:list', opts),
    episodeGet: (id: number) => ipcRenderer.invoke('content:episodes:get', id),
    episodeSave: (ep: any) => ipcRenderer.invoke('content:episodes:save', ep),
    episodeDelete: (id: number) => ipcRenderer.invoke('content:episodes:delete', id),
    episodeLinkOverlay: (payload: any) => ipcRenderer.invoke('content:episodes:link-overlay', payload),
    editCaption: (payload: any) => ipcRenderer.invoke('content:edit:caption', payload),
    // Overlay sessions (always belong to an episode)
    overlaySessionCreate: (payload: any) => ipcRenderer.invoke('overlay:session:create', payload),
    overlaySessionGet: (id: string) => ipcRenderer.invoke('overlay:session:get', id),
    overlaySessionList: (opts?: any) => ipcRenderer.invoke('overlay:session:list', opts),
    overlaySessionUpdate: (id: string, updates: any) => ipcRenderer.invoke('overlay:session:update', id, updates),
    overlaySessionDelete: (id: string) => ipcRenderer.invoke('overlay:session:delete', id),
    episodeGetOverlay: (episodeId: number) => ipcRenderer.invoke('episode:get-overlay', episodeId),
    scriptGenerate: (payload: any) => ipcRenderer.invoke('content:script:generate', payload),
    scriptRegenerateLine: (payload: any) => ipcRenderer.invoke('content:script:regenerate-line', payload),
    validateScriptEvidence: (payload: any) => ipcRenderer.invoke('content:validate-script-evidence', payload),
    validateGates: (payload: any) => ipcRenderer.invoke('content:validate-gates', payload),
    gateOverride: (payload: any) => ipcRenderer.invoke('content:gate-override', payload),
    injectSeo: (payload: any) => ipcRenderer.invoke('content:inject-seo', payload),
    synthesizeIdeas: (payload?: any) => ipcRenderer.invoke('ideas:synthesize', payload),
    brainstormClassify: (payload: any) => ipcRenderer.invoke('content:brainstorm:classify', payload),
    brainstormSummary: (payload?: any) => ipcRenderer.invoke('content:brainstorm:summary', payload),
    themesCreate: (theme: any) => ipcRenderer.invoke('themes:create', theme),
    themesGenerate: (payload?: any) => ipcRenderer.invoke('themes:generate', payload),
    themesGetAll: () => ipcRenderer.invoke('themes:get-all'),
    themesApply: (payload: any) => ipcRenderer.invoke('themes:apply', payload),
    themesDelete: (id: number) => ipcRenderer.invoke('themes:delete', id),
    analyticsGet: (payload?: any) => ipcRenderer.invoke('content:analytics:get', payload),
    analyticsUpsertVideo: (video: any) => ipcRenderer.invoke('content:analytics:upsert-video', video),
    analyticsDeleteVideo: (id: number) => ipcRenderer.invoke('content:analytics:delete-video', id),
    analyticsInsight: (payload?: any) => ipcRenderer.invoke('content:analytics:insight', payload),
    lessonsList: () => ipcRenderer.invoke('content:lessons:list'),
    lessonSave: (lesson: any) => ipcRenderer.invoke('content:lessons:save', lesson),
    lessonDelete: (id: number) => ipcRenderer.invoke('content:lessons:delete', id),
    lessonExtract: (payload: any) => ipcRenderer.invoke('content:lessons:extract', payload),
    lessonConfirm: (payload: any) => ipcRenderer.invoke('content:lessons:confirm', payload),
    frameworksList: () => ipcRenderer.invoke('content:frameworks:list'),
    frameworkSave: (fw: any) => ipcRenderer.invoke('content:frameworks:save', fw),
    frameworkRollback: (payload: any) => ipcRenderer.invoke('content:frameworks:rollback', payload),
    reflectionSave: (payload: any) => ipcRenderer.invoke('content:reflection:save', payload),
    reflectionGet: (payload?: any) => ipcRenderer.invoke('content:reflection:get', payload),
    reflectionAnalyze: (payload: any) => ipcRenderer.invoke('content:reflection:analyze', payload),
    characteristicsGet: (payload: any) => ipcRenderer.invoke('content:characteristics:get', payload),
    characteristicsSave: (payload: any) => ipcRenderer.invoke('content:characteristics:save', payload),
    // Series
    seriesList: () => ipcRenderer.invoke('content:series:list'),
    seriesGet: (id: number) => ipcRenderer.invoke('content:series:get', id),
    seriesSave: (s: any) => ipcRenderer.invoke('content:series:save', s),
    seriesDelete: (id: number) => ipcRenderer.invoke('content:series:delete', id),
    seriesAddEpisode: (payload: any) => ipcRenderer.invoke('content:series:add-episode', payload),
    seriesRemoveEpisode: (payload: any) => ipcRenderer.invoke('content:series:remove-episode', payload),
    analyticsParseRaw: (payload: any) => ipcRenderer.invoke('content:analytics:parse-raw', payload),
    scoringSchemes: () => ipcRenderer.invoke('content:scoring:schemes'),
    scoringCurrent: (payload: any) => ipcRenderer.invoke('content:scoring:current', payload),
    scoringCalibrate: (payload: any) => ipcRenderer.invoke('content:scoring:calibrate', payload),
    processTimeline: (payload?: any) => ipcRenderer.invoke('content:process:timeline', payload),
    processLog: (payload: any) => ipcRenderer.invoke('content:process:log', payload),
    processSummary: (payload: any) => ipcRenderer.invoke('content:process:summary', payload),
    processGallery: () => ipcRenderer.invoke('content:process:gallery'),
    takesList: (payload: any) => ipcRenderer.invoke('content:takes:list', payload),
    takeSave: (payload: any) => ipcRenderer.invoke('content:takes:save', payload),
    takeDelete: (id: number) => ipcRenderer.invoke('content:takes:delete', id),
    takeImport: (payload: any) => ipcRenderer.invoke('content:takes:import', payload),
    takeTranscribe: (payload: any) => ipcRenderer.invoke('content:takes:transcribe', payload),
    takeSaveSegments: (payload: any) => ipcRenderer.invoke('content:takes:save-segments', payload),
    takeSegments: (payload: any) => ipcRenderer.invoke('content:takes:segments', payload),
    takeSelect: (payload: any) => ipcRenderer.invoke('content:takes:select', payload),
    takeEvaluate: (payload: any) => ipcRenderer.invoke('content:takes:evaluate', payload),
    editCutlist: (payload: any) => ipcRenderer.invoke('content:edit:cutlist', payload),
    editOverlayPlan: (payload: any) => ipcRenderer.invoke('content:edit:overlay-plan', payload),
    analyticsCorrelate: () => ipcRenderer.invoke('content:analytics:correlate'),
  },

  // File operations
  saveFile: (options: { content: string; filename: string; fileType: string }) => ipcRenderer.invoke('save-file', options),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),

  // MCP library integration
  mcpListTools: (serverId: string) => ipcRenderer.invoke('mcp-list-tools', serverId),
  mcpCallTool: (serverId: string, toolName: string, args: Record<string, any>) =>
    ipcRenderer.invoke('mcp-call-tool', serverId, toolName, args),
  mcpStartServer: (serverId: string) => ipcRenderer.invoke('mcp-start-server', serverId),
  mcpStopServer: (serverId: string) => ipcRenderer.invoke('mcp-stop-server', serverId),
  // Aceternity UI registry
  aceternityFetchRegistry: () => ipcRenderer.invoke('aceternity-fetch-registry'),
  aceternityFetchComponent: (slug: string) => ipcRenderer.invoke('aceternity-fetch-component', { slug }),
  aceternityInstallComponent: (slug: string, cwd: string) => ipcRenderer.invoke('aceternity-install-component', slug, cwd),

  // MCP server status
  mcpServerStatus: (serverId: string) => ipcRenderer.invoke('mcp-server-status', serverId),
  // Refero design system library
  fetchReferoCatalog: (forceRefresh?: boolean, query?: string) =>
    ipcRenderer.invoke('fetch-refero-catalog', { forceRefresh, query }),
  fetchReferoSystem: (slug: string) => ipcRenderer.invoke('fetch-refero-system', { slug }),
  searchReferoSystems: (query: string) => ipcRenderer.invoke('search-refero-systems', { query }),
  // Design library config & cache
  getDesignLibraryConfig: () => ipcRenderer.invoke('get-design-library-config'),
  setDesignLibraryConfig: (config: any) => ipcRenderer.invoke('set-design-library-config', config),
  getDesignCachedData: (key: string) => ipcRenderer.invoke('get-design-cached-data', { key }),
  testDesignLibraryConnection: (serverId: string) => ipcRenderer.invoke('test-design-library-connection', { serverId }),

  // Design Suite
  designSuiteScrapeCari: (query: string) => ipcRenderer.invoke('design-suite:scrape-cari', { query }),
  designSuiteScrapeFontsInUse: (mood: string) => ipcRenderer.invoke('design-suite:scrape-fontsinuse', { mood }),
  designSuiteGetMotionTemplate: (id: string) => ipcRenderer.invoke('design-suite:get-motion-template', { id }),
  designSuiteListMotionTemplates: () => ipcRenderer.invoke('design-suite:list-motion-templates'),
  designSuiteInstallComponent: (registryUrl: string, projectPath: string) => ipcRenderer.invoke('design-suite:install-component', { registryUrl, projectPath }),
  designSuiteSyncTokens: (cssVariables: string, projectPath: string, targetFile: 'globals.css' | 'tailwind.config.js') => ipcRenderer.invoke('design-suite:sync-tokens', { cssVariables, projectPath, targetFile }),
  designSuiteGenerateColorUrl: (colors: { role: string; hex: string }[]) => ipcRenderer.invoke('design-suite:generate-color-url', { colors }),
  designSuiteParseColorUrl: (url: string) => ipcRenderer.invoke('design-suite:parse-color-url', { url }),
  designSuiteGenerateCssVars: (colors: { role: string; hex: string }[]) => ipcRenderer.invoke('design-suite:generate-css-vars', { colors }),

  // IDE Detection
  detectIDEs: () => ipcRenderer.invoke('detect-ides'),
  getIDEs: () => ipcRenderer.invoke('get-ides'),
  getExtensions: (ideId?: string) => ipcRenderer.invoke('get-extensions', ideId),

  // Tool Detection
  scanTools: () => ipcRenderer.invoke('scan-tools'),
  resetTools: () => ipcRenderer.invoke('reset-tools'),
  getTools: (category?: string) => ipcRenderer.invoke('get-tools', category),
  getToolCategories: () => ipcRenderer.invoke('get-tool-categories'),

  // Project Management
  addProject: (projectData: { name: string; path: string; repositoryUrl?: string; vcsType?: string; primaryLanguage?: string; defaultIde?: string }) =>
    ipcRenderer.invoke('add-project', projectData),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getAllProjects: () => ipcRenderer.invoke('get-all-projects'),
  updateProject: (projectId: string, updates: { name?: string; path?: string; repositoryUrl?: string; vcsType?: string; primaryLanguage?: string; defaultIde?: string }) =>
    ipcRenderer.invoke('update-project', projectId, updates),
  deleteProject: (projectId: string) => ipcRenderer.invoke('delete-project', projectId),
  restoreProject: (projectId: string) => ipcRenderer.invoke('restore-project', projectId),
  getProjectTools: (projectId: string) => ipcRenderer.invoke('get-project-tools', projectId),
  removeProject: (projectId: string) => ipcRenderer.invoke('remove-project', projectId),
  openProject: (projectId: string, ideId?: string) => ipcRenderer.invoke('open-project', projectId, ideId),
  detectProjectLanguage: (projectPath: string) => ipcRenderer.invoke('detect-project-language', projectPath),
  detectProjectsLanguages: (projectPaths: string[]) => ipcRenderer.invoke('detect-projects-languages', projectPaths),
  countProjectLines: (projectPath: string, projectId: string, options?: any) => ipcRenderer.invoke('count-project-lines', projectPath, projectId, options),
  getProjectLineStats: (projectId: string) => ipcRenderer.invoke('get-project-line-stats', projectId),
  deleteProjectLineStats: (projectId: string) => ipcRenderer.invoke('delete-project-line-stats', projectId),
  scanIdeDefaultProjects: () => ipcRenderer.invoke('scan-ide-default-projects'),
  scanCustomDirectory: (rootDir: string) => ipcRenderer.invoke('scan-custom-directory', rootDir),
  getCustomScanDirs: () => ipcRenderer.invoke('get-custom-scan-dirs'),
  saveCustomScanDirs: (dirs: string[]) => ipcRenderer.invoke('save-custom-scan-dirs', dirs),

  // Run Project Feature
  detectProjectScripts: (projectPath: string) => ipcRenderer.invoke('detect-project-scripts', projectPath),
  getProjectRunConfig: (projectId: string) => ipcRenderer.invoke('get-project-run-config', projectId),
  saveProjectRunConfig: (projectId: string, config: any) => ipcRenderer.invoke('save-project-run-config', projectId, config),
  runProject: (projectId: string, config: any) => ipcRenderer.invoke('run-project', projectId, config),
  executeProjectCommand: (terminalId: string, command: string) => ipcRenderer.invoke('execute-project-command', terminalId, command),
  stopProject: (terminalId: string) => ipcRenderer.invoke('stop-project', terminalId),
  getRunningProjects: () => ipcRenderer.invoke('get-running-projects'),
  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),

  // AI & Git Metrics
  getAIUsageSummary: (period?: string, dateOffset?: number, projectId?: string) => ipcRenderer.invoke('get-ai-usage-summary', period, dateOffset, projectId),
  getAIUsageDetails: (period?: string, dateOffset?: number) => ipcRenderer.invoke('get-ai-usage-details', period, dateOffset),
  getCommitStats: (projectId?: string, period?: 'week' | 'month') => ipcRenderer.invoke('get-commit-stats', projectId, period),

  // Dashboard Overview
  getIDEProjectsOverview: (period?: string, dateOffset?: number) => ipcRenderer.invoke('get-ide-projects-overview', period, dateOffset),
  getCodeChangeStats: (period?: string, dateOffset?: number, projectId?: string) => ipcRenderer.invoke('get-code-change-stats', period, dateOffset, projectId),
  getCodeActivityStats: (period?: string, dateOffset?: number, projectId?: string) => ipcRenderer.invoke('get-code-activity-stats', period, dateOffset, projectId),

  // AI Usage Sync
  syncAIUsage: () => ipcRenderer.invoke('sync-ai-usage'),
  getAISyncStatus: () => ipcRenderer.invoke('get-ai-sync-status'),
  clearAISyncState: () => ipcRenderer.invoke('clear-ai-sync-state'),
  getAISessionsPaginated: (tool: string, limit?: number, offset?: number) => ipcRenderer.invoke('get-ai-sessions-paginated', tool, limit, offset),
  getAISessionMessages: (sessionId: string, tool: string) => ipcRenderer.invoke('get-ai-session-messages', sessionId, tool),
  debugAIAgents: () => ipcRenderer.invoke('debug-ai-agents'),
  setHermesSessionsPath: (path: string) => ipcRenderer.invoke('set-hermes-sessions-path', path),
  onAISyncProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('ai-sync-progress', handler);
    return () => { ipcRenderer.removeListener('ai-sync-progress', handler); };
  },

  // Git & DORA Metrics
  syncCommits: (projectId: string, repoPath?: string) => ipcRenderer.invoke('sync-commits', projectId, repoPath),
  syncGitHubCommits: (projectId: string, owner: string, repo: string, token?: string) => 
    ipcRenderer.invoke('sync-github-commits', projectId, owner, repo, token),
  getDORAMetrics: (projectId: string, period?: 'week' | 'month') => ipcRenderer.invoke('get-dora-metrics', projectId, period),
  getCommitHistory: (projectId: string, limit?: number) => ipcRenderer.invoke('get-commit-history', projectId, limit),
  getContributorStats: (projectId: string) => ipcRenderer.invoke('get-contributor-stats', projectId),
  getGitDiff: (projectId: string, diffType?: 'cached' | 'working') => ipcRenderer.invoke('get-git-diff', projectId, diffType),

  // ========== Terminal Window ==========
  createTerminalWindow: () => ipcRenderer.invoke('create-terminal-window'),
  sendTerminalCommand: (cmd: string) => ipcRenderer.send('terminal-command', cmd),
  onTerminalOutput: (callback: (data: string) => void) => {
    const handler = (_event: any, data: string) => callback(data);
    ipcRenderer.on('terminal-output', handler);
    return () => ipcRenderer.removeListener('terminal-output', handler);
  },
  spawnTerminal: (terminalId: string, cwd?: string, agentType?: string, cols?: number, rows?: number) => ipcRenderer.invoke('spawn-terminal', terminalId, cwd, agentType, cols, rows),
  writeTerminal: (terminalId: string, data: string) => ipcRenderer.invoke('write-terminal', terminalId, data),
  resizeTerminal: (terminalId: string, cols: number, rows: number) => ipcRenderer.invoke('resize-terminal', terminalId, cols, rows),
  killTerminal: (terminalId: string) => ipcRenderer.invoke('kill-terminal', terminalId),
  getResourceStats: () => ipcRenderer.invoke('terminal:get-resource-stats'),
  getSystemStats: () => ipcRenderer.invoke('terminal:get-system-stats'),
  onResourceStats: (callback: (stats: Record<string, { pid: number | null; alive: boolean; memMB: number; cpuPct: number; eventLoopLagMs: number; ts: number }>) => void) => {
    const handler = (_event: any, stats: any) => callback(stats);
    ipcRenderer.on('terminal:resource-stats', handler);
    return () => ipcRenderer.removeListener('terminal:resource-stats', handler);
  },

  onTerminalData: (callback: (terminalId: string, data: string) => void) => {
    const handler = (_event: any, terminalId: string, data: string) => callback(terminalId, data);
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },
  onTerminalExit: (callback: (terminalId: string, exitCode: number, signal: string, intentional: boolean) => void) => {
    const handler = (_event: any, terminalId: string, exitCode: number, signal: string, intentional: boolean) => callback(terminalId, exitCode, signal, intentional);
    ipcRenderer.on('terminal:exit', handler);
    return () => ipcRenderer.removeListener('terminal:exit', handler);
  },

  // Conductor IPC
  conductorStart: (opts: any) => ipcRenderer.invoke('conductor:start', opts),
  conductorPause: (missionId: string) => ipcRenderer.invoke('conductor:pause', missionId),
  conductorResume: (missionId: string) => ipcRenderer.invoke('conductor:resume', missionId),
  conductorKill: (missionId: string) => ipcRenderer.invoke('conductor:kill', missionId),
  conductorSetAutonomy: (missionId: string, level: string) => ipcRenderer.invoke('conductor:set-autonomy', missionId, level),
  conductorSendDirective: (missionId: string, text: string) => ipcRenderer.invoke('conductor:send-directive', missionId, text),
  conductorResolveEscalation: (missionId: string, escalationId: string, decision: string, note?: string) => ipcRenderer.invoke('conductor:resolve-escalation', missionId, escalationId, decision, note),
  conductorPromoteIntegration: (missionId: string) => ipcRenderer.invoke('conductor:promote', missionId),
  conductorGetSnapshot: (missionId: string) => ipcRenderer.invoke('conductor:get-snapshot', missionId),
  conductorListMissions: () => ipcRenderer.invoke('conductor:list-missions'),
  onConductorSnapshot: (callback: (snapshot: any) => void) => {
    const handler = (_event: any, snapshot: any) => callback(snapshot);
    ipcRenderer.on('conductor:snapshot', handler);
    return () => ipcRenderer.removeListener('conductor:snapshot', handler);
  },
  onConductorMessage: (callback: (msg: any) => void) => {
    const handler = (_event: any, msg: any) => callback(msg);
    ipcRenderer.on('conductor:message', handler);
    return () => ipcRenderer.removeListener('conductor:message', handler);
  },

  // New Conductor IPC
  conductorGetConfig: (configType: string, projectId?: string) => ipcRenderer.invoke('conductor:get-config', configType, projectId),
  conductorSaveConfig: (configType: string, name: string, value: any, projectId?: string) => ipcRenderer.invoke('conductor:save-config', configType, name, value, projectId),
  conductorGetMetrics: (missionId: string) => ipcRenderer.invoke('conductor:get-metrics', missionId),
  conductorGetTemplates: () => ipcRenderer.invoke('conductor:get-templates'),
  conductorSaveTemplate: (template: any) => ipcRenderer.invoke('conductor:save-template', template),
  conductorGetProgress: (missionId: string) => ipcRenderer.invoke('conductor:get-progress', missionId),
  conductorGetBudget: (missionId: string) => ipcRenderer.invoke('conductor:get-budget', missionId),
  conductorRecoverAgent: (missionId: string, nodeId: string) => ipcRenderer.invoke('conductor:recover-agent', missionId, nodeId),
  conductorEnforceBoundary: (nodeId: string, filePath: string) => ipcRenderer.invoke('conductor:enforce-boundary', nodeId, filePath),
  conductorRegisterProvider: (config: any) => ipcRenderer.invoke('conductor:register-provider', config),
  conductorListProviders: () => ipcRenderer.invoke('conductor:list-providers'),
  conductorDeleteProvider: (providerId: string) => ipcRenderer.invoke('conductor:delete-provider', providerId),

  // AI Gateway — browser-automation provider access
  aigatewayListProviders: () => ipcRenderer.invoke('aigateway:list-providers'),
  aigatewayAllStatuses: () => ipcRenderer.invoke('aigateway:all-statuses'),
  aigatewayPlaywrightStatus: () => ipcRenderer.invoke('aigateway:playwright-status'),
  aigatewaySetupProvider: (providerId: string) => ipcRenderer.invoke('aigateway:setup-provider', providerId),
  aigatewayVerifySetup: (providerId: string) => ipcRenderer.invoke('aigateway:verify-setup', providerId),
  aigatewaySendPrompt: (opts: { provider: string; prompt: string; model?: string; timeoutMs?: number }) => ipcRenderer.invoke('aigateway:send-prompt', opts),
  aigatewayClearConversation: (providerId: string) => ipcRenderer.invoke('aigateway:clear-conversation', providerId),
  aigatewayCloseProvider: (providerId: string) => ipcRenderer.invoke('aigateway:close-provider', providerId),
  aigatewayLogoutProvider: (providerId: string) => ipcRenderer.invoke('aigateway:logout-provider', providerId),
  aigatewaySetDisabled: (providerId: string, disabled: boolean) => ipcRenderer.invoke('aigateway:set-disabled', providerId, disabled),
  aigatewayRecentRuns: (providerId: string, limit?: number) => ipcRenderer.invoke('aigateway:recent-runs', providerId, limit),
  onAIGatewayProviderStatus: (callback: (data: { provider: string; status?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('aigateway:provider-status', handler);
    return () => ipcRenderer.removeListener('aigateway:provider-status', handler);
  },
  onAIGatewaySessionExpired: (callback: (data: { provider: string; reason: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('aigateway:session-expired', handler);
    return () => ipcRenderer.removeListener('aigateway:session-expired', handler);
  },
  conductorGetMissionHistory: () => ipcRenderer.invoke('conductor:get-mission-history'),
  conductorEngineerWorkflow: (objective: string, templateId?: string) => ipcRenderer.invoke('conductor:engineer-workflow', objective, templateId),
  onConductorSpawnTerminal: (callback: (data: { terminalId: string; cwd: string; cols: number; rows: number; agentType?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('terminal:spawn-for-conductor', handler);
    return () => ipcRenderer.removeListener('terminal:spawn-for-conductor', handler);
  },

  // Consolidated Terminal API (new format — single arg objects)
  terminalWrite: (terminalId: string, data: string) => ipcRenderer.invoke('terminal:write-old-format', terminalId, data),
  terminalWriteRaw: (terminalId: string, data: string) => ipcRenderer.invoke('terminal:write-raw', terminalId, data),
  terminalResize: (terminalId: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
  terminalDestroy: (terminalId: string) => ipcRenderer.invoke('terminal:destroy-old-format', terminalId),
  onTerminalReady: (callback: (id: string) => void) => {
    const handler = (_event: any, id: string) => callback(id);
    ipcRenderer.on('terminal:ready', handler);
    return () => ipcRenderer.removeListener('terminal:ready', handler);
  },
  onAgentReady: (callback: (data: { terminalId: string }) => void) => {
    const handler = (_event: any, data: { terminalId: string }) => callback(data);
    ipcRenderer.on('agent:ready', handler);
    return () => ipcRenderer.removeListener('agent:ready', handler);
  },
  onAgentTimeout: (callback: (data: { terminalId: string; agentType: string }) => void) => {
    const handler = (_event: any, data: { terminalId: string; agentType: string }) => callback(data);
    ipcRenderer.on('agent:timeout', handler);
    return () => ipcRenderer.removeListener('agent:timeout', handler);
  },
  retryAgentInit: (terminalId: string, agentType: string) => ipcRenderer.invoke('retry-agent-init', terminalId, agentType),
  verifyAgent: (agentType: string) => ipcRenderer.invoke('agent:verify', agentType),
  armHandshake: (terminalId: string) => ipcRenderer.invoke('agent:arm-handshake', terminalId),
  agentSend: (terminalId: string, data: string, agentType?: string) => ipcRenderer.invoke('agent:send', terminalId, data, agentType),
  agentGetPhase: (terminalId: string) => ipcRenderer.invoke('agent:get-phase', terminalId),
  agentGetStatus: (terminalId: string) => ipcRenderer.invoke('agent:get-status', terminalId),
  getAgentConfig: (agentType?: string) => ipcRenderer.invoke('agent:config', agentType),
  onAgentSessionIdCaptured: (callback: (data: { terminalId: string; sessionId: string }) => void) => {
    const handler = (_event: any, data: { terminalId: string; sessionId: string }) => callback(data);
    ipcRenderer.on('agent:session-id-captured', handler);
    return () => ipcRenderer.removeListener('agent:session-id-captured', handler);
  },
  onAgentStatus: (callback: (data: { terminalId: string; phase: string; sessionId?: string | null; error?: string | null }) => void) => {
    const handler = (_event: any, data: { terminalId: string; phase: string; sessionId?: string | null; error?: string | null }) => callback(data);
    ipcRenderer.on('agent:status', handler);
    return () => ipcRenderer.removeListener('agent:status', handler);
  },
  onTerminalAnomaly: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('terminal:anomaly', handler);
    return () => ipcRenderer.removeListener('terminal:anomaly', handler);
  },
  onCliUpdateAvailable: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('cli:update-available', handler);
    return () => ipcRenderer.removeListener('cli:update-available', handler);
  },
  checkCliUpdates: () => ipcRenderer.invoke('cli:check-updates'),
  generateAgentConfigs: (opts: any) => ipcRenderer.invoke('config:generate', opts),
  previewAgentConfigs: (opts: any) => ipcRenderer.invoke('config:preview', opts),
  detectModels: (agentType?: string) => ipcRenderer.invoke('models:detect', agentType),
  setSessionModel: (terminalId: string, model: string, agentType?: string) => ipcRenderer.invoke('agent:set-model', terminalId, model, agentType),
  onModelChanged: (callback: (data: { terminalId: string; model: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('agent:model-changed', handler);
    return () => ipcRenderer.removeListener('agent:model-changed', handler);
  },

  getAgentPhase: (terminalId: string) => ipcRenderer.invoke('agent:get-phase', terminalId),
  retryAgentLaunch: (terminalId: string, agentType: string) => ipcRenderer.invoke('agent:retry-launch', terminalId, agentType),
  onAgentIdle: (callback: (data: { terminalId: string; seq: number }) => void) => {
    const handler = (_event: any, data: { terminalId: string; seq: number }) => callback(data);
    ipcRenderer.on('agent:idle', handler);
    return () => ipcRenderer.removeListener('agent:idle', handler);
  },
  onAgentInitError: (callback: (data: { terminalId: string; agentType: string; reason: string; detail: string; installHint?: string; hint?: string }) => void) => {
    const handler = (_event: any, data: { terminalId: string; agentType: string; reason: string; detail: string; installHint?: string; hint?: string }) => callback(data);
    ipcRenderer.on('agent:init-error', handler);
    return () => ipcRenderer.removeListener('agent:init-error', handler);
  },

  // ========== New Terminal API (node-pty based) ==========
  terminalAPI: {
    create: (id: string, cwd: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:create', id, cwd, cols, rows),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    destroy: (id: string) => ipcRenderer.invoke('terminal:destroy', id),
    exec: (command: string, cwd?: string, env?: Record<string, string>) => ipcRenderer.invoke('terminal:exec', command, cwd, env),
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_event: any, id: string, data: string) => callback(id, data);
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
    removeDataListener: () => {}
  },

  // ========== Terminal Presets ==========
  getTerminalPresets: (projectId?: string) => ipcRenderer.invoke('get-terminal-presets', projectId),
  addTerminalPreset: (preset: { projectId?: string; name: string; command: string; workingDirectory?: string; category?: string }) =>
    ipcRenderer.invoke('add-terminal-preset', preset),
  removeTerminalPreset: (presetId: string) => ipcRenderer.invoke('remove-terminal-preset', presetId),
  executeTerminalPreset: (presetId: string, terminalId?: string) => ipcRenderer.invoke('execute-terminal-preset', presetId, terminalId),
  saveTerminalPreset: (data: any) => ipcRenderer.invoke('save-terminal-preset', data),

  // ========== Terminal Layouts ==========
  saveTerminalLayout: (layout: { id?: string; name: string; layoutData: string; isActive?: boolean }) =>
    ipcRenderer.invoke('save-terminal-layout', layout),
  getTerminalLayouts: (projectId?: string) => ipcRenderer.invoke('get-terminal-layouts', projectId),
  deleteTerminalLayout: (layoutId: string) => ipcRenderer.invoke('delete-terminal-layout', layoutId),
  setActiveTerminalLayout: (layoutId: string) => ipcRenderer.invoke('set-active-terminal-layout', layoutId),

  // ========== Terminal Sessions (Resume) ==========
  saveTerminalSession: (session: { id?: string; projectId?: string; agent: string; resumeId?: string; topic?: string; workingDirectory?: string; totalTokens?: number; totalCost?: number; category?: string; status?: string; productArea?: string; description?: string; autoTags?: string[]; categoryConfirmed?: boolean }) =>
    ipcRenderer.invoke('save-terminal-session', session),
  getTerminalSessions: (projectId?: string, limit?: number) => ipcRenderer.invoke('get-terminal-sessions', projectId, limit),
  getTerminalMessages: (sessionId: string) => ipcRenderer.invoke('get-terminal-messages', sessionId),
  deleteTerminalSession: (sessionId: string) => ipcRenderer.invoke('delete-terminal-session', sessionId),
  getTerminalSessionResumeId: (sessionId: string) => ipcRenderer.invoke('get-terminal-session-resume-id', sessionId),
  getTerminalSessionById: (sessionId: string) => ipcRenderer.invoke('get-terminal-session-by-id', sessionId),
  checkSessionExists: (sessionId: string) => ipcRenderer.invoke('check-session-exists', sessionId),
  captureOpencodeSessionId: (workspaceDir: string, sinceTimestamp?: number, pid?: number) => ipcRenderer.invoke('capture-opencode-session-id', workspaceDir, sinceTimestamp, pid),
  listOpencodeSessions: (workspaceDir: string) => ipcRenderer.invoke('list-opencode-sessions', workspaceDir),
  terminalWriteDisplay: (terminalId: string, data: string) => ipcRenderer.invoke('terminal:write-display', terminalId, data),
  terminalLog: (...args: any[]) => ipcRenderer.invoke('terminal:log', ...args),
  updateSessionResumeId: (sessionId: string, resumeId: string) => ipcRenderer.invoke('update-session-resume-id', sessionId, resumeId),
  getSessionMessages: (sessionId: string, agentType?: string) => ipcRenderer.invoke('get-session-messages', sessionId, agentType),
  summarizeSession: (sessionId: string, projectPath?: string) => ipcRenderer.invoke('summarize-session', sessionId, projectPath),

  // ========== Context Maintenance ==========
  getContextSystems: (projectPath?: string) => ipcRenderer.invoke('get-context-systems', projectPath),

  // ========== System (Advanced Configuration / New Session) ==========
  system: {
    list: () => ipcRenderer.invoke("get-context-systems"),
    status: (data: any) => ipcRenderer.invoke("get-context-system-detail", data),
    verify: (data: any) => ipcRenderer.invoke("verify-system-integrity", data),
    getAgentsContext: (data: any) => ipcRenderer.invoke("read-agent-files", data),
    assemble: (data: any) => ipcRenderer.invoke("assemble-context", data),
    listInitFiles: (data: any) => ipcRenderer.invoke("list-init-files", data),
    readInitFile: (data: any) => ipcRenderer.invoke("read-init-file", data),
    getAgentFiles: (data: any) => ipcRenderer.invoke("read-agent-files", data),
    readAgentFile: (data: any) => ipcRenderer.invoke("read-agent-file", data),
    listSkills: (data: any) => ipcRenderer.invoke("get-skills", data),
  },
  getSessionSummaries: (opts?: { limit?: number; offset?: number }) => ipcRenderer.invoke('get-session-summaries', opts),
  getDeepMemory: () => ipcRenderer.invoke('get-deep-memory'),
  getRAGStats: (projectPath?: string) => ipcRenderer.invoke('get-rag-stats', projectPath),
  saveTerminalMessage: (data: { sessionId: string; role: 'user' | 'assistant' | 'system'; content: string }) =>
    ipcRenderer.invoke('save-terminal-message', data),
  getPromptHistory: (opts?: { projectId?: string; limit?: number }) => ipcRenderer.invoke('get-prompt-history', opts || {}),
  deleteTerminalMessage: (id: number) => ipcRenderer.invoke('delete-terminal-message', { id }),

  executeCommand: (command: string, cwd?: string) => ipcRenderer.invoke('electron:execute-command', command, cwd),

  // ========== Session Categorization ==========
  updateSessionCategory: (data: { sessionId: string; topic?: string; category?: string; productArea?: string; description?: string; status?: string; tags?: string[]; categoryConfirmed?: boolean }) =>
    ipcRenderer.invoke('update-session-category', data),
  getParsedSessionItems: (sessionId: string) => ipcRenderer.invoke('get-parsed-session-items', sessionId),
  analyzeSessionCategory: (sessionId: string) => ipcRenderer.invoke('analyze-session-category', sessionId),

  // ========== Session Config (Per-Session Initialize.md Customization) ==========
  saveSessionConfig: (sessionId: string, config: any, projectPath?: string) => ipcRenderer.invoke('save-session-config', { sessionId, config, projectPath }),
  loadSessionConfig: (sessionId: string, projectPath?: string) => ipcRenderer.invoke('load-session-config', { sessionId, projectPath }),
  listInitFiles: (projectPath?: string) => ipcRenderer.invoke('list-init-files', { projectPath }),
  readInitFile: (filename: string, projectPath?: string) => ipcRenderer.invoke('read-init-file', { filename, projectPath }),

  // ========== @mention Routing ==========
  resolveAtMention: (data: { input: string; terminalTabs: Array<{ id: string; name: string }> }) =>
    ipcRenderer.invoke('resolve-at-mention', data),

  // ========== Workspace TODOs ==========
  getWorkspaceTodos: (projectId?: string) => ipcRenderer.invoke('get-workspace-todos', projectId),
  addWorkspaceTodo: (data: { projectId?: string; text: string; priority?: string }) => ipcRenderer.invoke('add-workspace-todo', data),
  toggleWorkspaceTodo: (todoId: string) => ipcRenderer.invoke('toggle-workspace-todo', todoId),
  deleteWorkspaceTodo: (todoId: string) => ipcRenderer.invoke('delete-workspace-todo', todoId),

  // ========== Prompt Templates ==========
  getPromptTemplates: (projectId?: string) => ipcRenderer.invoke('get-prompt-templates', projectId),
  savePromptTemplate: (data: { id?: string; projectId?: string; name: string; content: string; category?: string; isFormattingTemplate?: boolean }) =>
    ipcRenderer.invoke('save-prompt-template', data),
  deletePromptTemplate: (templateId: string) => ipcRenderer.invoke('delete-prompt-template', templateId),

  // ========== Project File System ==========
  readProjectFile: (relativePath: string, projectPath?: string) => ipcRenderer.invoke('read-project-file', relativePath, projectPath),
  writeProjectFile: (relativePath: string, content: string, projectPath?: string) => ipcRenderer.invoke('write-project-file', relativePath, content, projectPath),
  listProjectFiles: (subDir?: string, projectPath?: string) => ipcRenderer.invoke('list-project-files', subDir, projectPath),
  listDirectory: (projectPath: string, relativePath: string) => ipcRenderer.invoke('list-directory', { projectPath, relativePath }),

  // ========== Project Health ==========
  calculateProjectHealth: (projectId: string) => ipcRenderer.invoke('calculate-project-health', projectId),
  getProjectDetails: (projectId: string) => ipcRenderer.invoke('get-project-details', projectId),

  // ========== External Tracker ==========
  // External Activities
  getExternalActivities: () => ipcRenderer.invoke('get-external-activities'),
  addExternalActivity: (activity: { name: string; type: string; color?: string; icon?: string; default_duration?: number }) =>
    ipcRenderer.invoke('add-external-activity', activity),
  updateExternalActivity: (id: string, updates: { name?: string; type?: string; color?: string; icon?: string; default_duration?: number; is_visible?: boolean; is_default?: boolean }) =>
    ipcRenderer.invoke('update-external-activity', id, updates),
  deleteExternalActivity: (id: string) => ipcRenderer.invoke('delete-external-activity', id),
  reorderExternalActivities: (ordered: Array<{ id: number; sort_order: number }>) => ipcRenderer.invoke('reorder-external-activities', ordered),

  // External Sessions
  startExternalSession: (activityId: string) => ipcRenderer.invoke('start-external-session', activityId),
  createExternalSessionsBatch: (segments: Array<{ activityId: string; startedAt: string; endedAt: string }>) => ipcRenderer.invoke('create-external-sessions-batch', { segments }),
  stopExternalSession: (sessionId: string, endTime?: string, deviceOffToSleepSeconds?: number, wakeUpToAppSeconds?: number) => ipcRenderer.invoke('stop-external-session', sessionId, endTime, deviceOffToSleepSeconds, wakeUpToAppSeconds),
  updateExternalSession: (sessionId: string, updates: { duration_seconds?: number; started_at?: string; ended_at?: string; activity_id?: number }) => ipcRenderer.invoke('update-external-session', sessionId, updates),
  deleteExternalSession: (sessionId: string) => ipcRenderer.invoke('delete-external-session', sessionId),
   getExternalSessions: (period: 'today' | 'week' | 'month' | 'all') => ipcRenderer.invoke('get-external-sessions', period),
   getActivityStats: (activityId: string) => ipcRenderer.invoke('get-activity-stats', activityId),
  getActiveExternalSession: () => ipcRenderer.invoke('get-active-external-session'),
  getMorningPrompt: () => ipcRenderer.invoke('get-morning-prompt'),
  dismissMorningPrompt: () => ipcRenderer.invoke('dismiss-morning-prompt'),
  addManualSleep: (sleepData: { started_at: string; ended_at: string; device_off_to_sleep_seconds?: number; wake_up_to_app_seconds?: number }) => ipcRenderer.invoke('add-manual-sleep', sleepData),
  getSleepForDate: (dateStr: string) => ipcRenderer.invoke('get-sleep-for-date', dateStr),
  updateManualSleep: (sessionId: string, sleepData: { started_at: string; ended_at: string; device_off_to_sleep_seconds?: number; wake_up_to_app_seconds?: number }) => ipcRenderer.invoke('update-manual-sleep', sessionId, sleepData),
  checkSleepDetection: () => ipcRenderer.invoke('check-sleep-detection'),
  confirmSleep: (sleepData: { started_at: string; ended_at: string; device_off_to_sleep_seconds: number; wake_up_to_app_seconds: number }) => ipcRenderer.invoke('confirm-sleep', sleepData),
  dismissSleepDetection: () => ipcRenderer.invoke('dismiss-sleep-detection'),
  computeAdjacentGaps: (params: { sleepStartIso: string; sleepEndIso: string }) => ipcRenderer.invoke('compute-adjacent-gaps', params),
  saveAfkQueue: (queue: any[]) => ipcRenderer.invoke('save-afk-queue', queue),
  loadAfkQueue: () => ipcRenderer.invoke('load-afk-queue'),
  clearAfkQueue: () => ipcRenderer.invoke('clear-afk-queue'),
  addExternalTime: (activityId: string, durationMinutes: number, started_at?: string, ended_at?: string) => ipcRenderer.invoke('add-external-time', { activityId, durationMinutes, started_at, ended_at }),
   getExternalStats: (period: 'today' | 'week' | 'month' | 'all') => ipcRenderer.invoke('get-external-stats', period),
   getSleepDebug: (period: string = 'week', dateOffset = 0) => ipcRenderer.invoke('get-sleep-debug', period, dateOffset),
   fixSleepDates: () => ipcRenderer.invoke('fix-sleep-dates'),
   getComparisonStats: (period: 'today' | 'week' | 'month' | 'all') => ipcRenderer.invoke('get-comparison-stats', period),
   updateActivityChartPreference: (activityId: string, chartType: string) => ipcRenderer.invoke('update-activity-chart-preference', activityId, chartType),
   getSleepTrends: (period: string, dateOffset = 0) => ipcRenderer.invoke('get-sleep-trends', period, dateOffset),
  getConsistencyScore: (period: 'week' | 'month') => ipcRenderer.invoke('get-consistency-score', period),
  getMomentumScore: (date?: string) => ipcRenderer.invoke('get-momentum-score', date),
  getExternalSettings: (key: string) => ipcRenderer.invoke('get-external-settings', key),
  setExternalSettings: (key: string, value: string) => ipcRenderer.invoke('set-external-settings', key, value),
  getTrackingSettings: () => ipcRenderer.invoke('get-tracking-settings'),
  setTrackingSetting: (key: string, value: string) => ipcRenderer.invoke('set-tracking-setting', key, value),
  
  // ========== Window State ==========
  getWindowState: () => ipcRenderer.invoke('get-window-state'),
  resetWindowState: () => ipcRenderer.invoke('reset-window-state'),
   getTypicalDay: (days?: number, dateOffset?: number) => ipcRenderer.invoke('get-typical-day', days, dateOffset),
   getTypicalActivityAtTime: (timestamp: string) => ipcRenderer.invoke('get-typical-activity-at-time', timestamp),
   detectUsageGaps: (options?: { period?: string; minGapMinutes?: number }) => ipcRenderer.invoke('detect-usage-gaps', options || {}),
   manualAssignList: (date: string) => ipcRenderer.invoke('manual-assign:list', { date }),
   manualAssignDayContext: (date: string) => ipcRenderer.invoke('manual-assign:day-context', { date }),
   manualAssignCreate: (data: { startedAt: string; endedAt: string; mode?: 'random' | 'custom'; app?: string | null; category?: string | null }) => ipcRenderer.invoke('manual-assign:create', data),
   manualAssignDelete: (id: number) => ipcRenderer.invoke('manual-assign:delete', { id }),
   getHourlyHeatmap: (days?: number) => ipcRenderer.invoke('get-hourly-heatmap', days),
  getBestDays: () => ipcRenderer.invoke('get-best-days'),
   getDayDetail: (date: string) => ipcRenderer.invoke('get-day-detail', date),
   getHourDetail: (date: string, hour: number) => ipcRenderer.invoke('get-hour-detail', date, hour),

   // ========== Workspace Save/Load (v2: named instances) ==========
    saveWorkspace: (data: {
       scope: 'session' | 'project' | 'global';
       projectId?: string;
       name?: string;
       sidebarWidth?: number;
       activeTab?: string;
       terminalTabs?: string[];
       layout?: any;
       openFiles?: string[];
       activeTerminalId?: string | null;
       todos?: any[];
       presets?: any[];
       terminalInfo?: any;
       configs?: any;
       contextConfig?: any;
       analyticsPeriod?: string;
       sessionCategoryFilter?: string;
       skillsActiveView?: string;
       mapListRatio?: number;
       theme?: any;
     }) => ipcRenderer.invoke('workspace:save', data),
    loadWorkspace: (data: {
       scope: 'session' | 'project' | 'global';
       projectId?: string;
       name?: string;
     }) => ipcRenderer.invoke('workspace:load', data),
    listWorkspaces: (data: { projectId: string }) => ipcRenderer.invoke('workspace:list', data),
    listAllWorkspaces: () => ipcRenderer.invoke('workspace:list-all'),
    deleteWorkspace: (data: { projectId: string; name: string }) => ipcRenderer.invoke('workspace:delete', data),

  // ========= Tracker Mind - Problem Management =========
  getProblems: (projectId?: string, projectPath?: string) => ipcRenderer.invoke('get-problems', { projectId, projectPath }),
  createProblem: (data: any) => ipcRenderer.invoke('create-problem', data),
  updateProblemStatus: (data: { problemId: string; status: string; projectId?: string; projectPath?: string }) =>
    ipcRenderer.invoke('update-problem-status', data),
  updateProblem: (data: { id: string; user_notes?: string; terminal_id?: string; title?: string; priority?: string; category?: string; description?: string; projectId?: string; projectPath?: string }) =>
    ipcRenderer.invoke('update-problem', data),
  deleteProblem: (problemId: string, projectId?: string) => ipcRenderer.invoke('delete-problem', { problemId, projectId }),
  assignProblemToTerminal: (data: {
    problemId: string;
    terminalId?: string;
    skillId?: string;
    systemPrompt?: string;
    projectId?: string;
  }) => ipcRenderer.invoke('assign-problem-to-terminal', data),
  // Bug Report bridges
  submitBugReport: (data: { projectId: string; title?: string; errorText: string }) =>
    ipcRenderer.invoke('bug-report:submit', data),
  listBugReports: (data: { projectId: string }) =>
    ipcRenderer.invoke('bug-report:list', data),
  getBugReport: (data: { id: string }) =>
    ipcRenderer.invoke('bug-report:get', data),
  autoConsultAgents: (data: { problemId: string; problemTitle: string; problemDescription: string; projectId?: string }) =>
    ipcRenderer.invoke('bug-report:auto-consult', data),
  investigateBugReport: (data: { bugReportId: string }) =>
    ipcRenderer.invoke('bug-report:investigate', data),
  getTerminalBindings: () => ipcRenderer.invoke('get-terminal-bindings'),
  getSkills: (projectPath?: string) => ipcRenderer.invoke('get-skills', { projectPath }),
  getAppSkills: () => ipcRenderer.invoke('get-app-skills'),
  addSkillToProject: (data: { skillId: string; projectPath: string }) => ipcRenderer.invoke('add-skill-to-project', data),
  seedWorkspaceSkills: (data: { sourceDir: string }) => ipcRenderer.invoke('seed-workspace-skills', data),
  getSavedSkills: () => ipcRenderer.invoke('get-saved-skills'),
  saveWorkspaceSkill: (data: { skillId: string }) => ipcRenderer.invoke('save-workspace-skill', data),
  unsaveWorkspaceSkill: (data: { skillId: string }) => ipcRenderer.invoke('unsave-workspace-skill', data),
  getWorkspaceSkills: (projectPath?: string) => ipcRenderer.invoke('get-workspace-skills', { projectPath }),
  createSkill: (data: { name: string; category: string; description: string; content: string; projectPath?: string }) => ipcRenderer.invoke('create-skill', data),
  updateSkill: (data: { id: string; name: string; category: string; description: string; content: string; projectPath?: string }) => ipcRenderer.invoke('update-skill', data),
  deleteSkill: (data: { id: string; projectPath?: string }) => ipcRenderer.invoke('delete-skill', data),
  syncProblemsMd: () => ipcRenderer.invoke('sync-problems-md'),
  trackerMindSetup: (step: string, projectId?: string, agentName?: string) => ipcRenderer.invoke('tracker-mind-setup', { step, projectId, agentName }),
  onTrackerMindInitProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('tracker-mind-init-progress', handler);
    return () => { ipcRenderer.removeListener('tracker-mind-init-progress', handler); };
  },
  logActivity: (data: { entityType: string; entityId: string; entityTitle?: string; action: string; actor: string; summary: string; details?: string }) =>
    ipcRenderer.invoke('log-activity', data),
  getActivityLog: (opts?: { entityType?: string; entityId?: string; limit?: number }) =>
    ipcRenderer.invoke('get-activity-log', opts),
  getAiContext: (opts?: { projectId?: string; since?: string; limit?: number }) =>
    ipcRenderer.invoke('get-ai-context', opts),
  // ========= Tracker Mind - Requests =========
  getRequests: (projectId?: string) => ipcRenderer.invoke('get-requests', { projectId }),

  createRequest: (data: { title: string; description?: string; priority?: string; category?: string; projectId?: string }) =>
    ipcRenderer.invoke('create-request', data),

  updateRequestStatus: (data: { requestId: string; status: string }) =>
    ipcRenderer.invoke('update-request-status', data),
  deleteRequest: (requestId: string, projectId?: string) => ipcRenderer.invoke('delete-request', { requestId, projectId }),
  linkProblemToRequest: (data: { requestId: string; problemId: string; projectId?: string }) =>
    ipcRenderer.invoke('link-problem-to-request', data),
  unlinkProblemFromRequest: (data: { requestId: string; problemId: string; projectId?: string }) =>
    ipcRenderer.invoke('unlink-problem-from-request', data),

  // ========= Tracker Mind - Terminal Binding =========
  registerTerminal: (data: { terminalId: string; projectId?: string; agentType?: string; status?: string }) =>
    ipcRenderer.invoke('register-terminal', data),
  updateTerminalBinding: (data: { terminalId: string; updates: { status?: string; active_problem_id?: string; session_context?: string } }) =>
    ipcRenderer.invoke('update-terminal-binding', data),
  saveTerminalBinding: (data: { terminalId: string; problemId?: string; sessionContext?: string; status?: string }) =>
    ipcRenderer.invoke('save-terminal-binding', data),
  getTerminalBinding: (terminalId: string) => ipcRenderer.invoke('get-terminal-binding', terminalId),
  sendInstructionsToTerminal: (data: { terminalId: string; instructions: string; linkedProblemId?: string; linkedRequestId?: string }) =>
    ipcRenderer.invoke('send-instructions-to-terminal', data),
  unregisterTerminal: (terminalId: string) => ipcRenderer.invoke('unregister-terminal', terminalId),
  // ========= Tracker Mind - Live Parsing =========
  watchAgentFiles: () => ipcRenderer.invoke('watch-agent-files'),
  onAgentFileChanged: (callback: (data: { file: string; mtime: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, file: string, mtime: string) => callback({ file, mtime });
    ipcRenderer.on('agent-file-changed', handler);
    return () => { ipcRenderer.removeListener('agent-file-changed', handler); };
  },
  onContextChanged: (callback: (data: { type: string; action: string; entity?: any }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('context-changed', handler);
    return () => { ipcRenderer.removeListener('context-changed', handler); };
  },
  onSessionMetadataUpdated: (callback: (data: { sessionId: string; metadata: any; autoTags: string[] }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('session-metadata-updated', handler);
    return () => { ipcRenderer.removeListener('session-metadata-updated', handler); };
  },
  onRecapProgress: (callback: (data: { month: string; stage: 'reading' | 'analyzing' | 'writing' | 'saving' | 'done' }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('finance:recap-progress', handler);
    return () => { ipcRenderer.removeListener('finance:recap-progress', handler); };
  },

  // ========= Agent Files (from project) =========
  readAgentFiles: (projectPath: string) => ipcRenderer.invoke('read-agent-files', projectPath),
  readAgentFile: (filePath: string, projectPath: string) => ipcRenderer.invoke('read-agent-file', filePath, projectPath),
  
  // ========= State Updates from AI =========
  updateStateFromAgent: (data: any) => ipcRenderer.invoke('update-state-from-agent', data),

  // ========= Progress JSON (AI reads/writes) =========
  readProgressJson: (projectPath?: string) => ipcRenderer.invoke('read-progress-json', { projectPath }),
  writeProgressJson: (projectPath?: string, data?: any) => ipcRenderer.invoke('write-progress-json', { projectPath, data }),

  // ========= Agent File Content Reader =========
  readAgentFileContent: (filename: string, projectPath?: string) => ipcRenderer.invoke('read-agent-file-content', { filename, projectPath }),
  listAgentDirFiles: (projectPath?: string) => ipcRenderer.invoke('list-agent-dir-files', { projectPath }),

  // ========= Base System Prompt Persistence =========
  saveBaseSystemPrompt: (agent: string, prompt: string) => ipcRenderer.invoke('save-base-system-prompt', { agent, prompt }),
  getBaseSystemPrompt: (agent: string) => ipcRenderer.invoke('get-base-system-prompt', agent),

  // ========= AI Task Progress Tracking =========
  getPromptStatus: (terminalId?: string) => ipcRenderer.invoke('get-prompt-status', terminalId),
  aiTaskWatch: (projectPath: string) => ipcRenderer.invoke('ai-task:watch', projectPath),
  aiTaskStopWatch: (projectPath: string) => ipcRenderer.invoke('ai-task:stop-watch', projectPath),
  aiTaskAdd: (task: { terminalId: string; prompt: string; agent: string; sessionId?: string; projectPath?: string }) => ipcRenderer.invoke('ai-task:add', task),
  onAiTaskUpdated: (callback: (data: { terminalId: string; status: string; messageId?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('ai-task:updated', handler);
    return () => { ipcRenderer.removeListener('ai-task:updated', handler); };
  },
  onAiTaskFileChanged: (callback: (data: { tasks: any[] }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('ai-task:file-changed', handler);
    return () => { ipcRenderer.removeListener('ai-task:file-changed', handler); };
  },

  // ========= Actions JSON Bridge =========
  writeAgentFile: (data: { relativePath: string; content: string }) =>
    ipcRenderer.invoke('write-agent-file', data),
  assembleContext: (data: { projectId: string; problemIds?: string[]; requestIds?: string[]; tokenBudget?: number; topic?: string; sessionId?: string }) =>
    ipcRenderer.invoke('assemble-context', data),
  writeAgentActions: (data: { projectPath: string; terminalId: string; actions: any[] }) =>
    ipcRenderer.invoke('write-agent-actions', data),
  setupActionsFileWatcher: (data: { projectPath: string; terminalId: string }) =>
    ipcRenderer.invoke('setup-actions-file-watcher', data),
  executeActionsFromFile: (data: { projectPath: string; terminalId: string }) =>
    ipcRenderer.invoke('execute-actions-from-file', data),

  // ========== Model Improvement Dashboard ==========
  getModelImprovementStats: (opts?: { terminalId?: string }) =>
    ipcRenderer.invoke('get-model-improvement-stats', opts ?? {}),
  setReinjectThreshold: (payload: { threshold: number }) =>
    ipcRenderer.invoke('set-reinject-threshold', payload),
  setModelDebug: (payload: { enabled: boolean }) =>
    ipcRenderer.invoke('set-model-debug', payload),
  readActionsErrorLog: () =>
    ipcRenderer.invoke('read-actions-error-log'),

  // ========== Auto-Assign Routing ==========
  routePrompt: (request: { prompt: string; projectPath?: string }) =>
    ipcRenderer.invoke('route-prompt', request),
  updateSessionSummary: (request: { sessionId: string; force?: boolean }) =>
    ipcRenderer.invoke('update-session-summary', request),
  getRoutingCosts: () =>
    ipcRenderer.invoke('get-routing-costs'),
  resetRoutingCosts: () =>
    ipcRenderer.invoke('reset-routing-costs'),
  getAutoAssignConfig: () =>
    ipcRenderer.invoke('get-auto-assign-config'),
  saveAutoAssignConfig: (config: any) =>
    ipcRenderer.invoke('save-auto-assign-config', config),

  // ========== Cross-Session Sync Config ==========
  getCrossSessionSyncConfig: () =>
    ipcRenderer.invoke('get-cross-session-sync-config'),
  setCrossSessionSyncConfig: (config: any) =>
    ipcRenderer.invoke('set-cross-session-sync-config', config),

  // ========== Cross-Session Sync ==========
  lockFile: (filePath: string, terminalId: string, sessionId?: string | null, action?: string) =>
    ipcRenderer.invoke('lock-file', filePath, terminalId, sessionId ?? null, action),
  releaseFileLock: (filePath: string, terminalId: string) =>
    ipcRenderer.invoke('release-file-lock', filePath, terminalId),
  getFileLocks: () =>
    ipcRenderer.invoke('get-file-locks'),
  getLocksForTerminal: (terminalId: string) =>
    ipcRenderer.invoke('get-locks-for-terminal', terminalId),
  getTouchedFiles: (opts?: { terminalId?: string; filePath?: string; limit?: number }) =>
    ipcRenderer.invoke('get-touched-files', opts),
  compileSyncSummary: (terminalId: string) =>
    ipcRenderer.invoke('compile-sync-summary', terminalId),
  broadcastContextDelta: (data: { terminalId: string; type: string; payload: any }) =>
    ipcRenderer.invoke('broadcast-context-delta', data),
  onFileConflict: (callback: (data: { filePath: string; requestingTerminal: string; lockingTerminal: string; sessionId: string | null; timestamp: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('file:conflict', handler);
    return () => { ipcRenderer.removeListener('file:conflict', handler); };
  },

  // ========== Checklist Feedback ==========
  addCheckFeedback: (data: {
    parentId: string;
    checkId: string;
    parentType: 'problem' | 'request';
    feedback: { type: 'approved' | 'rejected' | 'text'; value?: string; timestamp: string; session_id?: string; terminal_id?: string };
  }) => ipcRenderer.invoke('add-check-feedback', data),

  sendCheckFeedbackToTerminal: (data: {
    terminalId: string;
    checkId: string;
    checkDescription: string;
    feedback: { type: 'approved' | 'rejected' | 'text'; value?: string; timestamp: string };
    sessionId?: string;
  }) => ipcRenderer.invoke('send-check-feedback-to-terminal', data),

  // ========== Session Compaction ==========
  checkSessionCompaction: (data: { sessionId: string; messageThreshold?: number }) =>
    ipcRenderer.invoke('check-session-compaction', data),
  compactSession: (data: { sessionId: string; summaryPrompt?: string }) =>
    ipcRenderer.invoke('compact-session', data),

  // ========== Multi‑Provider AI / Goal Features ==========
  getAiProviders: () => ipcRenderer.invoke('get-ai-providers'),
  saveAiProviders: (state: any) => ipcRenderer.invoke('save-ai-providers', state),
  testAiProvider: (providerId: string) => ipcRenderer.invoke('test-ai-provider', providerId),

  // AI Chat persistence (AiPage)
  aiChatLoad: (threadDate: string) => ipcRenderer.invoke('ai-chat:load', threadDate),
  aiChatSave: (data: { threadDate: string; messages: Array<{ role: string; content: string; parsed_json?: string; timestamp?: number }> }) => ipcRenderer.invoke('ai-chat:save', data),
  aiChatReset: (threadDate: string) => ipcRenderer.invoke('ai-chat:reset', threadDate),
  aiChatListThreads: () => ipcRenderer.invoke('ai-chat:list-threads'),
  aiChatRenameThread: (threadDate: string, title: string) => ipcRenderer.invoke('ai-chat:rename', threadDate, title),
  aiChatGetMemories: (threadDate: string) => ipcRenderer.invoke('ai-chat:get-memories', threadDate),
  aiChatExtractMemories: (data: { threadDate: string; messages: Array<{ content: string; parsed?: any }> }) =>
    ipcRenderer.invoke('ai-chat:extract-memories', data),
  aiChatSend: (data: { threadDate: string; message: string; providerId?: string }) =>
    ipcRenderer.invoke('ai-chat:send', data),

  // ── Chat Library — unified store for every AI conversation ──────────────
  chatLibrarySearch: (opts?: { query?: string; groupId?: string | null; source?: string | null; limit?: number }) =>
    ipcRenderer.invoke('chat-library:search', opts || {}),
  chatLibraryStats: () => ipcRenderer.invoke('chat-library:stats'),
  chatLibraryGroups: () => ipcRenderer.invoke('chat-library:groups'),
  chatLibrarySaveGroup: (data: { id?: string; name: string; color?: string; sortOrder?: number }) =>
    ipcRenderer.invoke('chat-library:group-save', data),
  chatLibraryDeleteGroup: (id: string) => ipcRenderer.invoke('chat-library:group-delete', id),
  chatLibrarySetThreadGroup: (threadDate: string, groupId: string | null) =>
    ipcRenderer.invoke('chat-library:thread-group', { threadDate, groupId }),
  chatLibrarySetThreadPin: (threadDate: string, pinned: boolean) =>
    ipcRenderer.invoke('chat-library:thread-pin', { threadDate, pinned }),
  chatLibraryThreadMessages: (threadDate: string) =>
    ipcRenderer.invoke('chat-library:thread-messages', threadDate),
  chatLibraryIngest: (data: {
    source: string;
    provider: string;
    messages: Array<{ role: string; content: string; timestamp?: number }>;
    externalId?: string;
    title?: string;
    url?: string;
  }) => ipcRenderer.invoke('chat-library:ingest', data),

  // AI Debug Vault
  aiDebugLog: (ev: { source?: string; event: string; feature?: string; provider?: string; model?: string; contextId?: string; role?: string; payload?: unknown; tokensIn?: number; tokensOut?: number }) =>
    ipcRenderer.invoke('ai-debug:log', ev),
  aiDebugQuery: (opts: { sources?: string[]; events?: string[]; search?: string; fromMs?: number; toMs?: number; limit?: number; offset?: number }) =>
    ipcRenderer.invoke('ai-debug:query', opts),
  aiDebugStats: () => ipcRenderer.invoke('ai-debug:stats'),
  aiDebugExport: (opts: { sources?: string[]; events?: string[]; search?: string; fromMs?: number; toMs?: number; limit?: number }) =>
    ipcRenderer.invoke('ai-debug:export', opts),
  aiDebugClear: (opts: { sources?: string[]; events?: string[]; olderThanMs?: number }) =>
    ipcRenderer.invoke('ai-debug:clear', opts),

  // AI Usage stats
  aiChatUsage: () => ipcRenderer.invoke('ai-chat:usage'),
  // Conversations (external AI bridge)
  conversationsImport: (data: any) => ipcRenderer.invoke('conversations:import', data),
  conversationsList: () => ipcRenderer.invoke('conversations:list'),

  // Composition engine
  compositionsReport: (id: string) => ipcRenderer.invoke('compositions:report', id),
  compositionsRunNow: (id: string) => ipcRenderer.invoke('compositions:run-now', id),

  // Streaming provider chat (AiChat)
  providerChatCall: (data: { provider: any; messages: Array<{ role: string; content: string }>; model?: string; maxTokens?: number; temperature?: number }) =>
    ipcRenderer.invoke('provider-chat-call', data),
  providerChatBasic: (data: { provider: any; messages: Array<{ role: string; content: string }>; model?: string; maxTokens?: number; temperature?: number }) =>
    ipcRenderer.invoke('provider-chat-basic', data),
  onProviderChunk: (callback: (data: { delta?: string; done?: boolean; error?: string; full?: string; diagId?: string; durationMs?: number; providerId?: string; purpose?: string; requestId?: string }) => void, requestId?: string) => {
    const handler = (_event: any, data: any) => { if (!requestId || !data.requestId || data.requestId === requestId) callback(data); };
    ipcRenderer.on('provider-chunk', handler);
    return () => ipcRenderer.removeListener('provider-chunk', handler);
  },
  getProviderDiagnostics: () => ipcRenderer.invoke('get-provider-diagnostics'),
  clearProviderLogs: () => ipcRenderer.invoke('clear-provider-logs'),

  getGoals: (date: string) => ipcRenderer.invoke('get-goals', date),
  getGoalsBatch: (startDate: string, endDate: string) => ipcRenderer.invoke('get-goals-batch', startDate, endDate),
  getLongtermGoals: () => ipcRenderer.invoke('get-longterm-goals'),
  saveGoal: (date: string, goal: any) => ipcRenderer.invoke('save-goal', date, goal),
  deleteGoal: (goalId: string) => ipcRenderer.invoke('delete-goal', goalId),
  saveGoalReview: (date: string, reviewSummary: string) => ipcRenderer.invoke('save-goal-review', date, reviewSummary),
  getGoalReview: (date: string) => ipcRenderer.invoke('get-goal-review', date),
  getDailyReflection: (date: string) => ipcRenderer.invoke('get-daily-reflection', date),
  saveGoalSuggestion: (data: { title: string; category: string; date: string; source: string; reason?: string }) =>
    ipcRenderer.invoke('save-goal-suggestion', data),
  getGoalContext: () => ipcRenderer.invoke('get-goal-context'),
  parseGoalFeedback: (data: { message: string; goals: string[] }) => ipcRenderer.invoke('parse-goal-feedback', data),
  parseGoalDump: (text: string) => ipcRenderer.invoke('parse-goal-dump', text),
  suggestGoals: (date: string, ctx?: any) => ipcRenderer.invoke('suggest-goals', date, ctx),
  reviewGoals: (date: string) => ipcRenderer.invoke('review-goals', date),

  // Goal hierarchy (parent_id decomposition)
  getGoal: (goalId: string) => ipcRenderer.invoke('get-goal', goalId),
  getChildGoals: (parentId: string) => ipcRenderer.invoke('get-child-goals', parentId),
  saveGoalsBatch: (goals: any[]) => ipcRenderer.invoke('save-goals-batch', goals),

  // Life Phases Timeline (The River of Years)
  lifePhaseGet: () => ipcRenderer.invoke('lifePhase:get'),
  lifePhaseGetSummary: () => ipcRenderer.invoke('lifePhase:getSummary'),
  lifePhaseSave: (phase: any) => ipcRenderer.invoke('lifePhase:save', phase),
  lifePhaseDelete: (phaseId: string) => ipcRenderer.invoke('lifePhase:delete', phaseId),
  lifePhaseSaveAll: (phases: any[]) => ipcRenderer.invoke('lifePhase:saveAll', phases),
  lifePhaseAiAssist: (params: { kind?: string; context?: any }) => ipcRenderer.invoke('lifePhase:aiAssist', params),
  lifePhaseGetPeriodContext: (params: { startDate: string; endDate: string }) => ipcRenderer.invoke('lifePhase:getPeriodContext', params),
  lifePhaseAiReflect: (params: any) => ipcRenderer.invoke('lifePhase:aiReflect', params),
  lifePhaseAiEraTrends: (params: { startYear: number; endYear: number | null; title: string }) => ipcRenderer.invoke('lifePhase:aiEraTrends', params),
  lifePhaseAiSummarize: (phases: any[]) => ipcRenderer.invoke('lifePhase:aiSummarize', phases),

  // Notes
  notesList: (params?: { search?: string; tag?: string; group?: string; includeDrafts?: boolean; upcomingDeadlines?: boolean }) => ipcRenderer.invoke('notes:list', params),
  notesCreate: (data: { title?: string; content: string; tags?: string[]; group_name?: string; deadline?: string; deadline_time?: string; reminder?: string; is_draft?: number; links?: string[] }) => ipcRenderer.invoke('notes:create', data),
  notesUpdate: (data: { id: string; title?: string; content?: string; tags?: string[]; group_name?: string; deadline?: string | null; deadline_time?: string | null; reminder?: string; is_draft?: number; status?: string; links?: string[] }) => ipcRenderer.invoke('notes:update', data),
  notesDelete: (id: string) => ipcRenderer.invoke('notes:delete', id),
  notesGroups: () => ipcRenderer.invoke('notes:groups'),

  linkGoalToEntity: (goalId: string, link: { type: 'problem' | 'request'; id: string; label?: string }) => ipcRenderer.invoke('link-goal-to-entity', goalId, link),
  unlinkGoalFromEntity: (goalId: string, type: 'problem' | 'request', entityId: string) => ipcRenderer.invoke('unlink-goal-from-entity', goalId, type, entityId),

  // ========== Daily Goal Progress & Timeline ==========
  getDailyGoalProgress: (date: string, goals: any[]) => ipcRenderer.invoke('get-daily-goal-progress', date, goals),
  getGoalTimeline: (date: string) => ipcRenderer.invoke('get-goal-timeline', date),

  // ========== Goal Reminders ==========
  getReminders: () => ipcRenderer.invoke('get-reminders'),
  createReminder: (data: { text: string; due_date?: string; goal_id?: string; due_time?: string }) => ipcRenderer.invoke('create-reminder', data),
  toggleReminder: (id: string, done: boolean) => ipcRenderer.invoke('toggle-reminder', id, done),
  deleteReminder: (id: string) => ipcRenderer.invoke('delete-reminder', id),

  // ========== Schedule & Planning ==========
  getSchedule: () => ipcRenderer.invoke('get-schedule'),
  addScheduleEntry: (entry: any) => ipcRenderer.invoke('add-schedule-entry', entry),
  deleteScheduleEntry: (id: string) => ipcRenderer.invoke('delete-schedule-entry', id),
  updateScheduleEntry: (id: string, patch: any) => ipcRenderer.invoke('update-schedule-entry', id, patch),
  getDeadlines: (opts?: { days?: number; course?: string }) => ipcRenderer.invoke('get-deadlines', opts),
  addDeadline: (dl: any) => ipcRenderer.invoke('add-deadline', dl),
  updateDeadlineStatus: (id: string, status: string) => ipcRenderer.invoke('update-deadline-status', id, status),
  deleteDeadline: (id: string) => ipcRenderer.invoke('delete-deadline', id),
  updateDeadline: (id: string, patch: any) => ipcRenderer.invoke('update-deadline', id, patch),
  snoozeDeadline: (id: string, minutes: number) => ipcRenderer.invoke('snooze-deadline', id, minutes),
  // ========== Pinned todo popup (always-on-top mini window) ==========
  todoPopupToggle: () => ipcRenderer.invoke('todo-popup:toggle'),
  todoPopupClose: () => ipcRenderer.invoke('todo-popup:close'),
  todoPopupSetPinned: (pinned: boolean) => ipcRenderer.invoke('todo-popup:set-pinned', pinned),
  todoPopupGetState: () => ipcRenderer.invoke('todo-popup:get-state'),
  todoPopupMinimize: () => ipcRenderer.invoke('todo-popup:minimize'),
  todoPopupFocusMain: () => ipcRenderer.invoke('todo-popup:focus-main'),
  onTodoPopupState: (cb: (s: { open: boolean; pinned: boolean }) => void) => {
    const handler = (_e: any, s: any) => cb(s);
    ipcRenderer.on('todo-popup-state', handler);
    return () => ipcRenderer.removeListener('todo-popup-state', handler);
  },

  // ========== Todos (persistent, linkable) ========
  todoList: (opts?: { goalId?: string; deadlineId?: string; scheduleId?: string; limit?: number }) => ipcRenderer.invoke('todo:list', opts),
  todoCreate: (data: { text: string; goalId?: string; deadlineId?: string; scheduleId?: string; dueDate?: string; reminder?: string; parentTodoId?: string; sortOrder?: number }) => ipcRenderer.invoke('todo:create', data),
  todoUpdate: (id: string, patch: any) => ipcRenderer.invoke('todo:update', id, patch),
  todoToggle: (id: string, done?: boolean) => ipcRenderer.invoke('todo:toggle', id, done),
  todoDelete: (id: string) => ipcRenderer.invoke('todo:delete', id),
  todoGetConnections: (entityType: string, entityId: string) => ipcRenderer.invoke('todo:get-connections', entityType, entityId),
  goalGetConnections: (goalId: string) => ipcRenderer.invoke('goal:get-connections', goalId),
  getScheduleTemplates: () => ipcRenderer.invoke('get-schedule-templates'),
  applyScheduleTemplate: (templateId: string) => ipcRenderer.invoke('apply-schedule-template', templateId),
  saveScheduleTemplate: (data: { name: string; entries: any[] }) => ipcRenderer.invoke('save-schedule-template', data),

  // Checklist CRUD (AI Assistant)
  addProblemCheck: (data: { problemId: string; description: string; instruction?: string }) => ipcRenderer.invoke('add-problem-check', data),
  addRequestCheck: (data: { requestId: string; description: string; instruction?: string }) => ipcRenderer.invoke('add-request-check', data),
  completeCheck: (checkId: string) => ipcRenderer.invoke('complete-check', checkId),
  getProblemChecks: (problemId: string) => ipcRenderer.invoke('get-problem-checks', problemId),
  getRequestChecks: (requestId: string) => ipcRenderer.invoke('get-request-checks', requestId),

  // Planning.md
  readPlanningMd: () => ipcRenderer.invoke('read-planning-md'),
  writePlanningMd: (content: string) => ipcRenderer.invoke('write-planning-md', content),

  // ========== Connectors ==========
  connectors: {
    list: () => ipcRenderer.invoke('connectors:list'),
    add: (connector: { type: string; provider: string; displayName: string; config: any }) => ipcRenderer.invoke('connectors:add', connector),
    remove: (id: string) => ipcRenderer.invoke('connectors:remove', id),
    test: (id: string) => ipcRenderer.invoke('connectors:test', id),
    sync: (id: string) => ipcRenderer.invoke('connectors:sync', id),
    items: (id: string, opts?: { type?: string; limit?: number; offset?: number; search?: string; unreadOnly?: boolean }) => ipcRenderer.invoke('connectors:items', id, opts),
    status: (id: string) => ipcRenderer.invoke('connectors:status', id),
    sendEmail: (data: { connectorId: string; to: string; subject: string; body: string; inReplyTo?: string }) => ipcRenderer.invoke('connectors:send-email', data),
    createEvent: (data: { connectorId: string; title: string; startTime: string; endTime?: string; description?: string }) => ipcRenderer.invoke('connectors:create-event', data),
    updateEvent: (data: { connectorId: string; eventId: string; changes: any }) => ipcRenderer.invoke('connectors:update-event', data),
    deleteEvent: (data: { connectorId: string; eventId: string }) => ipcRenderer.invoke('connectors:delete-event', data),
    markRead: (data: { connectorId: string; emailId: string; read: boolean }) => ipcRenderer.invoke('connectors:mark-read', data),
    onNewEmails: (callback: (data: { connectorId: string; connectorName: string; unreadCount: number; newItems: any[] }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('connectors:new-emails', handler);
      return () => { ipcRenderer.removeListener('connectors:new-emails', handler); };
    },
  },

  // Feature Specs
  writeFeatureSpecFile: (content: string) => ipcRenderer.invoke('write-feature-spec-file', content),

  // ========== Finance Page ==========
  financeGetAccounts: () => ipcRenderer.invoke('finance:get-accounts'),
  financeCreateAccount: (data: any) => ipcRenderer.invoke('finance:create-account', data),
  financeUpdateAccount: (data: any) => ipcRenderer.invoke('finance:update-account', data),
  financeArchiveAccount: (id: number) => ipcRenderer.invoke('finance:archive-account', id),
  financeArchiveWallet: (id: number) => ipcRenderer.invoke('finance:archive-wallet', id),

  financeGetWallets: (accountId?: number) => ipcRenderer.invoke('finance:get-wallets', accountId),
  financeCreateWallet: (data: any) => ipcRenderer.invoke('finance:create-wallet', data),
  financeUpdateWallet: (data: any) => ipcRenderer.invoke('finance:update-wallet', data),
  financeAdjustBalance: (id: number, newBalance: number) => ipcRenderer.invoke('finance:adjust-balance', { id, newBalance }),
  financeUpdateInitialBalance: (id: number, initialBalance: number, password: string) => ipcRenderer.invoke('finance:update-initial-balance', { id, initialBalance, password }),
  financeGetWallet: (id: number) => ipcRenderer.invoke('finance:get-wallet', id),
  financeUpdateWalletMetadata: (payload: { id: number; metadata: Record<string, any> }) => ipcRenderer.invoke('finance:update-wallet-metadata', payload),
  financeFetchCryptoPrices: (coinIds: string[], currency?: string) => ipcRenderer.invoke('finance:fetch-crypto-prices', coinIds, currency || 'usd'),
  financeGetCryptoHistory: (coinId: string, days?: number, currency?: string) => ipcRenderer.invoke('finance:get-crypto-history', coinId, days, currency || 'usd'),
  financeGetCryptoAssetHistory: (walletId: number, coinId: string) => ipcRenderer.invoke('finance:get-crypto-asset-history', walletId, coinId),
  financeGetAllCoins: () => ipcRenderer.invoke('finance:get-all-coins'),
  financeSearchAssets: (searchTerm: string, assetTypes?: string[]) => ipcRenderer.invoke('finance:search-assets', searchTerm, assetTypes),
  financeFetchAssetPrices: (coinIds: string[], assetType?: string, currency?: string) => ipcRenderer.invoke('finance:fetch-asset-prices', coinIds, assetType || 'crypto', currency || 'usd'),
  financeGetAssetHistory: (coinId: string, assetType?: string, days?: number, currency?: string) => ipcRenderer.invoke('finance:get-asset-history', coinId, assetType || 'crypto', days || 30, currency || 'usd'),

  financeGetCategories: () => ipcRenderer.invoke('finance:get-categories'),
  financeCreateCategory: (data: any) => ipcRenderer.invoke('finance:create-category', data),
  financeUpdateCategory: (data: any) => ipcRenderer.invoke('finance:update-category', data),

  financeGetTransactions: (filters?: any) => ipcRenderer.invoke('finance:get-transactions', filters),
  financeCreateTransaction: (data: any) => ipcRenderer.invoke('finance:create-transaction', data),
  financeCreateAdjustment: (data: any) => ipcRenderer.invoke('finance:create-adjustment', data),
  financeCreateTransfer: (data: any) => ipcRenderer.invoke('finance:create-transfer', data),
  financeUpdateTransaction: (idOrData: any, maybeData?: any) => ipcRenderer.invoke('finance:update-transaction', typeof idOrData === 'object' ? idOrData : { ...maybeData, id: idOrData }),
  financeDeleteTransaction: (id: number) => ipcRenderer.invoke('finance:delete-transaction', id),
  financeBatchUpdateCategory: (ids: number[], categoryId: number) =>
    ipcRenderer.invoke('finance:batch-update-category', { ids, categoryId }),

  financeGetSummary: () => ipcRenderer.invoke('finance:get-summary'),
  financeGetSpendingByCategory: () => ipcRenderer.invoke('finance:get-spending-by-category'),
  financeGetMonthlyTrends: () => ipcRenderer.invoke('finance:get-monthly-trends'),

  financeIsLocked: () => ipcRenderer.invoke('finance:is-locked'),
  financeGetLockState: () => ipcRenderer.invoke('finance:get-lock-state'),
  financeUnlock: (password: string) => ipcRenderer.invoke('finance:unlock', password),
  financeLock: () => ipcRenderer.invoke('finance:lock'),
  financeSetPassword: (password: string) => ipcRenderer.invoke('finance:set-password', password),
  financeChangePassword: (currentPassword: string, nextPassword: string) => ipcRenderer.invoke('finance:change-password', currentPassword, nextPassword),
  financeVerifyPassword: (password: string) => ipcRenderer.invoke('finance:verify-password', password),
  financeCheckPasswordSetup: () => ipcRenderer.invoke('finance:check-password-setup'),
  financeSetRememberDevice: (remember: boolean, days: number) => ipcRenderer.invoke('finance:set-remember-device', remember, days),
  financeSetLockTimeout: (timeoutMs: number) => ipcRenderer.invoke('finance:set-lock-timeout', timeoutMs),
  financeGetSecuritySettings: () => ipcRenderer.invoke('finance:get-security-settings'),
  financeGetAutoSave: () => ipcRenderer.invoke('finance:get-auto-save'),
  financeSetAutoSave: (enabled: boolean) => ipcRenderer.invoke('finance:set-auto-save', enabled),
  financeGetAutoRecalc: () => ipcRenderer.invoke('finance:get-auto-recalc'),
  financeSetAutoRecalc: (enabled: boolean) => ipcRenderer.invoke('finance:set-auto-recalc', enabled),
  financeCheckPageAccess: () => ipcRenderer.invoke('finance:check-page-access'),
  financeBiometricUnlock: () => ipcRenderer.invoke('finance:biometric-unlock'),
  financeGetWebAuthnCredential: () => ipcRenderer.invoke('finance:get-webauthn-credential'),
  financeStoreWebAuthnCredential: (credentialId: string) => ipcRenderer.invoke('finance:store-webauthn-credential', credentialId),

  financeGetDisplayCurrency: () => ipcRenderer.invoke('finance:get-display-currency'),
  financeSetDisplayCurrency: (currency: string) => ipcRenderer.invoke('finance:set-display-currency', currency),

  financeRecapList: () => ipcRenderer.invoke('finance:recap-list'),
  financeRecapGet: (month: string) => ipcRenderer.invoke('finance:recap-get', { month }),
  financeRecapGenerate: (month: string, force = false) => ipcRenderer.invoke('finance:recap-generate', { month, force }),
  financeRecapDelete: (month: string) => ipcRenderer.invoke('finance:recap-delete', { month }),
  financeRecapMonthsWithData: () => ipcRenderer.invoke('finance:recap-months-with-data'),

  financeGetArchivedAccounts: () => ipcRenderer.invoke('finance:get-archived-accounts'),
  financeGetArchivedWallets: () => ipcRenderer.invoke('finance:get-archived-wallets'),
  financeUnarchiveAccount: (id: number) => ipcRenderer.invoke('finance:unarchive-account', id),
  financeUnarchiveWallet: (id: number) => ipcRenderer.invoke('finance:unarchive-wallet', id),
  financeDeleteAccount: (id: number) => ipcRenderer.invoke('finance:delete-account', id),
  financeDeleteWallet: (id: number) => ipcRenderer.invoke('finance:delete-wallet', id),
  financeGetPasswordRequirements: () => ipcRenderer.invoke('finance:get-password-requirements'),
  financeSetPasswordRequirement: (key: string, value: boolean) => ipcRenderer.invoke('finance:set-password-requirement', key, value),

  subscriptionsList: (walletId?: number) => ipcRenderer.invoke('subscriptions:list', walletId),
  subscriptionsCreate: (data: any) => ipcRenderer.invoke('subscriptions:create', data),
  subscriptionsUpdate: (data: any) => ipcRenderer.invoke('subscriptions:update', data),
  subscriptionsDelete: (id: number) => ipcRenderer.invoke('subscriptions:delete', id),
  subscriptionsGetUpcomingRenewals: (days?: number) => ipcRenderer.invoke('subscriptions:get-upcoming-renewals', days),
  subscriptionsGenerateDueTransactions: () => ipcRenderer.invoke('subscriptions:generate-due-transactions'),
  subscriptionsSkipRenewal: (id: number) => ipcRenderer.invoke('subscriptions:skip-renewal', id),
  subscriptionsMoveTransaction: (data: { subscriptionId: number; newWalletId: number }) => ipcRenderer.invoke('subscriptions:move-transaction', data),
  subscriptionsRetryPayment: (data: { subscriptionId: number; walletId?: number; date?: string }) => ipcRenderer.invoke('subscriptions:retry-payment', data),
  subscriptionsToggleAutodebet: (id: number) => ipcRenderer.invoke('subscriptions:toggle-autodebet', id),
  subscriptionsRecordPayment: (data: { subscriptionId: number; walletId?: number; amount?: number; date?: string }) => ipcRenderer.invoke('subscriptions:record-payment', data),
  subscriptionsGetPaymentHistory: (subscriptionId: number) => ipcRenderer.invoke('subscriptions:get-payment-history', subscriptionId),
  subscriptionsCancelPayment: (data: { subscriptionId: number; transactionId: number; reason?: string }) => ipcRenderer.invoke('subscriptions:cancel-payment', data),

  financeGetPersonBalances: (walletId: number) => ipcRenderer.invoke('finance:get-person-balances', walletId),
  financeAttributeTransaction: (data: { txnId: number; personName: string; walletId: number }) => ipcRenderer.invoke('finance:attribute-transaction', data),
  financeUnattributeTransaction: (data: { txnId: number; personName: string; walletId: number }) => ipcRenderer.invoke('finance:unattribute-transaction', data),
  financeGetPersonsInWallet: (walletId: number) => ipcRenderer.invoke('finance:get-persons-in-wallet', walletId),

  financeRecalculateBalances: (walletId?: number, preview?: boolean) => ipcRenderer.invoke('finance:recalculate-balances', walletId, preview),
  financeApplyRecalculatedBalance: (walletId: number) => ipcRenderer.invoke('finance:apply-recalculated-balance', walletId),
  financeUpdateTransactionSortOrder: (updates: { id: number; sort_order: number }[]) => ipcRenderer.invoke('finance:update-transaction-sort-order', updates),
  financeFixHistoricalDates: () => ipcRenderer.invoke('finance:fix-historical-dates'),
financeGetOnBehalfOfSummary: () => ipcRenderer.invoke('finance:get-on-behalf-of-summary'),
financeLastTransactionDate: () => ipcRenderer.invoke('finance:last-transaction-date'),
financeGetFtPersons: () => ipcRenderer.invoke('finance:get-ft-persons'),
  financeCreateFtPerson: (data: { name: string }) => ipcRenderer.invoke('finance:create-ft-person', data),
  financeFtPersonTopup: (data: { personId: number; walletId: number; amount: number; description?: string; date?: string }) => ipcRenderer.invoke('finance:ft-person-topup', data),
  financeFtPersonDeduct: (data: { personId: number; amount: number; description?: string }) => ipcRenderer.invoke('finance:ft-person-deduct', data),
  financeFtPersonSetWallet: (data: { personId: number; walletId: number | null }) => ipcRenderer.invoke('finance:ft-person-set-wallet', data),
  financeFtPersonEdit: (data: { personId: number; name?: string; email?: string; phone?: string; notes?: string }) => ipcRenderer.invoke('finance:ft-person-edit', data),
  financeFtPersonDelete: (data: { personId: number }) => ipcRenderer.invoke('finance:ft-person-delete', data),
  financeFtPersonSyncBalances: () => ipcRenderer.invoke('finance:ft-person-sync-balances'),
  financeRecordFtRepayment: (data: { originalTxId: number; personId?: number; amount: number; date: string; walletId?: number; accountId?: number; description?: string; isOverpayment?: boolean }) => ipcRenderer.invoke('finance:ft-person-record-repayment', data),
  financeUpdateWalletFees: (data: { id: number; transfer_fee_type: string; transfer_fee_value: number }) => ipcRenderer.invoke('finance:update-wallet-fees', data),

  // ========== Finance Dashboard Enhancements ==========
  financeGetCryptoUnifiedPortfolio: (walletId: number) => ipcRenderer.invoke('finance:get-crypto-unified-portfolio', walletId),
  financeGetLiquidityBreakdown: () => ipcRenderer.invoke('finance:get-liquidity-breakdown'),
  financeGetSubscriptionIntelligence: () => ipcRenderer.invoke('finance:get-subscription-intelligence'),
  financeGetCashflowRunway: () => ipcRenderer.invoke('finance:get-cashflow-runway'),
  financeGetWalletHealth: () => ipcRenderer.invoke('finance:get-wallet-health'),
  financeGetTransferCostMatrix: () => ipcRenderer.invoke('finance:get-transfer-cost-matrix'),

  // ========== Fixed Expenses ==========
  fixedExpensesList: (month?: string) => ipcRenderer.invoke('fixed-expenses:list', month),
  fixedExpensesCreate: (data: any) => ipcRenderer.invoke('fixed-expenses:create', data),
  fixedExpensesUpdate: (data: any) => ipcRenderer.invoke('fixed-expenses:update', data),
  fixedExpensesDelete: (id: number) => ipcRenderer.invoke('fixed-expenses:delete', id),
  fixedExpensesMarkPaid: (data: any) => ipcRenderer.invoke('fixed-expenses:mark-paid', data),
  fixedExpensesSkipMonth: (data: any) => ipcRenderer.invoke('fixed-expenses:skip-month', data),
  fixedExpensesUnmarkPaid: (data: any) => ipcRenderer.invoke('fixed-expenses:unmark-paid', data),
  fixedExpensesPaymentHistory: (id: number) => ipcRenderer.invoke('fixed-expenses:payment-history', id),
  fixedExpensesDetectRecurring: () => ipcRenderer.invoke('fixed-expenses:detect-recurring'),
  fixedExpensesSummary: (month?: string) => ipcRenderer.invoke('fixed-expenses:summary', month),

  // ========== Budgets ==========
  budgetsList: () => ipcRenderer.invoke('budgets:list'),
  budgetsCreate: (data: any) => ipcRenderer.invoke('budgets:create', data),
  budgetsUpdate: (data: any) => ipcRenderer.invoke('budgets:update', data),
  budgetsDelete: (id: number) => ipcRenderer.invoke('budgets:delete', id),
  budgetsGetStatus: (month?: string) => ipcRenderer.invoke('budgets:get-status', month),

  // ========== Audit Log ==========
  auditList: (opts?: { limit?: number; offset?: number; entity_type?: string; entity_id?: number }) => ipcRenderer.invoke('audit:list', opts || {}),
  auditGet: (id: number) => ipcRenderer.invoke('audit:get', id),
  auditGetForEntity: (entityType: string, entityId: number, limit?: number) => ipcRenderer.invoke('audit:get-for-entity', entityType, entityId, limit),

  // ========== Vision / Critique ==========
  vision: {
    health: () => ipcRenderer.invoke('vision:health'),
    startSidecar: () => ipcRenderer.invoke('vision:start-sidecar'),
    analyze: (request: any) => ipcRenderer.invoke('vision:analyze', request),
    getResult: (jobId: string) => ipcRenderer.invoke('vision:get-result', jobId),
    cancel: (jobId: string) => ipcRenderer.invoke('vision:cancel', jobId),
    onProgress: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('vision:progress', handler);
      return () => { ipcRenderer.removeListener('vision:progress', handler); };
    },
  },

  // ========== Local Ollama Image Recognition (VLM) ==========
  ollamaChat: (opts: { model: string; imageBase64: string; textPrompt: string }) =>
    ipcRenderer.invoke('ollama-chat', opts),

  // ========== Agent Prompts ==========
  agentPrompts: {
    list: (params?: { sessionId?: string; projectId?: string }) => ipcRenderer.invoke('prompts:list', params),
    get: (id: string) => ipcRenderer.invoke('prompts:get', { id }),
    create: (data: { sessionId?: string; projectId?: string; content: string; title?: string; category?: string; tags?: string[] }) => ipcRenderer.invoke('prompts:create', data),
    update: (data: { id: string; status?: string; progress?: number; resultSummary?: string; title?: string; category?: string; tags?: string[] }) => ipcRenderer.invoke('prompts:update', data),
    delete: (id: string) => ipcRenderer.invoke('prompts:delete', { id }),
  },

  // ========== Lyceum Learn Module ==========
  learnImportLdoc: (payload: { source?: string; json?: unknown }) => ipcRenderer.invoke('learn:importLdoc', payload),
  learnValidate: (payload: { source?: string; json?: unknown }) => ipcRenderer.invoke('learn:validate', payload),
  learnListLessons: (params?: { branchId?: string; part?: number; chapter?: string; subtopic?: string }) => ipcRenderer.invoke('learn:listLessons', params || {}),
  learnListChapters: (params?: { branchId?: string; part?: number }) => ipcRenderer.invoke('learn:listChapters', params || {}),
  learnListGroups: (params?: { branchId?: string; part?: number }) => ipcRenderer.invoke('learn:listGroups', params || {}),
  learnListBranches: () => ipcRenderer.invoke('learn:listBranches'),
  learnGetTopicsByBranch: (params: { branchId: string }) => ipcRenderer.invoke('learn:getTopicsByBranch', params),
  learnGetLesson: ({ lessonId }: { lessonId: string }) => ipcRenderer.invoke('learn:getLesson', { lessonId }),
  learnGetNode: ({ nodeId }: { nodeId: string }) => ipcRenderer.invoke('learn:getNode', { nodeId }),
  learnGetGraph: (params?: { branchId?: string; part?: number }) => ipcRenderer.invoke('learn:getGraph', params || {}),
  learnAskTutor: (params: { nodeId: string; blockId?: string; question: string }) => ipcRenderer.invoke('learn:askTutor', params),
  learnSubmitQuiz: (params: { nodeId: string; blockId: string; response: string }) => ipcRenderer.invoke('learn:submitQuiz', params),
  learnGetProgress: (params?: { nodeId?: string }) => ipcRenderer.invoke('learn:getProgress', params || {}),
  learnGetDueReviews: () => ipcRenderer.invoke('learn:getDueReviews'),
  learnPickFile: () => ipcRenderer.invoke('learn:pick-file'),
  learnGetWorkedExample: () => ipcRenderer.invoke('learn:get-worked-example'),
  learnGetSchema: () => ipcRenderer.invoke('learn:get-schema'),
  learnGetAuthorGuide: () => ipcRenderer.invoke('learn:get-author-guide'),
  learnBuildPrompt: (params: { userInput?: string; topic?: string; description?: string; contextDoc?: string; numNodes?: number; masteryTargets?: string[]; chapter?: string; branchId?: string; subtopic?: string }) =>
    ipcRenderer.invoke('learn:buildPrompt', params),
  learnGenerateLdoc: (params: { prompt: string; systemPrompt: string }) =>
    ipcRenderer.invoke('learn:generateLdoc', params),
  learnListRecipes: () => ipcRenderer.invoke('learn:listRecipes'),
  learnAiChat: (params: { systemPrompt: string; messages: { role: string; content: string }[] }) =>
    ipcRenderer.invoke('learn:aiChat', params),
  learnBuildPromptFromRecipe: (params: { recipeSlug: string; topic?: string; userInput?: string }) =>
    ipcRenderer.invoke('learn:buildPromptFromRecipe', params),

  // ========== Tutor V2 Streaming ==========
  learnTutorStream: (params: { nodeId: string; blockId: string; question: string; convId?: string; mode?: 'explain' | 'ask' | 'simpler' | 'deeper' }) =>
    ipcRenderer.invoke('learn:tutorStream', params),
  onTutorToken: (callback: (data: { blockId: string; token: string; done: boolean }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('learn:tutorToken', handler);
    return () => ipcRenderer.removeListener('learn:tutorToken', handler);
  },

  // ========== Tutor Config ==========
  learnGetTutorConfig: () => ipcRenderer.invoke('learn:getTutorConfig'),
  learnTutorAskV2: (params: { nodeId: string; blockId?: string; question: string }) =>
    ipcRenderer.invoke('learn:tutorAskV2', params),

  // ========== Permissions ==========
  learnGetPermissions: () => ipcRenderer.invoke('learn:getPermissions'),
  learnSetPermission: (perm: { resource: string; grant: string; rationale?: string }) =>
    ipcRenderer.invoke('learn:setPermission', perm),

  // ========== Notes ==========
  learnAddNote: (params: { nodeId: string; text: string; tags?: string[]; blockRef?: string }) =>
    ipcRenderer.invoke('learn:addNote', params),
  learnGetNotes: (params: { nodeId: string }) =>
    ipcRenderer.invoke('learn:getNotes', params),
  learnGetAllNotes: (params?: { limit?: number }) =>
    ipcRenderer.invoke('learn:getAllNotes', params || {}),
  learnDeleteNote: (params: { noteId: string }) =>
    ipcRenderer.invoke('learn:deleteNote', params),
  learnToggleNotePin: (params: { noteId: string; pinned: boolean }) =>
    ipcRenderer.invoke('learn:toggleNotePin', params),

  // ========== Tutor V2 Extras ==========
  learnCreateProposal: (params: { nodeId: string; blockId: string; title: string; bodyMd: string; actions: string[] }) =>
    ipcRenderer.invoke('learn:createProposal', params),
  learnDecideProposal: (params: { proposal_id: string; approved: boolean; reason?: string }) =>
    ipcRenderer.invoke('learn:decideProposal', params),

  // ========== Conversations ==========
  learnStartConversation: (params: { id: string; nodeId: string; blockId: string }) =>
    ipcRenderer.invoke('learn:startConversation', params),
  learnAddMessage: (params: { nodeId: string; blockId?: string; role: string; text: string }) =>
    ipcRenderer.invoke('learn:addMessage', params),
  learnGetConversation: (params: { blockId: string }) =>
    ipcRenderer.invoke('learn:getConversation', params),
  learnResolveConversation: (params: { convId: string }) =>
    ipcRenderer.invoke('learn:resolveConversation', params),

  // ========== Dashboard ==========
  learnGetTutorDashboard: () => ipcRenderer.invoke('learn:getTutorDashboard'),

  // ========== Learner Profile ==========
  learnGetProfile: ({ key }: { key: string }) => ipcRenderer.invoke('learn:getProfile', { key }),
  learnSetProfile: ({ key, value }: { key: string; value: string }) => ipcRenderer.invoke('learn:setProfile', { key, value }),
  learnDeleteProfile: ({ key }: { key: string }) => ipcRenderer.invoke('learn:deleteProfile', { key }),
  learnGetAllProfile: () => ipcRenderer.invoke('learn:getAllProfile'),

  // ========== Flashcard & Visualization ==========
  learnGetDueCards: (args: { deckId?: string; limit?: number }) => ipcRenderer.invoke('learn:getDueCards', args),
  learnSubmitCardReview: (args: { cardId: string; rating: number }) => ipcRenderer.invoke('learn:submitCardReview', args),
  learnGenerateCards: (args: { deckId: string; nodeContent: string }) => ipcRenderer.invoke('learn:generateCards', args),
  learnGetDeckStats: (args: { deckId: string }) => ipcRenderer.invoke('learn:getDeckStats', args),
  learnGetStudyHeatmap: (args: { days: number }) => ipcRenderer.invoke('learn:getStudyHeatmap', args),
  learnSaveVizState: (args: { vizType: string; vizId: string; state: any }) => ipcRenderer.invoke('learn:saveVizState', args),
  learnGetLessonSystemPrompt: () => ipcRenderer.invoke('learn:getLessonSystemPrompt'),

  // ========== Image Generation Settings ==========
  learnGetImageGenSettings: () => ipcRenderer.invoke('learn:getImageGenSettings'),
  learnSetImageGenSettings: (args: { enabled?: boolean; model?: string; style?: string }) => ipcRenderer.invoke('learn:setImageGenSettings', args),

  // ========== Image Generation ==========
  learnGenerateIllustration: (args: { prompt: string; nodeId?: string; lessonId?: string }) => ipcRenderer.invoke('learn:generateIllustration', args),
  learnExplainWithImage: (args: { selectedText: string; contextText: string; nodeId?: string }) => ipcRenderer.invoke('learn:explainWithImage', args),
  learnUploadIllustration: (args: { lessonId?: string; filename?: string }) => ipcRenderer.invoke('learn:uploadIllustration', args),

  // ========== Code Execution (CodeBlock Run button) ==========
  learnRunCode: (args: { lang?: string; code: string; cwd?: string }) => ipcRenderer.invoke('learn:runCode', args),

  // ========== Learning Intents ==========
  learnSaveIntent: (args: { title: string; description?: string; context?: string; category?: string }) => ipcRenderer.invoke('learn:saveIntent', args),
  learnListIntents: () => ipcRenderer.invoke('learn:listIntents'),
  learnDeleteIntent: (args: { id: string }) => ipcRenderer.invoke('learn:deleteIntent', args),
  learnUpdateIntent: (args: { id: string; status?: string; title?: string }) => ipcRenderer.invoke('learn:updateIntent', args),

  // ========== Lesson Management ==========
  learnGetLessonSource: (args: { lessonId: string }) => ipcRenderer.invoke('learn:getLessonSource', args),
  learnUpdateLessonMeta: (args: { lessonId: string; title?: string; part?: number; summary?: string; chapter?: string; branchId?: string; subtopic?: string }) => ipcRenderer.invoke('learn:updateLessonMeta', args),
  learnUpdateLessonDoc: (args: { lessonId: string; docJson: string }) => ipcRenderer.invoke('learn:updateLessonDoc', args),
  learnDeleteLesson: (args: { lessonId: string }) => ipcRenderer.invoke('learn:deleteLesson', args),

  // ========== Timer System ==========
  learnTimerStart: (args: { lessonId?: number }) => ipcRenderer.invoke('learn:timerStart', args),
  learnTimerPause: (args: { sessionId: number }) => ipcRenderer.invoke('learn:timerPause', args),
  learnTimerResume: (args: { sessionId: number }) => ipcRenderer.invoke('learn:timerResume', args),
  learnTimerStop: (args: { sessionId: number; duration: number; nodesSeen?: number[]; quizzesTaken?: number; cardsReviewed?: number; masteryGained?: number }) => ipcRenderer.invoke('learn:timerStop', args),
  learnTimerGetState: () => ipcRenderer.invoke('learn:timerGetState'),

  // ========== Goals System ==========
  learnGetGoals: (args?: { type?: string; date?: string }) => ipcRenderer.invoke('learn:getGoals', args || {}),
  learnSetGoal: (args: { type: string; metric: string; target: number; periodStart: string; periodEnd?: string; deadline?: string }) => ipcRenderer.invoke('learn:setGoal', args),
  learnUpdateGoalProgress: (args: { goalId: number; delta: number }) => ipcRenderer.invoke('learn:updateGoalProgress', args),
  learnGetGoalSuggestions: () => ipcRenderer.invoke('learn:getGoalSuggestions'),

  // ========== Streak System ==========
  learnGetStreak: () => ipcRenderer.invoke('learn:getStreak'),

  // ========== Achievements System ==========
  learnGetAchievements: (args?: { viewed?: boolean }) => ipcRenderer.invoke('learn:getAchievements', args || {}),
  learnCheckAchievements: (args: { trigger: string; metadata?: any }) => ipcRenderer.invoke('learn:checkAchievements', args),
  learnMarkAchievementViewed: (args: { badgeKey: string }) => ipcRenderer.invoke('learn:markAchievementViewed', args),

  // ========== Analytics ==========
  learnGetSessionHistory: (args?: { limit?: number; lessonId?: number }) => ipcRenderer.invoke('learn:getSessionHistory', args || {}),
  learnGetLessonStats: (args: { lessonId: number }) => ipcRenderer.invoke('learn:getLessonStats', args),
  learnGetVelocity: () => ipcRenderer.invoke('learn:getVelocity'),

  // ========== Smart Gap Fill ==========
  getKnownApps: () => ipcRenderer.invoke('get-known-apps'),
  getKnownBrowserApps: () => ipcRenderer.invoke('get-known-browser-apps'),
  getKnownSites: () => ipcRenderer.invoke('get-known-sites'),
  predictGapFill: (start: string, end: string, mode?: 'combined' | 'separate') =>
    ipcRenderer.invoke('predict-gap-fill', { start, end, mode: mode || 'combined' }),
   confirmGapFill: (fills: Array<{ slotStart: string; slotEnd: string; app: string; category: string; activityId?: string }>) =>
     ipcRenderer.invoke('confirm-gap-fill', fills),
  predictDayGaps: (date: string, mode?: 'combined' | 'separate') =>
    ipcRenderer.invoke('predict-day-gaps', { date, mode: mode || 'combined' }),

  // ========== Backup & Restore ==========
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (name: string) => ipcRenderer.invoke('backup:restore', name),
    exportJSON: () => ipcRenderer.invoke('backup:exportJSON'),
    exportCSV: (tables: string[]) => ipcRenderer.invoke('backup:exportCSV', tables),
    status: () => ipcRenderer.invoke('backup:status'),
    verify: (name: string) => ipcRenderer.invoke('backup:verify', name),
    settingsGet: () => ipcRenderer.invoke('backup:settings:get'),
    settingsSet: (patch: Record<string, unknown>) => ipcRenderer.invoke('backup:settings:set', patch),
    pickMirrorDir: () => ipcRenderer.invoke('backup:pickMirrorDir'),
  },

  // ========== Project file backup ==========
  projectBackup: {
    create: (projectId: string, projectPath: string, label?: string, extra?: Record<string, unknown>) =>
      ipcRenderer.invoke('projectBackup:create', projectId, projectPath, label, extra),
    list: (projectId?: string) => ipcRenderer.invoke('projectBackup:list', projectId),
    get: (backupId: string) => ipcRenderer.invoke('projectBackup:get', backupId),
    delete: (backupId: string, projectId: string) => ipcRenderer.invoke('projectBackup:delete', backupId, projectId),
    restore: (projectId: string, backupId: string) => ipcRenderer.invoke('projectBackup:restore', projectId, backupId),
    diff: (projectId: string, backupId: string) => ipcRenderer.invoke('projectBackup:diff', projectId, backupId),
    schedule: (projectId: string, minutes: number, projectPath?: string) =>
      ipcRenderer.invoke('projectBackup:schedule', projectId, minutes, projectPath),
    getSchedules: () => ipcRenderer.invoke('projectBackup:getSchedules'),
  },

  // ========== Arch Map — project architecture scanner ==========
  archMap: {
    generate: (opts?: { force?: boolean }) => ipcRenderer.invoke('archMap:generate', opts),
  },

  // ========== Workspace close guard (removed - close always allowed) ==========
  // onWorkspaceRequestSave: (callback: () => void) => {
  //   const handler = () => callback();
  //   ipcRenderer.on('workspace-request-save', handler);
  //   return () => { ipcRenderer.removeListener('workspace-request-save', handler); };
  // },
  // workspaceAllowClose: () => ipcRenderer.send('workspace-allow-close'),

  // ========== Desktop Bridge: Sync + Relay ==========
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  syncPushNow: () => ipcRenderer.invoke('sync:push-now'),
  syncPullNow: () => ipcRenderer.invoke('sync:pull-now'),
  syncFullSync: () => ipcRenderer.invoke('sync:full-sync'),
  relayRequestTicket: (userId?: string) => ipcRenderer.invoke('relay:request-ticket', userId),
  relayStatus: () => ipcRenderer.invoke('relay:status'),
  pairGenerateCode: (terminalId: string) => ipcRenderer.invoke('pair:generate-code', terminalId),
  pairRevoke: (code: string) => ipcRenderer.invoke('pair:revoke', code),
  pairRevokeAll: () => ipcRenderer.invoke('pair:revoke-all'),
  pairListActive: () => ipcRenderer.invoke('pair:list-active'),
  listDevices: () => ipcRenderer.invoke('list-devices'),
  revokeDevice: (deviceId: string) => ipcRenderer.invoke('revoke-device', deviceId),
  revokeAllDevices: () => ipcRenderer.invoke('revoke-all-devices'),
  // ========== Auth: Register / Login / Pair Generate / State ==========
  authGetState: () => ipcRenderer.invoke('auth:get-state'),
  authRegister: (args: { email: string; password: string }) => ipcRenderer.invoke('auth:register', args),
  authLogin: (args: { email: string; password: string }) => ipcRenderer.invoke('auth:login', args),
  authPairGenerate: () => ipcRenderer.invoke('auth:pair-generate'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authUpdateSyncUrl: (url: string) => ipcRenderer.invoke('auth:update-sync-url', url),
  onRelayPaired: (callback: (data: { terminalId: string }) => void) => {
    const handler = (_event: any, terminalId: string) => callback({ terminalId });
    ipcRenderer.on('relay:paired', handler);
    return () => { ipcRenderer.removeListener('relay:paired', handler); };
  },

  // ========== Insight Engine ==========
  getDailyFunFact: () => ipcRenderer.invoke('insights:daily-fun-fact'),
  getInsightStrip: (params?: { period?: string }) => ipcRenderer.invoke('insights:strip', params || {}),
  getRewind: (period: string) => ipcRenderer.invoke('insights:rewind', { period }),

  // ========== Home Summary ==========
  getHomeSummary: () => ipcRenderer.invoke('get-home-summary'),

  // ========== Deep Focus ==========
  focus: {
    start: (cfg: { durationSec: number; strictness?: string }) => ipcRenderer.invoke('focus:start', cfg),
    end: (outcome?: string) => ipcRenderer.invoke('focus:end', outcome || 'aborted'),
    getState: () => ipcRenderer.invoke('focus:get-state'),
    history: (opts?: { limit?: number }) => ipcRenderer.invoke('focus:history', opts || {}),
    onState: (cb: (state: any) => void) => {
      const handler = (_event: any, state: any) => cb(state);
      ipcRenderer.on('focus:state', handler);
      return () => { ipcRenderer.removeListener('focus:state', handler); };
    },
     onEnded: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('focus:ended', handler);
      return () => { ipcRenderer.removeListener('focus:ended', handler); };
    },
  },

  focusGoal: {
    get: () => ipcRenderer.invoke('focusGoal:get'),
    save: (cfg: { lenient_goal_sec?: number; strict_goal_sec?: number }) => ipcRenderer.invoke('focusGoal:save', cfg || {}),
  },

  focusGroup: {
    list: () => ipcRenderer.invoke('focusGroup:list'),
    get: (id: number) => ipcRenderer.invoke('focusGroup:get', id),
    save: (g: any) => ipcRenderer.invoke('focusGroup:save', g),
    remove: (id: number) => ipcRenderer.invoke('focusGroup:remove', id),
    startWith: (id: number, durationSec?: number, strictness?: string) => ipcRenderer.invoke('focusGroup:startWith', id, durationSec, strictness),
    startWithMany: (ids: number[], durationSec?: number, strictness?: string) => ipcRenderer.invoke('focusGroup:startWithMany', ids, durationSec, strictness),
    linkUsage: (args: { sessionId: number; groupId: number; goalIds: string[] }) => ipcRenderer.invoke('focusGroup:linkUsage', args),
    getUsage: () => ipcRenderer.invoke('focusGroup:getUsage'),
  },

  // ========== Resume Builder ==========
  resume: {
    getProfile: () => ipcRenderer.invoke('resume:getProfile'),
    saveProfile: (profile: any) => ipcRenderer.invoke('resume:saveProfile', profile),
    getTakeaways: (filters?: any) => ipcRenderer.invoke('resume:getTakeaways', filters),
    saveTakeaway: (takeaway: any) => ipcRenderer.invoke('resume:saveTakeaway', takeaway),
    updateTakeaway: (id: string, updates: any) => ipcRenderer.invoke('resume:updateTakeaway', id, updates),
    deleteTakeaway: (id: string) => ipcRenderer.invoke('resume:deleteTakeaway', id),
    extractFromChat: (transcript: string, source: string) => ipcRenderer.invoke('resume:extractFromChat', transcript, source),
    getChatCompilations: () => ipcRenderer.invoke('resume:getChatCompilations'),
    deleteChatCompilation: (id: string) => ipcRenderer.invoke('resume:deleteChatCompilation', id),
    nextQuestion: (state: any) => ipcRenderer.invoke('resume:nextQuestion', state),
    submitAnswer: (questionId: string, answer: any, phase: number) => ipcRenderer.invoke('resume:submitAnswer', questionId, answer, phase),
    saveProgress: (progress: any) => ipcRenderer.invoke('resume:saveProgress', progress),
    loadProgress: () => ipcRenderer.invoke('resume:loadProgress'),
    compileResume: (data: any) => ipcRenderer.invoke('resume:compileResume', data),
    runHrReview: (resumeDraft: any, targetJd: string) => ipcRenderer.invoke('resume:runHrReview', resumeDraft, targetJd),
    getVersions: (profileId: string) => ipcRenderer.invoke('resume:getVersions', profileId),
    saveVersion: (version: any) => ipcRenderer.invoke('resume:saveVersion', version),
    deleteVersion: (id: string) => ipcRenderer.invoke('resume:deleteVersion', id),
    exportPdf: (versionId: string, format: string) => ipcRenderer.invoke('resume:exportPdf', versionId, format),
    getCertScans: () => ipcRenderer.invoke('resume:getCertScans'),
    saveCertScan: (scan: any) => ipcRenderer.invoke('resume:saveCertScan', scan),
    updateCertScan: (id: string, updates: any) => ipcRenderer.invoke('resume:updateCertScan', id, updates),
    uploadDocument: (file: any) => ipcRenderer.invoke('resume:uploadDocument', file),
    getDocuments: () => ipcRenderer.invoke('resume:getDocuments'),
    deleteDocument: (id: string) => ipcRenderer.invoke('resume:deleteDocument', id),
    getReports: () => ipcRenderer.invoke('resume:getReports'),
    getAiSettings: () => ipcRenderer.invoke('resume:getAiSettings'),
    saveAiSettings: (settings: any) => ipcRenderer.invoke('resume:saveAiSettings', settings),
    testAiConnection: (settings: any) => ipcRenderer.invoke('resume:testAiConnection', settings),
  },

  // ========== Agent Memory System ==========
  memoryGetHot: (limit?: number) => ipcRenderer.invoke('memory:get', 'hot', limit || 15),
  memoryGetByTier: (tier: string, limit?: number) => ipcRenderer.invoke('memory:get', tier, limit || 50),
  memorySearch: (query: string) => ipcRenderer.invoke('memory:search', query),
  memoryAdd: (content: string, category: string) => ipcRenderer.invoke('memory:add', content, category),
  memoryDelete: (id: string) => ipcRenderer.invoke('memory:delete', id),
  memoryStats: () => ipcRenderer.invoke('memory:stats'),
  memoryCompact: () => ipcRenderer.invoke('memory:compact'),

  // ========== User Context Profile ==========
  contextGetProfile: () => ipcRenderer.invoke('context:get-profile'),
  contextUpdateProfile: (patch: any) => ipcRenderer.invoke('context:update-profile', patch),
  contextAddSignal: (signalType: string, content: string, source: string, confidence?: number) => ipcRenderer.invoke('context:add-signal', signalType, content, source, confidence),
  contextGetSignals: (signalType?: string, source?: string, limit?: number) => ipcRenderer.invoke('context:get-signals', signalType, source, limit),
  contextRebuild: () => ipcRenderer.invoke('context:rebuild'),
  contextGetGrowth: () => ipcRenderer.invoke('context:get-growth'),
  contextGetMemoryHighlights: () => ipcRenderer.invoke('context:get-memory-highlights'),
  contextGetDebug: () => ipcRenderer.invoke('context:get-debug'),
  contextRunNow: (kind: string) => ipcRenderer.invoke('context:run-now', kind),

  // ========== Context Brain ==========
  brainSearch: (query: string, strategies?: string[]) => ipcRenderer.invoke('brain:search', query, strategies),
  brainGetEntity: (name: string) => ipcRenderer.invoke('brain:get-entity', name),
  brainGetEntityHistory: (name: string) => ipcRenderer.invoke('brain:get-entity-history', name),
  brainLogEpisode: (source: string, content: string, sourceRef?: string) => ipcRenderer.invoke('brain:log-episode', source, content, sourceRef),
  brainStats: () => ipcRenderer.invoke('brain:stats'),
  brainExport: () => ipcRenderer.invoke('brain:export'),
  brainGetEpisodes: (opts?: any) => ipcRenderer.invoke('brain:get-episodes', opts),
  brainGetEntities: (opts?: any) => ipcRenderer.invoke('brain:get-entities', opts),
  brainGetFacts: (opts?: any) => ipcRenderer.invoke('brain:get-facts', opts),
  brainGetEntityRelated: (entityId: string) => ipcRenderer.invoke('brain:get-entity-related', entityId),
  brainGetJobs: () => ipcRenderer.invoke('brain:get-jobs'),
  brainRetryJob: (jobId: string) => ipcRenderer.invoke('brain:retry-job', jobId),
  brainCreateEpisode: (data: { source: string; content: string; sourceRef?: string; metadata?: any }) => ipcRenderer.invoke('brain:create-episode', data),
  brainMcpStatus: () => ipcRenderer.invoke('brain:mcp-status'),
  brainReindexEmbeddings: () => ipcRenderer.invoke('brain:reindex-embeddings'),

  // ========== Smart Search Overlay ────────────────────────────────────────────
  smartSearchIndex: (segments: any[]) => ipcRenderer.invoke('smart-search:index', segments),
  smartSearchUnindexPage: (pageId: string) => ipcRenderer.invoke('smart-search:unindex-page', pageId),
  smartSearchQuery: (query: string, opts?: Record<string, any>) => ipcRenderer.invoke('smart-search:query', query, opts ?? {}),
  smartSearchSuggest: (query: string, opts?: Record<string, any>) => ipcRenderer.invoke('smart-search:suggest', query, opts ?? {}),
  smartSearchClear: () => ipcRenderer.invoke('smart-search:clear'),
  smartSearchStats: () => ipcRenderer.invoke('smart-search:stats'),

  // ========== Compositions System ==========`
  compositionsList: () => ipcRenderer.invoke('compositions:list'),
  compositionsGet: (id: string) => ipcRenderer.invoke('compositions:get', id),
  compositionsCreate: (data: any) => ipcRenderer.invoke('compositions:create', data),
  compositionsUpdate: (id: string, data: any) => ipcRenderer.invoke('compositions:update', id, data),
  compositionsDelete: (id: string) => ipcRenderer.invoke('compositions:delete', id),
  compositionsCompile: (dslSource: string) => ipcRenderer.invoke('compositions:compile', dslSource),
  compositionsValidate: (dslSource: string, manifestId: string) => ipcRenderer.invoke('compositions:validate', dslSource, manifestId),
  compositionsEvaluate: (ruleId: string, context?: any) => ipcRenderer.invoke('compositions:evaluate', ruleId, context),
  compositionsHistory: (ruleId?: string, limit?: number) => ipcRenderer.invoke('compositions:history', ruleId, limit),
  compositionsStatus: (ruleId?: string) => ipcRenderer.invoke('compositions:status', ruleId),
  compositionsSettingsGet: (key: string) => ipcRenderer.invoke('compositions:settings:get', key),
  compositionsSettingsSet: (key: string, value: string) => ipcRenderer.invoke('compositions:settings:set', key, value),
  // ── GAS Integration ──
  gasSync: (payload: any) => ipcRenderer.invoke('gas:sync', payload),
  gasExport: (payload: any) => ipcRenderer.invoke('gas:export', payload),

  // ── Lecture (SlideMind) ──
  lectureApi: (req: any) => ipcRenderer.invoke('lecture:api', req),
  lectureDigest: (url: string) => ipcRenderer.invoke('lecture:digest', url),
});

// R-10: Splash renderer preload bridge (single IPC channel for splash↔main)
contextBridge.exposeInMainWorld('splashAPI', {
  getBootAnimationConfig: () => ipcRenderer.invoke('boot-animation-config'),
  onReplay: (cb: () => void) => ipcRenderer.on('replay-splash', () => cb()),
  sendComplete: () => ipcRenderer.invoke('splash-complete'),
});

// R-10: Single preference getter (needed by SettingsPage mount-load)
ipcRenderer.invoke('get-preference');
