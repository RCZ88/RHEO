/**
 * Tracking-related IPC handlers extracted from main.ts.
 * Registered via registerTrackingHandlers(deps).
 */

import { ipcMain } from 'electron';
import Database from 'better-sqlite3';

export interface TrackingHandlerDeps {
  db: Database.Database;
  getIsTracking: () => boolean;
  setIsTracking: (v: boolean) => void;
  getTrackingInterval: () => ReturnType<typeof setTimeout> | null;
  setTrackingInterval: (v: ReturnType<typeof setTimeout> | null) => void;
  getLastPollTime: () => number;
  setLastPollTime: (v: number) => void;
  pollForeground: () => void;
  userPreferences: Record<string, any>;
}

export function registerTrackingHandlers(deps: TrackingHandlerDeps) {
  const {
    db,
    getIsTracking,
    setIsTracking,
    getTrackingInterval,
    setTrackingInterval,
    getLastPollTime,
    setLastPollTime,
    pollForeground,
    userPreferences,
  } = deps;

  ipcMain.handle('toggle-tracking', () => {
    const newVal = !getIsTracking();
    setIsTracking(newVal);
    console.log('[DeskFlow] Tracking:', newVal ? 'ON' : 'OFF');
    return newVal;
  });

  ipcMain.handle('set-tracking', (_event, enabled) => {
    setIsTracking(!!enabled);
    console.log('[DeskFlow] Tracking set:', enabled ? 'ON' : 'OFF');
    return enabled;
  });

  ipcMain.handle('restart-tracking', () => {
    const pollInterval = userPreferences.trackingPollInterval || 1000;
    if (getTrackingInterval()) clearInterval(getTrackingInterval());
    setTrackingInterval(setInterval(pollForeground, pollInterval));
    setLastPollTime(Date.now());
    setIsTracking(true);
    console.log('[DeskFlow] 🔄 Tracking restarted via IPC');
    return true;
  });

  ipcMain.handle('tracking:read-afk-events', async () => {
    const { app } = require('electron');
    const fs = require('fs');
    const path = require('path');
    const userData = app.getPath('userData');
    const queuePath = path.join(userData, 'tracker-afk-events.jsonl');
    
    if (!fs.existsSync(queuePath)) {
      return { events: [] };
    }
    
    try {
      const content = fs.readFileSync(queuePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const events = lines.map((line: string) => JSON.parse(line));
      return { events };
    } catch (err) {
      console.error('[DeskFlow] Failed to read AFK event queue:', err);
      return { events: [], error: (err as Error).message };
    }
  });

  ipcMain.handle('tracking:clear-afk-events', async () => {
    const { app } = require('electron');
    const fs = require('fs');
    const path = require('path');
    const userData = app.getPath('userData');
    const queuePath = path.join(userData, 'tracker-afk-events.jsonl');
    
    try {
      if (fs.existsSync(queuePath)) {
        fs.unlinkSync(queuePath);
      }
      return { ok: true };
    } catch (err) {
      console.error('[DeskFlow] Failed to clear AFK event queue:', err);
      return { ok: false, error: (err as Error).message };
    }
  });
}
