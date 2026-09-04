import { contextBridge, ipcRenderer } from 'electron';

// Bridge external-data-changed IPC event to window CustomEvent
// This allows main process to trigger renderer-side data refreshes
ipcRenderer.on('external-data-changed', () => {
  window.dispatchEvent(new CustomEvent('external-data-changed'));
});

contextBridge.exposeInMainWorld('deskflowAPI', {
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
  getDashboardAggregates: (request: { period: string; dateOffset?: number; weekOffset?: number }) =>
    ipcRenderer.invoke('get-dashboard-aggregates', request),

  // New: app stats for StatsPage
  getAppStats: (request: { period: string; dateOffset?: number }) =>
    ipcRenderer.invoke('get-app-stats', request),

  // Domain/website stats (aggregated in SQL)
  getDomainStats: (request: { period: string; dateOffset?: number }) =>
    ipcRenderer.invoke('get-domain-stats', request),

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

  // Set user preference
  setPreference: (key: string, value: any) => ipcRenderer.invoke('set-preference', key, value),

  // Get custom AI agent storage paths
  getAIAgentCustomPaths: () => ipcRenderer.invoke('get-ai-agent-custom-paths'),

  // Set custom path for an AI agent plugin
  setAIAgentCustomPath: (pluginId: string, dirPath: string) => ipcRenderer.invoke('set-ai-agent-custom-path', pluginId, dirPath),

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
  getCurrentForeground: () => ipcRenderer.invoke('get-current-foreground'),

  // App control
  quitApp: () => ipcRenderer.invoke('quit-app'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  getAutoStartStatus: () => ipcRenderer.invoke('get-auto-start-status'),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('set-auto-start', enabled),

  // Category Configuration
  getCategoryConfig: () => ipcRenderer.invoke('get-category-config'),
  setAppCategory: (appName: string, category: string) => ipcRenderer.invoke('set-app-category', appName, category),
  setDomainCategory: (domain: string, category: string) => ipcRenderer.invoke('set-domain-category', domain, category),
  setAppTier: (appName: string, tier: string) => ipcRenderer.invoke('set-app-tier', appName, tier),
  setDomainTier: (domain: string, tier: string) => ipcRenderer.invoke('set-domain-tier', domain, tier),
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
  scanIdeDefaultProjects: () => ipcRenderer.invoke('scan-ide-default-projects'),
  scanCustomDirectory: (rootDir: string) => ipcRenderer.invoke('scan-custom-directory', rootDir),
  getCustomScanDirs: () => ipcRenderer.invoke('get-custom-scan-dirs'),
  saveCustomScanDirs: (dirs: string[]) => ipcRenderer.invoke('save-custom-scan-dirs', dirs),

  // Run Project Feature
  detectProjectScripts: (projectPath: string) => ipcRenderer.invoke('detect-project-scripts', projectPath),
  getProjectRunConfig: (projectId: string) => ipcRenderer.invoke('get-project-run-config', projectId),
  saveProjectRunConfig: (projectId: string, config: any) => ipcRenderer.invoke('save-project-run-config', projectId, config),
  getAllRunConfigs: () => ipcRenderer.invoke('get-all-run-configs'),
  runProject: (projectId: string, config: any) => ipcRenderer.invoke('run-project', projectId, config),
  executeProjectCommand: (terminalId: string, command: string) => ipcRenderer.invoke('execute-project-command', terminalId, command),
  stopProject: (terminalId: string) => ipcRenderer.invoke('stop-project', terminalId),
  getRunningProjects: () => ipcRenderer.invoke('get-running-projects'),
  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),

  // AI & Git Metrics
  getAIUsageSummary: (period?: string, dateOffset?: number, projectId?: string) => ipcRenderer.invoke('get-ai-usage-summary', period, dateOffset, projectId),
  getCommitStats: (projectId?: string, period?: 'week' | 'month') => ipcRenderer.invoke('get-commit-stats', projectId, period),

  // Dashboard Overview
  getIDEProjectsOverview: (period?: string, dateOffset?: number) => ipcRenderer.invoke('get-ide-projects-overview', period, dateOffset),

  // AI Usage Sync
  syncAIUsage: () => ipcRenderer.invoke('sync-ai-usage'),
  getAISyncStatus: () => ipcRenderer.invoke('get-ai-sync-status'),
  clearAISyncState: () => ipcRenderer.invoke('clear-ai-sync-state'),
  debugAIAgents: () => ipcRenderer.invoke('debug-ai-agents'),
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
  spawnTerminal: (terminalId: string, cwd?: string, agentType?: string) => ipcRenderer.invoke('spawn-terminal', terminalId, cwd, agentType),
  writeTerminal: (terminalId: string, data: string) => ipcRenderer.invoke('write-terminal', terminalId, data),
  resizeTerminal: (terminalId: string, cols: number, rows: number) => ipcRenderer.invoke('resize-terminal', terminalId, cols, rows),
  killTerminal: (terminalId: string) => ipcRenderer.invoke('kill-terminal', terminalId),
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

  // Consolidated Terminal API (new format G�� single arg objects)
  terminalWrite: (terminalId: string, data: string) => ipcRenderer.invoke('terminal:write-old-format', terminalId, data),
  terminalWriteRaw: (terminalId: string, data: string) => ipcRenderer.invoke('terminal:write-raw', terminalId, data),
  terminalResize: (terminalId: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize-old-format', terminalId, cols, rows),
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
    onData: (callback: (id: string, data: string) => void) => {
      ipcRenderer.on('terminal:data', (_event, id, data) => callback(id, data));
    },
    removeDataListener: () => {
      ipcRenderer.removeAllListeners('terminal:data');
    }
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
  captureOpencodeSessionId: (workspaceDir: string) => ipcRenderer.invoke('capture-opencode-session-id', workspaceDir),
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
  startAfkSession: () => ipcRenderer.invoke('start-afk-session'),
  stopAfkSession: (newActivityId?: string) => ipcRenderer.invoke('stop-afk-session', newActivityId),
  reclassifyAfkSession: (sessionId: number, newActivityId: number) => ipcRenderer.invoke('reclassify-afk-session', sessionId, newActivityId),
  debugSaveAfk: (data: { activityId: string; startedAt: string; endedAt: string }) => ipcRenderer.invoke('debug-save-afk', data),
  batchSaveAfkSegments: (segments: Array<{ activityId: string; startedAt: string; endedAt: string }>) => ipcRenderer.invoke('batch-save-afk-segments', { segments }),
  stopExternalSession: (sessionId: string, endTime?: string, deviceOffToSleepSeconds?: number, wakeUpToAppSeconds?: number) => ipcRenderer.invoke('stop-external-session', sessionId, endTime, deviceOffToSleepSeconds, wakeUpToAppSeconds),
  updateExternalSession: (sessionId: string, updates: { duration_seconds?: number; started_at?: string; ended_at?: string }) => ipcRenderer.invoke('update-external-session', sessionId, updates),
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
  computeAdjacentGaps: (params: { sleepStartIso: string; sleepEndIso: string }) => ipcRenderer.invoke('compute-adjacent-gaps', params),
  confirmSleep: (sleepData: { started_at: string; ended_at: string; device_off_to_sleep_seconds: number; wake_up_to_app_seconds: number }) => ipcRenderer.invoke('confirm-sleep', sleepData),
  dismissSleepDetection: () => ipcRenderer.invoke('dismiss-sleep-detection'),
  addExternalTime: (activityId: string, durationMinutes: number, started_at?: string, ended_at?: string) => ipcRenderer.invoke('add-external-time', { activityId, durationMinutes, started_at, ended_at }),
   getExternalStats: (period: 'today' | 'week' | 'month' | 'all') => ipcRenderer.invoke('get-external-stats', period),
   getSleepDebug: (period: string = 'week', dateOffset = 0) => ipcRenderer.invoke('get-sleep-debug', period, dateOffset),
   fixSleepDates: () => ipcRenderer.invoke('fix-sleep-dates'),
   getComparisonStats: (period: 'today' | 'week' | 'month' | 'all') => ipcRenderer.invoke('get-comparison-stats', period),
   updateActivityChartPreference: (activityId: string, chartType: string) => ipcRenderer.invoke('update-activity-chart-preference', activityId, chartType),
   getSleepTrends: (period: string, dateOffset = 0) => ipcRenderer.invoke('get-sleep-trends', period, dateOffset),
  getConsistencyScore: (period: 'week' | 'month') => ipcRenderer.invoke('get-consistency-score', period),
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

  // ========== MultiG��Provider AI / Goal Features ==========
  getAiProviders: () => ipcRenderer.invoke('get-ai-providers'),
  saveAiProviders: (state: any) => ipcRenderer.invoke('save-ai-providers', state),
  testAiProvider: (providerId: string) => ipcRenderer.invoke('test-ai-provider', providerId),

  // Streaming provider chat (AiChat)
  providerChatCall: (data: { provider: any; messages: Array<{ role: string; content: string }>; model?: string; maxTokens?: number; temperature?: number }) =>
    ipcRenderer.invoke('provider-chat-call', data),
  providerChatBasic: (data: { provider: any; messages: Array<{ role: string; content: string }>; model?: string; maxTokens?: number; temperature?: number }) =>
    ipcRenderer.invoke('provider-chat-basic', data),
  onProviderChunk: (callback: (data: { delta?: string; done?: boolean; error?: string; full?: string; diagId?: string; durationMs?: number; providerId?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('provider-chunk', handler);
    return () => { ipcRenderer.removeListener('provider-chunk', handler); };
  },
  getProviderDiagnostics: () => ipcRenderer.invoke('get-provider-diagnostics'),
  clearProviderLogs: () => ipcRenderer.invoke('clear-provider-logs'),

  getGoals: (date: string) => ipcRenderer.invoke('get-goals', date),
  getGoalsBatch: (startDate: string, endDate: string) => ipcRenderer.invoke('get-goals-batch', startDate, endDate),
  getLongtermGoals: () => ipcRenderer.invoke('get-longterm-goals'),
  saveGoal: (date: string, goal: any) => ipcRenderer.invoke('save-goal', date, goal),
  deleteGoal: (goalId: string) => ipcRenderer.invoke('delete-goal', goalId),
  saveGoalReview: (date: string, reviewSummary: string) => ipcRenderer.invoke('save-goal-review', date, reviewSummary),
  getGoalContext: () => ipcRenderer.invoke('get-goal-context'),
  parseGoalFeedback: (data: { message: string; goals: string[] }) => ipcRenderer.invoke('parse-goal-feedback', data),
  parseGoalDump: (text: string) => ipcRenderer.invoke('parse-goal-dump', text),
  suggestGoals: (date: string, ctx?: any) => ipcRenderer.invoke('suggest-goals', date, ctx),
  reviewGoals: (date: string) => ipcRenderer.invoke('review-goals', date),

  // Goal hierarchy (parent_id decomposition)
  getGoal: (goalId: string) => ipcRenderer.invoke('get-goal', goalId),
  getChildGoals: (parentId: string) => ipcRenderer.invoke('get-child-goals', parentId),
  saveGoalsBatch: (goals: any[]) => ipcRenderer.invoke('save-goals-batch', goals),
  linkGoalToEntity: (goalId: string, link: { type: 'problem' | 'request'; id: string; label?: string }) => ipcRenderer.invoke('link-goal-to-entity', goalId, link),
  unlinkGoalFromEntity: (goalId: string, type: 'problem' | 'request', entityId: string) => ipcRenderer.invoke('unlink-goal-from-entity', goalId, type, entityId),

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
    items: (id: string, opts?: { type?: string; limit?: number }) => ipcRenderer.invoke('connectors:items', id, opts),
    status: (id: string) => ipcRenderer.invoke('connectors:status', id),
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
  financeGetWallet: (id: number) => ipcRenderer.invoke('finance:get-wallet', id),
  financeUpdateWalletMetadata: (payload: { id: number; metadata: Record<string, any> }) => ipcRenderer.invoke('finance:update-wallet-metadata', payload),
  financeFetchCryptoPrices: (coinIds: string[], currency?: string) => ipcRenderer.invoke('finance:fetch-crypto-prices', coinIds, currency || 'usd'),
  financeGetCryptoHistory: (coinId: string, days?: number, currency?: string) => ipcRenderer.invoke('finance:get-crypto-history', coinId, days, currency || 'usd'),

  financeGetCategories: () => ipcRenderer.invoke('finance:get-categories'),
  financeCreateCategory: (data: any) => ipcRenderer.invoke('finance:create-category', data),
  financeUpdateCategory: (data: any) => ipcRenderer.invoke('finance:update-category', data),

  financeGetTransactions: (filters?: any) => ipcRenderer.invoke('finance:get-transactions', filters),
  financeCreateTransaction: (data: any) => ipcRenderer.invoke('finance:create-transaction', data),
  financeCreateTransfer: (data: any) => ipcRenderer.invoke('finance:create-transfer', data),
  financeUpdateTransaction: (data: any) => ipcRenderer.invoke('finance:update-transaction', data),
  financeDeleteTransaction: (id: number) => ipcRenderer.invoke('finance:delete-transaction', id),
  financeBatchUpdateCategory: (ids: number[], categoryId: number) =>
    ipcRenderer.invoke('finance:batch-update-category', { ids, categoryId }),

  financeGetSummary: () => ipcRenderer.invoke('finance:get-summary'),
  financeGetSpendingByCategory: () => ipcRenderer.invoke('finance:get-spending-by-category'),
  financeGetMonthlyTrends: () => ipcRenderer.invoke('finance:get-monthly-trends'),

  financeIsLocked: () => ipcRenderer.invoke('finance:is-locked'),
  financeUnlock: (password: string) => ipcRenderer.invoke('finance:unlock', password),
  financeLock: () => ipcRenderer.invoke('finance:lock'),
  financeSetPassword: (password: string) => ipcRenderer.invoke('finance:set-password', password),
  financeChangePassword: (currentPassword: string, nextPassword: string) => ipcRenderer.invoke('finance:change-password', currentPassword, nextPassword),
  financeVerifyPassword: (password: string) => ipcRenderer.invoke('finance:verify-password', password),
  financeCheckPasswordSetup: () => ipcRenderer.invoke('finance:check-password-setup'),
  financeSetRememberDevice: (remember: boolean, days: number) => ipcRenderer.invoke('finance:set-remember-device', remember, days),
  financeSetLockTimeout: (timeoutMs: number) => ipcRenderer.invoke('finance:set-lock-timeout', timeoutMs),
  financeGetSecuritySettings: () => ipcRenderer.invoke('finance:get-security-settings'),
  financeCheckPageAccess: () => ipcRenderer.invoke('finance:check-page-access'),
  financeBiometricUnlock: () => ipcRenderer.invoke('finance:biometric-unlock'),
  financeGetWebAuthnCredential: () => ipcRenderer.invoke('finance:get-webauthn-credential'),
  financeStoreWebAuthnCredential: (credentialId: string) => ipcRenderer.invoke('finance:store-webauthn-credential', credentialId),

  financeGetDisplayCurrency: () => ipcRenderer.invoke('finance:get-display-currency'),
  financeSetDisplayCurrency: (currency: string) => ipcRenderer.invoke('finance:set-display-currency', currency),

  financeGetArchivedAccounts: () => ipcRenderer.invoke('finance:get-archived-accounts'),
  financeGetArchivedWallets: () => ipcRenderer.invoke('finance:get-archived-wallets'),
  financeUnarchiveAccount: (id: number) => ipcRenderer.invoke('finance:unarchive-account', id),
  financeUnarchiveWallet: (id: number) => ipcRenderer.invoke('finance:unarchive-wallet', id),
  financeDeleteAccount: (id: number) => ipcRenderer.invoke('finance:delete-account', id),
  financeDeleteWallet: (id: number) => ipcRenderer.invoke('finance:delete-wallet', id),
  financeGetPasswordRequirements: () => ipcRenderer.invoke('finance:get-password-requirements'),
  financeSetPasswordRequirement: (key: string, value: boolean) => ipcRenderer.invoke('finance:set-password-requirement', key, value),

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

  // ========== Agent Prompts ==========
  agentPrompts: {
    list: (params?: { sessionId?: string; projectId?: string }) => ipcRenderer.invoke('prompts:list', params),
    get: (id: string) => ipcRenderer.invoke('prompts:get', { id }),
    create: (data: { sessionId?: string; projectId?: string; content: string; title?: string; category?: string; tags?: string[] }) => ipcRenderer.invoke('prompts:create', data),
    update: (data: { id: string; status?: string; progress?: number; resultSummary?: string; title?: string; category?: string; tags?: string[] }) => ipcRenderer.invoke('prompts:update', data),
    delete: (id: string) => ipcRenderer.invoke('prompts:delete', { id }),
  },

  // ========== Lyceum Learn Module ==========
  learnImportLdoc: ({ json }: { json: unknown }) => ipcRenderer.invoke('learn:importLdoc', { json }),
  learnValidate: ({ json }: { json: unknown }) => ipcRenderer.invoke('learn:validate', { json }),
  learnListLessons: (params?: { branchId?: string; part?: number; chapter?: string; subtopic?: string }) => ipcRenderer.invoke('learn:listLessons', params || {}),
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

  // ========== Smart Gap Fill ==========
  getKnownApps: () => ipcRenderer.invoke('get-known-apps'),
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
  },

  // ========== Workspace close guard ==========
  onWorkspaceRequestSave: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('workspace-request-save', handler);
    return () => { ipcRenderer.removeListener('workspace-request-save', handler); };
  },
  workspaceAllowClose: () => ipcRenderer.send('workspace-allow-close'),

  // ========== Feature #1: Resource Stats ==========
  getResourceStats: () => ipcRenderer.invoke('terminal:get-resource-stats'),
  onResourceStats: (callback: (stats: Record<string, any>) => void) => {
    const handler = (_event: any, terminalId: string, stats: any) => { callback({ [terminalId]: stats }); };
    ipcRenderer.on('terminal:resource-stats', handler);
    return () => { ipcRenderer.removeListener('terminal:resource-stats', handler); };
  },

  // ========== Feature #2: Model Switcher ==========
  detectModels: (agentType?: string) => ipcRenderer.invoke('models:detect', agentType),
  setSessionModel: (terminalId: string, model: string, agentType?: string) => ipcRenderer.invoke('agent:set-model', terminalId, model, agentType),
  onModelChanged: (callback: (data: { terminalId: string; model: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('agent:model-changed', handler);
    return () => { ipcRenderer.removeListener('agent:model-changed', handler); };
  },

  // ========== Feature #3: CLI Anomaly + Update ==========
  onTerminalAnomaly: (callback: (data: { terminalId: string; kind: string; type: string; severity: string; detail: string; ts: number }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('terminal:anomaly', handler);
    return () => { ipcRenderer.removeListener('terminal:anomaly', handler); };
  },
  onCliUpdateAvailable: (callback: (list: Array<{ agent: string; current: string; latest: string; pkg: string }>) => void) => {
    const handler = (_event: any, list: any) => callback(list);
    ipcRenderer.on('cli:update-available', handler);
    return () => { ipcRenderer.removeListener('cli:update-available', handler); };
  },
  checkCliUpdates: () => ipcRenderer.invoke('cli:check-updates'),

  // ========== Feature #4: Config Generator ==========
  generateAgentConfigs: (opts: { agent: string; scope: string; baseDir?: string; customDir?: string; overwrite?: boolean }) =>
    ipcRenderer.invoke('config:generate', opts),
  previewAgentConfigs: (opts: { agent: string; scope: string; baseDir?: string; customDir?: string }) =>
    ipcRenderer.invoke('config:preview', opts),
});
