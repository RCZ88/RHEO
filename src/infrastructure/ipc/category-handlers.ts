/**
 * Category-related IPC handlers extracted from main.ts.
 * Registered via registerCategoryHandlers(db, state).
 */

import { BrowserWindow, ipcMain } from 'electron';
import Database from 'better-sqlite3';

// Types (mirrored from main.ts — could be moved to shared/types later)
interface CategoryConfig {
  appCategoryMap: Record<string, string>;
  domainCategoryMap: Record<string, string>;
  /**
   * Per-app / per-domain TIER overrides. Declared in main.ts since the schema
   * was written but never read or written anywhere, so "move this app from
   * productive to neutral" was impossible — changing an app's tier only ever
   * changed its CATEGORY, which moved every other app sharing that category too.
   */
  appTierMap: Record<string, Tier>;
  domainTierMap: Record<string, Tier>;
  domainKeywordRules: Record<string, { category: string; keywords: string[] }[]>;
  domainDefaultCategories: Record<string, string>;
  tierAssignments: {
    productive: string[];
    neutral: string[];
    distracting: string[];
  };
  customCategories: string[];
  lockedApps: Record<string, boolean>;
  lockedDomains: Record<string, boolean>;
  keywordEnabledDomains: Record<string, boolean>;
  aiChangeHistory: Array<{
    id: string;
    timestamp: string;
    name: string;
    type: 'app' | 'domain';
    previousCategory: string;
    newCategory: string;
    source: 'ai' | 'manual';
  }>;
}

export type Tier = 'productive' | 'neutral' | 'distracting';

const VALID_TIERS: Tier[] = ['productive', 'neutral', 'distracting'];

export interface CategoryHandlerDeps {
  db: Database.Database;
  categoryConfig: CategoryConfig;
  mainWindow: BrowserWindow | null;
  currentApp: string | null;
  saveCategoryConfig: () => void;
  categorizeApp: (appName: string) => string;
}

const DEFAULT_CATEGORIES = [
  'IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication',
  'Design', 'Productivity', 'Tools', 'Education', 'Developer Tools',
  'Search Engine', 'News', 'Shopping', 'Social Media', 'Gaming', 'Uncategorized', 'Other'
];

