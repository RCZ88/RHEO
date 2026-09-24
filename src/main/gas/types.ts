// GAS Integration — Shared Type Definitions
// Non-negotiable: Structured JSON only, never binaries, never raw episodes

export type Triple = {
  subject: string;
  predicate: string;
  object: string;
  confidence?: number;
  sourceEpisodeId?: string;
}

export type GasSyncPayload = {
  action: 'push-triples' | 'pull-triples' | 'status';
  triples: Triple[];
  since?: number;
  cursor?: string;
}

export type GasExportPayload = {
  target: 'docs' | 'sheets' | 'forms';
  content: unknown;
  meta: {
    source: string;
    timestamp: number;
  };
  cursor?: string;
}

export type GasResponse = {
  ok: boolean;
  data?: unknown;
  error?: string;
  syncPending?: boolean;
}

export interface PendingSyncEntry {
  id: string;
  payload: GasSyncPayload;
  timestamp: number;
  retries: number;
}

export interface SyncStatus {
  lastSync: number | null;
  pendingCount: number;
  lastError: string | null;
  isSyncing: boolean;
}
