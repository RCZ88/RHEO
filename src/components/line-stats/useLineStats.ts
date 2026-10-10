/**
 * useLineStats — the single data pipeline for every Code Stats surface.
 *
 * Both `ProjectLineStats` and `workspace/CodeStatsTab` used to fetch, cache-read
 * and render on their own, which is how the same file ended up listed twice in
 * two places with two different totals. Everything now flows through here, and
 * everything is passed through `normaliseLineStats` exactly once.
 *
 * The RAW payload is kept in a ref so that changing the ignore list re-derives
 * the numbers immediately from the data already in memory — no rescan, no IPC.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LineStatsData } from '../../types/line-stats';
import {
  DEFAULT_FILTER_SETTINGS,
  loadFilterSettings,
  normaliseLineStats,
  saveFilterSettings,
  type ExclusionReport,
  type FilterSettings,
} from './lineStatsFilter';

interface RawPayload {
  files?: any[];
  summary?: unknown;
  scannedAt?: string;
  totalFiles?: number;
}

export interface UseLineStats {
  data: LineStatsData | null;
  report: ExclusionReport | null;
  isScanning: boolean;
  error: string | null;
  /** Scan + re-derive. `excludeExtensions` is passed straight to the main-process walker. */
  scan: (excludeExtensions: string[]) => Promise<void>;
  /** Discard cached rows and read from the DB again. */
  reload: () => Promise<void>;
  settings: FilterSettings;
  settingsReady: boolean;
  updateSettings: (patch: Partial<FilterSettings>) => void;
  /** Extra ignore dirs typed into the "add directory" field but not yet saved. */
  extraIgnoreDirs: string[];
  setExtraIgnoreDirs: (v: string[]) => void;
  resetSettings: () => void;
}

const clone = (s: FilterSettings): FilterSettings => ({ ...s, ignoreDirs: [...s.ignoreDirs] });

export function useLineStats(projectId?: string, projectPath?: string): UseLineStats {
  const [data, setData] = useState<LineStatsData | null>(null);
  const [report, setReport] = useState<ExclusionReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<FilterSettings>(() => clone(DEFAULT_FILTER_SETTINGS));
  const [settingsReady, setSettingsReady] = useState(false);
  const [extraIgnoreDirs, setExtraIgnoreDirs] = useState<string[]>([]);

  const rawRef = useRef<RawPayload | null>(null);
  const loadedFor = useRef<string | null>(null);

  // --- load the persisted setting once ------------------------------------
  useEffect(() => {
    let cancelled = false;
    loadFilterSettings().then(s => {
      if (cancelled) return;
      setSettings(clone(s));
      setSettingsReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // --- derive: every settings/projectPath change re-normalises in memory ---
  const derive = useCallback(() => {
    const raw = rawRef.current;
    if (!raw) return;
    const { data: d, report: r } = normaliseLineStats(raw, { projectPath, settings, extraIgnoreDirs });
    setData(d);
    setReport(r);
  }, [projectPath, settings, extraIgnoreDirs]);

  useEffect(() => { derive(); }, [derive]);

  const reload = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await (window as any).deskflowAPI?.getProjectLineStats?.(projectId);
      if (result?.success && result.data) {
        rawRef.current = result.data as RawPayload;
        derive();
      } else {
        rawRef.current = null;
        setData(null);
        setReport(null);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load cached stats');
    }
  }, [projectId, derive]);

  useEffect(() => {
    if (!projectId) return;
    if (loadedFor.current === projectId) return;
    loadedFor.current = projectId;
    reload();
  }, [projectId, reload]);

  const scan = useCallback(async (excludeExtensions: string[]) => {
    if (!projectPath || !projectId) return;
    setIsScanning(true);
    setError(null);
    try {
      // `ignoreDirs` is passed through for forward-compatibility, but the CURRENT
      // main-process walker (`count-project-lines`, src/main.ts:12427) reads only
      // `excludeExtensions` / `excludePatterns` / `maxFiles` and IGNORES it, so the
      // DB still stores the noise. That is fine on purpose: `normaliseLineStats` is
      // authoritative and runs on every read, so the ignore list takes effect
      // immediately without a rescan and without lying about what main does.
      // TODO(CZ/Architect, outside this slice): teach the walker to skip ignored
      // directories so `project_line_stats` stops storing them. Not required for
      // correctness — only for a smaller table.
      const result = await (window as any).deskflowAPI?.countProjectLines?.(
        projectPath, projectId,
        { excludeExtensions, excludePatterns: [], ignoreDirs: settings.ignoreDirs },
      );
      if (result?.success) {
        rawRef.current = { ...(result.data as RawPayload), scannedAt: result.data?.scannedAt || new Date().toISOString() };
        derive();
      } else {
        setError(result?.error || 'Scan failed');
      }
    } catch (e: any) {
      setError(e?.message || 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  }, [projectId, projectPath, settings.ignoreDirs, derive]);

  const updateSettings = useCallback((patch: Partial<FilterSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      if (patch.ignoreDirs) next.ignoreDirs = [...patch.ignoreDirs];
      void saveFilterSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const next = clone(DEFAULT_FILTER_SETTINGS);
    setSettings(next);
    void saveFilterSettings(next);
  }, []);

  return {
    data, report, isScanning, error, scan, reload,
    settings, settingsReady, updateSettings, extraIgnoreDirs, setExtraIgnoreDirs, resetSettings,
  };
}