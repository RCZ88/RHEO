/**
 * useFileChanges — per-file added/removed line deltas (the churn ledger).
 *
 * Single data pipeline for the Changes section: scan, reload (cumulative
 * history), and ingest-service status for the Live pill. Auto-scan on mount /
 * window focus when the last observation is older than 15 min (pref persisted
 * in localStorage['changes.autoScan'], default on). Auto-scans are silent
 * (no skeleton swap) to avoid layout jumps.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileChangeData, IngestStatus } from '../../types/line-stats';

const AUTO_PREF_KEY = 'changes.autoScan';
const STALE_MS = 15 * 60 * 1000;

export interface UseFileChanges {
  data: FileChangeData | null;
  isScanning: boolean;
  error: string | null;
  ingestStatus: IngestStatus | null;
  autoScan: boolean;
  setAutoScan: (v: boolean) => void;
  scan: (silent?: boolean) => Promise<void>;
  reload: () => Promise<void>;
  refreshIngest: () => Promise<void>;
}

export function useFileChanges(projectId?: string, projectPath?: string): UseFileChanges {
  const [data, setData] = useState<FileChangeData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingestStatus, setIngestStatus] = useState<IngestStatus | null>(null);
  const [autoScan, setAutoScanState] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(AUTO_PREF_KEY);
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  });
  const loadedFor = useRef<string | null>(null);
  const scanningRef = useRef(false);

  const setAutoScan = useCallback((v: boolean) => {
    setAutoScanState(v);
    try {
      localStorage.setItem(AUTO_PREF_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const reload = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await (window as any).deskflowAPI?.getProjectChanges?.(projectId);
      if (result?.success && result.data) {
        setData(result.data as FileChangeData);
        setError(null);
      } else if (result) {
        setError(result.error || 'Failed to load change history');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load change history');
    }
  }, [projectId]);

  const refreshIngest = useCallback(async () => {
    try {
      const r = await (window as any).deskflowAPI?.getChangesIngestStatus?.();
      if (r?.success && r.data) setIngestStatus(r.data as IngestStatus);
    } catch {
      /* ignore */
    }
  }, []);

  const scan = useCallback(
    async (silent?: boolean) => {
      if (!projectPath || !projectId || scanningRef.current) return;
      scanningRef.current = true;
      if (!silent) setIsScanning(true);
      setError(null);
      try {
        const result = await (window as any).deskflowAPI?.scanProjectChanges?.(projectPath, projectId);
        if (result?.success) {
          await reload();
        } else {
          setError(result?.error || 'Change scan failed');
        }
      } catch (e: any) {
        setError(e?.message || 'Change scan failed');
      } finally {
        scanningRef.current = false;
        if (!silent) setIsScanning(false);
      }
    },
    [projectId, projectPath, reload]
  );

  useEffect(() => {
    if (!projectId) return;
    if (loadedFor.current === projectId) return;
    loadedFor.current = projectId;
    void reload();
    void refreshIngest();
  }, [projectId, reload, refreshIngest]);

  // Auto-scan on mount / focus when stale.
  useEffect(() => {
    if (!projectId || !projectPath || !autoScan) return;
    const maybeScan = () => {
      const last = data?.lastScanAt || data?.scannedAt;
      const stale = !last || Date.now() - new Date(last).getTime() > STALE_MS;
      if (stale) void scan(true);
    };
    // Defer to next tick so initial data load has settled.
    const t = setTimeout(maybeScan, 300);
    const onFocus = () => maybeScan();
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [projectId, projectPath, autoScan, data, scan]);

  // Poll ingest status for the Live pill.
  useEffect(() => {
    const id = setInterval(() => void refreshIngest(), 3000);
    return () => clearInterval(id);
  }, [refreshIngest]);

  return { data, isScanning, error, ingestStatus, autoScan, setAutoScan, scan, reload, refreshIngest };
}
