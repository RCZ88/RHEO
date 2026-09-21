import { ReactNode } from 'react';

export type TabId = 'category' | 'appearance' | 'colors' | 'general' | 'tracking' | 'prompts' | 'ai' | 'finance' | 'devices' | 'database' | 'auth' | 'shortcuts';

export interface StorageStatus {
  type: string;
  working: boolean;
  path: string;
  error?: string;
  logCount: number;
}

export interface TimerBehavior {
  neutralAction: 'pause' | 'reset' | 'ignore';
  distractingAction: 'pause' | 'reset' | 'ignore';
}

export interface TrackerAppMode {
  trackerAppMode: 'show-other' | 'pause' | 'track';
  setTrackerAppMode: (mode: 'show-other' | 'pause' | 'track') => void;
}

export interface SettingsPageProps {
  logs: any[];
  appStats: any[];
  storageStatus: StorageStatus;
  idleThreshold: number;
  setIdleThreshold: (val: number) => void;
  autoExport: boolean;
  setAutoExport: (val: boolean) => void;
  onClearData: () => void;
  onExportData: (format: 'csv' | 'json') => void;
  onViewDatabase: () => void;
  onRegisterSave: (fn: () => void) => void;
  onRequestNavigate: (path: string, hasUnsaved: boolean) => void;
  onHasChangesChange: (hasChanges: boolean) => void;
  onReloadData: () => void;
  onCategoryOverridesChange?: (overrides: Record<string, string>) => void;
  appColors?: Record<string, string>;
  setAppColors?: (colors: Record<string, string>) => void;
  categoryOrder?: string[];
  setCategoryOrder?: (order: string[]) => void;
  autoStartEnabled?: boolean;
  setAutoStartEnabled?: (enabled: boolean) => void;
  timerBehavior?: TimerBehavior;
  setTimerBehavior?: (behavior: TimerBehavior) => void;
  trackerAppMode?: 'show-other' | 'pause' | 'track';
  setTrackerAppMode?: (mode: 'show-other' | 'pause' | 'track') => void;
  externalActivities?: { id: number; name: string; type: string; is_productive: boolean }[];
  externalActivityTiers?: Record<number, string>;
  onExternalActivityTiersChange?: (tiers: Record<number, string>) => void;
}

// Section component prop types
export interface AppearanceSectionProps {
  animationSpeed: string;
  setAnimationSpeed: (speed: 'slow' | 'normal' | 'instant') => void;
  bootAnimEnabled: boolean;
  setBootAnimEnabled: (v: boolean) => void;
  bootAnimVariant: 'meridian' | 'minimal';
  setBootAnimVariant: (v: 'meridian' | 'minimal') => void;
  bootAnimWarm: boolean;
  setBootAnimWarm: (v: boolean) => void;
  bootAnimLoading: boolean;
  tbModeState: 'always' | 'hover' | 'auto';
  setTbModeState: (v: 'always' | 'hover' | 'auto') => void;
  hasChanges: boolean;
  onHasChangesChange: (v: boolean) => void;
}