export function registerCategoryHandlers(deps: CategoryHandlerDeps) {
  const { db, categoryConfig, mainWindow, currentApp, saveCategoryConfig, categorizeApp } = deps;

  ipcMain.handle('get-category-config', () => {
    return categoryConfig;
  });

  // Locked items: the renderer calls these on Settings mount. Without a handler
  // the invoke() rejects, the unhandled rejection hits window.onunhandledrejection
  // and the ErrorBoundary unmounts the whole app (3x auto-reload loop).
  ipcMain.handle('get-locked-items', () => ({
    lockedApps: categoryConfig.lockedApps || {},
    lockedDomains: categoryConfig.lockedDomains || {},
  }));

  ipcMain.handle('set-locked-items', (_event, payload: { lockedApps?: Record<string, boolean>; lockedDomains?: Record<string, boolean> }) => {
    if (payload?.lockedApps) categoryConfig.lockedApps = { ...categoryConfig.lockedApps, ...payload.lockedApps };
    if (payload?.lockedDomains) categoryConfig.lockedDomains = { ...categoryConfig.lockedDomains, ...payload.lockedDomains };
    saveCategoryConfig();
    return { lockedApps: categoryConfig.lockedApps, lockedDomains: categoryConfig.lockedDomains };
  });

  ipcMain.handle('get-unlocked-items', (_event, items: string[], isApp: boolean) => {
    const locks = (isApp ? categoryConfig.lockedApps : categoryConfig.lockedDomains) || {};
    return (items || []).filter((i: string) => !locks[i]);
  });

  ipcMain.handle('get-keyword-enabled-domains', () => categoryConfig.keywordEnabledDomains || {});

  ipcMain.handle('set-app-category', (_event, appName: string, category: string) => {
    categoryConfig.appCategoryMap[appName] = category;
    saveCategoryConfig();
    try {
      db.prepare('INSERT OR REPLACE INTO category_overrides (app, category) VALUES (?, ?)').run(appName, category);
    } catch (err) {
      console.error('[DeskFlow] Failed to save app category override to DB:', err);
    }
    if (mainWindow && !mainWindow.isDestroyed() && currentApp && currentApp.toLowerCase() === appName.toLowerCase()) {
      categorizeApp(currentApp);
    }
  });

  ipcMain.handle('set-domain-category', (_event, domain: string, category: string) => {
    categoryConfig.domainCategoryMap[domain] = category;
    saveCategoryConfig();
    try {
      db.prepare('INSERT OR REPLACE INTO domain_category_overrides (domain, category) VALUES (?, ?)').run(domain, category);
    } catch (err) {
      console.error('[DeskFlow] Failed to save domain category override to DB:', err);
    }
  });

  ipcMain.handle('set-domain-default-category', (_event, domain: string, category: string) => {
    categoryConfig.domainDefaultCategories[domain] = category;
    saveCategoryConfig();
  });

  ipcMain.handle('get-domain-default-category', (_event, domain: string) => {
    return categoryConfig.domainDefaultCategories[domain] || null;
  });

  ipcMain.handle('add-category', (_event, name: string) => {
    if (!categoryConfig.customCategories) categoryConfig.customCategories = [];
    if (categoryConfig.customCategories.includes(name)) return false;
    if (DEFAULT_CATEGORIES.includes(name)) return false;
    categoryConfig.customCategories.push(name);
    if (!categoryConfig.tierAssignments.neutral.includes(name)) {
      categoryConfig.tierAssignments.neutral.push(name);
    }
    saveCategoryConfig();
    return true;
  });

  ipcMain.handle('remove-category', (_event, name: string) => {
    categoryConfig.customCategories = (categoryConfig.customCategories || []).filter(c => c !== name);
    categoryConfig.tierAssignments.productive = categoryConfig.tierAssignments.productive.filter(c => c !== name);
    categoryConfig.tierAssignments.neutral = categoryConfig.tierAssignments.neutral.filter(c => c !== name);
    categoryConfig.tierAssignments.distracting = categoryConfig.tierAssignments.distracting.filter(c => c !== name);
    saveCategoryConfig();
    return true;
  });

  ipcMain.handle('get-tier-assignments', () => {
    return categoryConfig.tierAssignments;
  });

  // Write counterpart to get-tier-assignments. Without it the Settings save
  // aborts on its FIRST await, so nothing after it is ever persisted.
  ipcMain.handle('set-tier-assignments', (_event, tiers: { productive?: string[]; neutral?: string[]; distracting?: string[] }) => {
    if (tiers) {
      categoryConfig.tierAssignments = {
        productive: tiers.productive || categoryConfig.tierAssignments.productive,
        neutral: tiers.neutral || categoryConfig.tierAssignments.neutral,
        distracting: tiers.distracting || categoryConfig.tierAssignments.distracting,
      };
      saveCategoryConfig();
    }
    return categoryConfig.tierAssignments;
  });

  // ── Per-app / per-domain TIER overrides ───────────────────────────────────
  // preload.ts has exposed setAppTier / setDomainTier since before this file
  // existed, but no handler was ever registered, so the AI tools
  // `setAppTier` / `setDomainTier` (src/services/ai/toolRegistry.ts) rejected at
  // runtime and there was no UI path to re-tier a single app. These write
  // categoryConfig.appTierMap / domainTierMap — the fields main.ts has always
  // declared but never touched.
  ipcMain.handle('get-app-tier-map', () => categoryConfig.appTierMap || {});
  ipcMain.handle('get-domain-tier-map', () => categoryConfig.domainTierMap || {});

  ipcMain.handle('set-app-tier', (_event, appName: string, tier: Tier) => {
    if (!appName || !VALID_TIERS.includes(tier)) return false;
    categoryConfig.appTierMap = categoryConfig.appTierMap || {};
    if (categoryConfig.appTierMap[appName] === tier) return true;
    categoryConfig.appTierMap[appName] = tier;
    saveCategoryConfig();
    return true;
  });

  ipcMain.handle('set-domain-tier', (_event, domain: string, tier: Tier) => {
    if (!domain || !VALID_TIERS.includes(tier)) return false;
    categoryConfig.domainTierMap = categoryConfig.domainTierMap || {};
    if (categoryConfig.domainTierMap[domain] === tier) return true;
    categoryConfig.domainTierMap[domain] = tier;
    saveCategoryConfig();
    return true;
  });

  /** Clearing the override returns the app/domain to its category-derived tier. */
  ipcMain.handle('clear-app-tier', (_event, appName: string) => {
    if (!categoryConfig.appTierMap?.[appName]) return false;
    delete categoryConfig.appTierMap[appName];
    saveCategoryConfig();
    return true;
  });

  ipcMain.handle('clear-domain-tier', (_event, domain: string) => {
    if (!categoryConfig.domainTierMap?.[domain]) return false;
    delete categoryConfig.domainTierMap[domain];
    saveCategoryConfig();
    return true;
  });

  // --- AI change history -------------------------------------------------
  // The read side was never registered: SettingsPage calls get-ai-change-history
  // on mount, and the rejected invoke surfaced as a console error.
  ipcMain.handle('get-ai-change-history', () => categoryConfig.aiChangeHistory || []);

  ipcMain.handle('add-ai-change-history', (_event, entry: {
    id?: string; timestamp?: string; name?: string; type?: 'app' | 'domain';
    previousCategory?: string; newCategory?: string; source?: 'ai' | 'manual';
  }) => {
    if (entry && entry.name) {
      const isApp = entry.type !== 'domain';
      const map = isApp ? categoryConfig.appCategoryMap : categoryConfig.domainCategoryMap;
      if (entry.previousCategory) {
        if (isApp) categoryConfig.appCategoryMap[entry.name] = entry.previousCategory;
        else categoryConfig.domainCategoryMap[entry.name] = entry.previousCategory;
      }
      if (entry.newCategory) {
        map[entry.name] = entry.newCategory;
      }
      categoryConfig.aiChangeHistory = categoryConfig.aiChangeHistory || [];
      categoryConfig.aiChangeHistory.push({
        id: entry.id || `chg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: entry.timestamp || new Date().toISOString(),
        name: entry.name,
        type: isApp ? 'app' : 'domain',
        previousCategory: entry.previousCategory || '',
        newCategory: entry.newCategory || '',
        source: entry.source || 'ai',
      });
      // Keep the log bounded so it cannot grow without limit on disk.
      if (categoryConfig.aiChangeHistory.length > 200) {
        categoryConfig.aiChangeHistory.splice(0, categoryConfig.aiChangeHistory.length - 200);
      }
    }
    saveCategoryConfig();
    return categoryConfig.aiChangeHistory || [];
  });

  ipcMain.handle('undo-ai-change', (_event, changeId: string) => {
    const history = categoryConfig.aiChangeHistory || [];
    const idx = history.findIndex((c: any) => c.id === changeId);
    if (idx !== -1) {
      const [change] = history.splice(idx, 1);
      const map = change.type === 'domain' ? categoryConfig.domainCategoryMap : categoryConfig.appCategoryMap;
      if (change.previousCategory) map[change.name] = change.previousCategory;
      else delete map[change.name];
      saveCategoryConfig();
    }
    return categoryConfig.aiChangeHistory || [];
  });

  ipcMain.handle('redo-ai-change', (_event, entry: any) => {
    if (entry?.name) {
      const isApp = entry.type !== 'domain';
      const map = isApp ? categoryConfig.appCategoryMap : categoryConfig.domainCategoryMap;
      if (entry.newCategory) map[entry.name] = entry.newCategory;
      saveCategoryConfig();
    }
    return categoryConfig.aiChangeHistory || [];
  });

  ipcMain.handle('clear-ai-change-history', () => {
    categoryConfig.aiChangeHistory = [];
    saveCategoryConfig();
    return [];
  });

  // --- Per-domain keyword rules -----------------------------------------
  ipcMain.handle('get-domain-keyword-rules', (_event, domain: string) =>
    (categoryConfig.domainKeywordRules || {})[domain] || []
  );

  ipcMain.handle('set-domain-keyword-rules', (_event, domain: string, rules: { category: string; keywords: string[] }[]) => {
    categoryConfig.domainKeywordRules[domain] = rules || [];
    saveCategoryConfig();
    return categoryConfig.domainKeywordRules[domain];
  });

  ipcMain.handle('add-keyword-domain', (_event, domain: string, keywordSets: { category: string; keywords: string[] }[]) => {
    categoryConfig.domainKeywordRules[domain] = keywordSets || [];
    saveCategoryConfig();
    return categoryConfig.domainKeywordRules[domain];
  });

  ipcMain.handle('remove-keyword-domain', (_event, domain: string) => {
    delete categoryConfig.domainKeywordRules[domain];
    saveCategoryConfig();
    return true;
  });

  ipcMain.handle('apply-category-to-historical', async (_event) => {
    saveCategoryConfig();
  });
}
