/**
 * Session-related IPC handlers extracted from main.ts.
 * Registered via registerSessionHandlers(db, useJson).
 */

import { ipcMain } from 'electron';
import Database from 'better-sqlite3';

export interface SessionHandlerDeps {
  db: Database.Database;
  useJson: boolean;
}

export function registerSessionHandlers(deps: SessionHandlerDeps) {
  const { db, useJson } = deps;

  ipcMain.handle('get-browser-sessions', () => {
    if (useJson)
      return [];
    try {
      return db.prepare('SELECT * FROM browser_sessions ORDER BY date DESC, total_sec DESC').all();
    }
    catch (err) {
      console.error('[DeskFlow] get-browser-sessions error:', err);
      return [];
    }
  });

  ipcMain.handle('get-sessions', () => {
    if (useJson)
      return [];
    try {
      return db.prepare('SELECT * FROM sessions WHERE is_active = 1 ORDER BY start_time DESC').all();
    }
    catch (err) {
      console.error('[DeskFlow] get-sessions error:', err);
      return [];
    }
  });
}
