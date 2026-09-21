/**
 * IPC Handler Infrastructure
 * 
 * All IPC handlers are extracted from main.ts into category-specific modules.
 * This index registers all handlers with the main process.
 */

import Database from 'better-sqlite3';
import { BrowserWindow } from 'electron';
import { registerCategoryHandlers } from './category-handlers';
import { registerGoalHandlers } from './goal-handlers';
import { registerFinanceHandlers } from './finance-handlers';

export interface IPCHandlerDeps {
  db: Database.Database;
  mainWindow: BrowserWindow | null;
  currentApp: string | null;
  userPreferences: Record<string, any>;
  financePasswordHash: string | null;
  getLocalDateStr: (d?: Date) => string;
  toInt: (v: unknown) => number;
}

export function registerAllHandlers(deps: IPCHandlerDeps) {
  // Category handlers
  registerCategoryHandlers({
    db: deps.db,
    categoryConfig: {} as any,
    mainWindow: deps.mainWindow,
    currentApp: deps.currentApp,
    saveCategoryConfig: () => {},
    categorizeApp: (name: string) => name,
  });

  // Goal handlers
  registerGoalHandlers({
    db: deps.db,
    mainWindow: deps.mainWindow,
    userPreferences: deps.userPreferences,
    getLocalDateStr: deps.getLocalDateStr,
    toInt: deps.toInt,
    buildChain: () => [],
    runWithFallback: async () => ({ result: { content: '[]' } }),
    GOAL_DUMP_SYSTEM: '',
    GOAL_FEEDBACK_SYSTEM: '',
  });

  // Finance handlers
  registerFinanceHandlers({
    db: deps.db,
    mainWindow: deps.mainWindow,
    userPreferences: deps.userPreferences,
    financePasswordHash: deps.financePasswordHash,
    getLocalDateStr: deps.getLocalDateStr,
    toInt: deps.toInt,
  });

}
