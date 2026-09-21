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
  domainKeywordRules: Record<string, string[]>;
  domainDefaultCategories: Record<string, string>;
  tierAssignments: {
    productive: string[];
    neutral: string[];
    distracting: string[];
  };
  customCategories: string[];
}

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

  ipcMain.handle('add-ai-change-history', (_event) => {
    saveCategoryConfig();
  });

  ipcMain.handle('redo-ai-change', (_event) => {
    saveCategoryConfig();
  });

  ipcMain.handle('apply-category-to-historical', async (_event) => {
    saveCategoryConfig();
  });
}