export interface CategorySectionProps {
  tierAssignments: Record<string, string[]>;
  setTierAssignments: (v: Record<string, string[]>) => void;
  localAppColors: Record<string, string>;
  setLocalAppColors: (v: Record<string, string>) => void;
  localCategoryOrder: string[];
  setLocalCategoryOrder: (v: string[]) => void;
  appCategoryOverrides: Record<string, string>;
  setAppCategoryOverrides: (v: Record<string, string>) => void;
  domainCategoryOverrides: Record<string, string>;
  setDomainCategoryOverrides: (v: Record<string, string>) => void;
  customCategories: string[];
  setCustomCategories: (v: string[]) => void;
  newCategoryName: string;
  setNewCategoryName: (v: string) => void;
  categoryOrder: string[];
  setCategoryOrder?: (order: string[]) => void;
  appStats: any[];
  domainStats: any[];
  externalActivities: { id: number; name: string; type: string; is_productive: boolean }[];
  externalActivityTiers: Record<number, string>;
  onExternalActivityTiersChange?: (tiers: Record<number, string>) => void;
  hasChanges: boolean;
  onHasChangesChange: (v: boolean) => void;
  onRegisterSave: (fn: () => void) => void;
  onReloadData?: () => void;
  onCategoryOverridesChange?: (overrides: Record<string, string>) => void;
  dataSyncMode: string;
  setDataSyncMode: (v: string) => void;
  setHasChanges: (v: boolean) => void;
  setOnHasChangesChange: (v: boolean) => void;
  // dnd-kit
  sensors: any;
  activeId: string | null;
  activeContainer: string | null;
  editingAppCategory: string | null;
  setEditingAppCategory: (v: string | null) => void;
  editingDomainCategory: string | null;
  setEditingDomainCategory: (v: string | null) => void;
  appCarouselIndex: number;
  setAppCarouselIndex: (v: number) => void;
  domainCarouselIndex: number;
  setDomainCarouselIndex: (v: number) => void;
  appCarouselExpanded: boolean;
  setAppCarouselExpanded: (v: boolean) => void;
  domainCarouselExpanded: boolean;
  setDomainCarouselExpanded: (v: boolean) => void;
  appSearchQuery: string;
  setAppSearchQuery: (v: string) => void;
  domainSearchQuery: string;
  setDomainSearchQuery: (v: string) => void;
  appSearchFilter: string;
  setAppSearchFilter: (v: string) => void;
  domainSearchFilter: string;
  setDomainSearchFilter: (v: string) => void;
  showUncategorizedOnly: boolean;
  setShowUncategorizedOnly: (v: boolean) => void;
  editingExtActivity: number | null;
  setEditingExtActivity: (v: number | null) => void;
  extCarouselIndex: number;
  setExtCarouselIndex: (v: number) => void;
  extCarouselExpanded: boolean;
  setExtCarouselExpanded: (v: boolean) => void;
  // AI category
  aiRun: any;
  setAiRun: (v: any) => void;
  pendingChanges: any[];
  setPendingChanges: (v: any[]) => void;
  showApprovalModal: boolean;
  setShowApprovalModal: (v: boolean) => void;
  changeHistory: any[];
  setChangeHistory: (v: any[]) => void;
  showChangeHistory: boolean;
  setShowChangeHistory: (v: boolean) => void;
  lockedSkipped: string[];
  setLockedSkipped: (v: string[]) => void;
  // refactor
  refactorPhase: string;
  setRefactorPhase: (v: string) => void;
  refactorPreview: any;
  setRefactorPreview: (v: any) => void;
  refactorMessage: string;
  setRefactorMessage: (v: string) => void;
  refactorConfirmOpen: boolean;
  setRefactorConfirmOpen: (v: boolean) => void;
  refactorDoneCount: number;
  setRefactorDoneCount: (v: number) => void;
  // helpers
  findTier: (id: string) => string | null;
  removeCategoryFromTier: (tier: string, category: string) => void;
  getUnassignedCategories: () => string[];
  handleAddCategory: () => void;
  saveChanges: () => void;
  changeAppCategory: (app: string, cat: string) => void;
  getAppDisplayCategory: (app: any) => string;
  getCategoryColor: (cat: string) => string;
  allCategories: string[];
  DEFAULT_CATEGORIES: string[];
  settingsSearch: string;
  // approval
  approveChange: (id: string) => void;
  discardChange: (id: string) => void;
  approveAllChanges: () => void;
  discardAllChanges: () => void;
  editPendingChange: (id: string, cat: string) => void;
  undoChange: (id: string) => void;
  // domain keyword
  keywordEnabledDomains: string[];
  setKeywordEnabledDomains: (v: string[]) => void;
  domainKeywordSets: Record<string, { category: string; keywords: string[] }[]>;
  setDomainKeywordSets: (v: Record<string, { category: string; keywords: string[] }[]>) => void;
  editingKeywordDomain: string | null;
  setEditingKeywordDomain: (v: string | null) => void;
  editingKeywordSets: { category: string; keywords: string[] }[];
  setEditingKeywordSets: (v: { category: string; keywords: string[] }[]) => void;
  tempKeywordInput: string;
  setTempKeywordInput: (v: string) => void;
  tempCategoryForNewSet: string;
  setTempCategoryForNewSet: (v: string) => void;
  newKeywordDomain: string;
  setNewKeywordDomain: (v: string) => void;
  handleSaveSystemPrompt: (key: string, content: string) => void;
}

