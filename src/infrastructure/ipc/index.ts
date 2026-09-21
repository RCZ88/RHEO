/**
 * IPC Handler Infrastructure
 * 
 * All IPC handlers are extracted from main.ts into category-specific modules.
 * This index registers all handlers with the main process.
 */

import Database from 'better-sqlite3';
import { BrowserWindow } from 'electron';
import { registerCategoryHandlers } from './category-handlers';

export interface IPCHandlerDeps {
  db: Database.Database;
  mainWindow: BrowserWindow | null;
  currentApp: string | null;
}

export function registerAllHandlers(deps: IPCHandlerDeps) {
  // Category handlers
  registerCategoryHandlers({
    db: deps.db,
    categoryConfig: {} as any, // Will be wired from main.ts
    mainWindow: deps.mainWindow,
    currentApp: deps.currentApp,
    saveCategoryConfig: () => {},
    categorizeApp: (name: string) => name,
  });

  // Additional handler modules will be registered here as they are extracted:
  // - session-handlers.ts
  // - tracking-handlers.ts
  // - goal-handlers.ts
  // - finance-handlers.ts
  // - system-handlers.ts
}
