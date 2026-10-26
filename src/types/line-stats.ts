export interface LineCountResult {
  filePath: string;
  fileType: string;
  totalLines: number;
  blankLines: number;
  commentLines: number;
  codeLines: number;
}

export interface FileTypeSummary {
  count: number;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
}

export interface LineStatsData {
  files: LineCountResult[];
  summary: Record<string, FileTypeSummary>;
  scannedAt: string;
  totalFiles: number;
}

export interface FileChangeResult {
  filePath: string;
  fileType: string;
  added: number;
  removed: number;
  totalLines: number;
  approx?: boolean;
}

export interface FileChangeSummary {
  filesChanged: number;
  added: number;
  removed: number;
}

export interface FileChangeHistoryRow {
  filePath: string;
  fileType: string;
  added: number;
  removed: number;
  totalLines: number;
  approx: boolean;
  source: 'scan' | 'editor';
  scannedAt: string;
}

export interface FileChangeData {
  files: FileChangeResult[];
  summary: FileChangeSummary;
  scannedAt: string | null;
  lastScanAt: string | null;
  lastEventAt: string | null;
  source: 'ledger';
  engine: 'diff' | 'approx';
  approxCount?: number;
  rebaselined?: number;
  baselineCommit: string | null;
  totalFiles: number;
  totalRows?: number;
  history?: FileChangeHistoryRow[];
}

export interface IngestStatus {
  ingestPath: string;
  fileExists: boolean;
  bytes: number;
  counters: {
    received: number;
    ingested: number;
    unchanged: number;
    droppedMalformed: number;
    droppedUnknownProject: number;
    droppedEscape: number;
    droppedVersion: number;
  };
  lastEventAt: string | null;
  sources: { source: string; lastSeenAt: string }[];
}

export interface ScanOptions {
  excludePatterns?: string[];
  excludeExtensions?: string[];
  includeExtensions?: string[];
  maxFiles?: number;
}