export interface PrivacySectionProps {
  filterTransientApps: boolean;
  setFilterTransientApps: (v: boolean) => void;
  browserRecordingMode: 'always' | 'on-view';
  setBrowserRecordingMode: (v: 'always' | 'on-view') => void;
  appRecordingMode: 'always' | 'on-view';
  setAppRecordingMode: (v: 'always' | 'on-view') => void;
  sleepGapMs: number;
  setSleepGapMs: (v: number) => void;
  maxSessionMs: number;
  setMaxSessionMs: (v: number) => void;
  trackingPollInterval: number;
  setTrackingPollInterval: (v: number) => void;
  availableBrowsers: string[];
  selectedBrowsers: string[];
  setSelectedBrowsers: (v: string[]) => void;
  serverStatus: any;
  // finance privacy
  financeCurrency: string;
  setFinanceCurrency: (v: string) => void;
  autoSave: boolean;
  setAutoSave: (v: boolean) => void;
  autoRecalc: boolean;
  setAutoRecalc: (v: boolean) => void;
  securitySettings: any;
  setSecuritySettings: (v: any) => void;
  originalSecuritySettings: any;
  passwordReqs: Record<string, boolean>;
  setPasswordReqs: (v: Record<string, boolean>) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  passwordError: string;
  setPasswordError: (v: string) => void;
  passwordSuccess: string;
  setPasswordSuccess: (v: string) => void;
  handleSetFinanceCurrency: (code: string) => void;
  handleSetRememberDevice: (remember: boolean, days: number) => void;
  handleSetLockTimeout: (timeoutMs: number) => void;
  handleChangePassword: () => void;
}

export interface IntegrationSectionProps {
  openRouterApiKey: string;
  setOpenRouterApiKey: (v: string) => void;
  apiKeyTestStatus: string;
  setApiKeyTestStatus: (v: string) => void;
  apiKeyTestMessage: string;
  setApiKeyTestMessage: (v: string) => void;
  aiConfig: any;
  setAiConfig: (v: any) => void;
  aiProviders: any[];
  setAiProviders: (v: any[]) => void;
  aiProviderRouting: any;
  setAiProviderRouting: (v: any) => void;
  providerTestStatus: Record<string, string>;
  setProviderTestStatus: (v: Record<string, string>) => void;
  providerTestMessages: Record<string, string>;
  setProviderTestMessages: (v: Record<string, string>) => void;
  showProviderApiKeys: Record<string, boolean>;
  setShowProviderApiKeys: (v: Record<string, boolean>) => void;
  interestTopics: string[];
  setInterestTopics: (v: string[]) => void;
  newTopic: string;
  setNewTopic: (v: string) => void;
  kbDocs: any[];
  setKbDocs: (v: any[]) => void;
  kbIngesting: boolean;
  setKbIngesting: (v: boolean) => void;
  kbQueryText: string;
  setKbQueryText: (v: string) => void;
  kbResults: any[];
  setKbResults: (v: any[]) => void;
  kbQuerying: boolean;
  setKbQuerying: (v: boolean) => void;
  kbFileInputRef: any;
  aiUsageStats: any;
  dataAccess: Record<string, boolean>;
  setDataAccess: (v: Record<string, boolean>) => void;
  agentColorOverrides: Record<string, string>;
  setAgentColorOverrides: (v: Record<string, string>) => void;
  sttApiKey: string;
  setSttApiKey: (v: string) => void;
  sttModel: string;
  setSttModel: (v: string) => void;
  sttBaseUrl: string;
  setSttBaseUrl: (v: string) => void;
  showSttKey: boolean;
  setShowSttKey: (v: boolean) => void;
}

export interface ShortcutSectionProps {
  shortcuts: Record<string, string>;
  setShortcuts: (v: Record<string, string>) => void;
  recordingKey: string | null;
  setRecordingKey: (v: string | null) => void;
  SHORTCUT_CONFIG: Record<string, { label: string; description: string; group: string }>;
  restoreDefaults: () => void;
}

export interface AdvancedSectionProps {
  idleThreshold: number;
  setIdleThreshold: (v: number) => void;
  autoExport: boolean;
  setAutoExport: (v: boolean) => void;
  autoStartEnabled: boolean;
  setAutoStartEnabled: (v: boolean) => void;
  timerBehavior: TimerBehavior;
  setLocalTimerBehavior: (v: TimerBehavior) => void;
  trackerAppMode: 'show-other' | 'pause' | 'track';
  setTrackerAppMode: (v: 'show-other' | 'pause' | 'track') => void;
  animationSpeed: string;
  setAnimationSpeed: (v: 'slow' | 'normal' | 'instant') => void;
  dataSyncMode: string;
  setDataSyncMode: (v: string) => void;
  storageStatus: StorageStatus;
  onExportData: (format: 'csv' | 'json') => void;
  onClearData: () => void;
  onReloadData?: () => void;
  hasChanges: boolean;
  onHasChangesChange: (v: boolean) => void;
  saveChanges: () => void;
}

export interface NotificationSectionProps {
  // Placeholder for notification settings if they exist
}

export interface ProfileSectionProps {
  // Placeholder for profile settings
}
