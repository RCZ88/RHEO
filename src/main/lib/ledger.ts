/**
 * ledger — the single observation engine behind `scan-project-changes` and the
 * editor-event ingest service (RESULT.md §1, §5).
 *
 * The Ledger Principle: a delta is always (content now) − (content at last
 * observation), and `project_file_snapshots` is the observation memory. Snapshots
 * advance exactly when a delta is recorded. This module is that memory plus the
 * one diff path both triggers share, so no ordering of button presses, editor
 * saves, or git commits can double-count a line.
 *
 * Everything here is a pure function over a `db` handle (better-sqlite3) and
 * Node built-ins — no Electron, no app state — so the scan handler and the
 * ingest service are both thin callers of the same engine.
 */

import { lineDiff, countLines, normalizeEol } from './lineDiff';
import { SKIP_DIRS, BACKUP_RE, DIGITCOPY_RE, BINARY_EXTS, MINIFIED_RE, TRACKED_EXTS, EXT_LANG, walkProject } from './scanShared';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

export { walkProject, countLines, SKIP_DIRS, TRACKED_EXTS, EXT_LANG };

/** Storage caps (RESULT.md §2 Q5, §3). */
export const MAX_CONTENT_BYTES = 512 * 1024; // ≤ this: store deflated content for real diffs
export const SNIFF_BYTES = 8 * 1024; // binary sniff window
export const STREAM_CHUNK = 64 * 1024; // >512KB files stream in these chunks
export const BULK_REBASELINE = 2000; // changed+new set above this ⇒ re-baseline, record nothing
export const EVICT_DAYS = 90; // untouched content evicted after this (hash kept)

export interface SnapshotRow {
  file_path: string;
  content_hash: string | null;
  content: string | null; // legacy TEXT
  content_gz: Buffer | null; // zlib-deflated
  total_lines: number;
  bytes: number;
  binary: number;
}

export interface Delta {
  filePath: string;
  fileType: string;
  added: number;
  removed: number;
  total: number;
  approx: boolean;
}

/** Sniff first 8KB for a NUL byte ⇒ binary. */
function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, SNIFF_BYTES);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** sha1 over the raw bytes; for big files this is the full-stream hash. */
function sha1(buf: Buffer): string {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

/** Decompress a snapshot's stored content (gz first, then legacy TEXT). */
function snapshotText(row: SnapshotRow): string {
  if (row.content_gz && row.content_gz.length) {
    try {
      return zlib.gunzipSync(row.content_gz).toString('utf8');
    } catch {
      /* fall through */
    }
  }
  return row.content ?? '';
}

/**
 * Read a file once, producing everything the ledger needs to observe it:
 * hash, total lines, bytes, binary flag, and (for ≤512KB text) the content.
 * Large files stream — never buffer the whole body.
 */
function observeFile(abs: string): {
  hash: string;
  total: number;
  bytes: number;
  binary: boolean;
  content: string | null; // null when oversized or binary
} | null {
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    return null;
  }
  if (!st.isFile()) return null;
  const bytes = st.size;

  if (bytes > MAX_CONTENT_BYTES) {
    // Stream: incremental sha1 + newline count, never buffer the body.
    let hash: string;
    let newlines = 0;
    let firstChunk: Buffer | null = null;
    let lastByte = 0;
    try {
      const fd = fs.openSync(abs, 'r');
      const buf = Buffer.allocUnsafe(STREAM_CHUNK);
      const h = crypto.createHash('sha1');
      let read: number;
      let offset = 0;
      while ((read = fs.readSync(fd, buf, 0, STREAM_CHUNK, offset)) > 0) {
        const chunk = read === STREAM_CHUNK ? buf : buf.subarray(0, read);
        if (firstChunk === null) firstChunk = Buffer.from(chunk);
        h.update(chunk);
        for (let i = 0; i < read; i++) if (chunk[i] === 10) newlines++;
        lastByte = chunk[read - 1];
        offset += read;
      }
      fs.closeSync(fd);
      hash = h.digest('hex');
    } catch {
      return null;
    }
    const binary = looksBinary(firstChunk ?? Buffer.alloc(0));
    // git-style count: trailing newline does not create a phantom line.
    const total = bytes === 0 ? 0 : newlines + (lastByte === 10 ? 0 : 1);
    return { hash, total, bytes, binary, content: null };
  }

  let raw: Buffer;
  try {
    raw = fs.readFileSync(abs);
  } catch {
    return null;
  }
  const binary = looksBinary(raw);
  const hash = sha1(raw);
  if (binary) return { hash, total: 0, bytes, binary: true, content: null };
  const content = raw.toString('utf8');
  return { hash, total: countLines(content), bytes, binary: false, content };
}

/** Language label for a path, via the shared ext map. */
function langOf(relPath: string): string {
  return EXT_LANG[path.extname(relPath).toLowerCase()] || 'other';
}

/** Load every snapshot row for a project into a Map keyed by file_path. */
export function loadSnapshots(db: any, projectId: string): Map<string, SnapshotRow> {
  const map = new Map<string, SnapshotRow>();
  try {
    const rows = db
      .prepare(
        'SELECT file_path, content_hash, content, content_gz, total_lines, bytes, binary FROM project_file_snapshots WHERE project_id = ?'
      )
      .all(projectId) as SnapshotRow[];
    for (const r of rows) map.set(r.file_path, r);
  } catch {
    /* first run / missing table */
  }
  return map;
}

export interface Observation {
  delta: Delta | null; // null = no change (hash-equal / binary / 0/0)
  snapshot: SnapshotRow | null; // updated snapshot to persist (null = leave / delete)
  skipUpsert: boolean; // true = no snapshot write needed (hash-equal no-op)
}

/**
 * Observe one file against its stored snapshot. Returns the delta to record (or
 * null) plus the snapshot to persist. This is the ONE path — scan and ingest
 * both call it, which is why an editor event followed by a scan records a
 * delta exactly once (the snapshot advances on the first observation).
 */
export function observe(
  relPath: string,
  abs: string,
  prev: SnapshotRow | undefined
): Observation {
  const obs = observeFile(abs);
  if (!obs) {
    // File vanished between walk and read — treat as deletion.
    if (prev && !prev.binary) {
      return {
        delta: { filePath: relPath, fileType: langOf(relPath), added: 0, removed: prev.total_lines, total: 0, approx: false },
        snapshot: null,
        skipUpsert: false,
      };
    }
    return { delta: null, snapshot: null, skipUpsert: true };
  }

  // Binary now.
  if (obs.binary) {
    if (prev && !prev.binary) {
      // text → binary: the text is gone ⇒ all old lines removed.
      return {
        delta: { filePath: relPath, fileType: langOf(relPath), added: 0, removed: prev.total_lines, total: 0, approx: false },
        snapshot: { file_path: relPath, content_hash: obs.hash, content: null, content_gz: null, total_lines: 0, bytes: obs.bytes, binary: 1 },
        skipUpsert: false,
      };
    }
    // already binary (or new binary) → marker only, no delta.
    return {
      delta: null,
      snapshot: { file_path: relPath, content_hash: obs.hash, content: null, content_gz: null, total_lines: 0, bytes: obs.bytes, binary: 1 },
      skipUpsert: false,
    };
  }

  // Text file.
  if (prev && prev.content_hash === obs.hash) {
    // Dedupe: hash-equal ⇒ no-op. Absorbs EOL flips (0/0 after normalize).
    return { delta: null, snapshot: null, skipUpsert: true };
  }

  const fileType = langOf(relPath);
  let added = 0;
  let removed = 0;
  let approx = false;

  if (!prev) {
    // New file: every line added.
    added = obs.total;
  } else if (prev.binary === 1) {
    // binary → text: all current lines are new content.
    added = obs.total;
  } else if (obs.content === null || prev.content_gz === null && prev.content === null || prev.bytes > MAX_CONTENT_BYTES) {
    // Either side oversized (or old content evicted): count-approx delta.
    const oldTotal = prev.total_lines;
    added = Math.max(0, obs.total - oldTotal);
    removed = Math.max(0, oldTotal - obs.total);
    approx = true;
  } else {
    const oldText = snapshotText(prev);
    const d = lineDiff(oldText, obs.content);
    added = d.added;
    removed = d.removed;
  }

  if (added === 0 && removed === 0) {
    // Real content change that diffs to 0/0 (whitespace/EOL) — advance the
    // snapshot silently, record nothing.
    return { delta: null, snapshot: makeTextSnapshot(relPath, obs), skipUpsert: false };
  }

  return {
    delta: { filePath: relPath, fileType, added, removed, total: obs.total, approx },
    snapshot: makeTextSnapshot(relPath, obs),
    skipUpsert: false,
  };
}

function makeTextSnapshot(relPath: string, obs: { hash: string; total: number; bytes: number; content: string | null }): SnapshotRow {
  let content_gz: Buffer | null = null;
  if (obs.content !== null && obs.bytes <= MAX_CONTENT_BYTES) {
    try {
      content_gz = zlib.gzipSync(Buffer.from(obs.content, 'utf8'));
    } catch {
      content_gz = null;
    }
  }
  return {
    file_path: relPath,
    content_hash: obs.hash,
    content: null, // all NEW writes go to content_gz; legacy TEXT left null
    content_gz,
    total_lines: obs.total,
    bytes: obs.bytes,
    binary: 0,
  };
}

/** Observe a deletion: snapshot present (text) ⇒ all lines removed. */
export function observeDeletion(relPath: string, prev: SnapshotRow | undefined): Delta | null {
  if (!prev || prev.binary === 1) return null;
  if (prev.total_lines <= 0) return null;
  return { filePath: relPath, fileType: langOf(relPath), added: 0, removed: prev.total_lines, total: 0, approx: false };
}

/** Persist a batch: insert deltas + upsert/delete snapshots in ONE transaction. */
export function persist(
  db: any,
  projectId: string,
  scannedAt: string,
  source: 'scan' | 'editor',
  baselineCommit: string | null,
  sessionId: string | null,
  deltas: Delta[],
  snapshotUpserts: SnapshotRow[],
  snapshotDeletes: string[]
): void {
  const insertDelta = db.prepare(
    'INSERT INTO project_file_changes (project_id, file_path, file_type, added, removed, total_lines, baseline_commit, scanned_at, source, approx, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const upsertSnap = db.prepare(
    `INSERT INTO project_file_snapshots (project_id, file_path, content_hash, content, content_gz, total_lines, bytes, binary, scanned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(project_id, file_path) DO UPDATE SET content_hash=excluded.content_hash, content=excluded.content, content_gz=excluded.content_gz, total_lines=excluded.total_lines, bytes=excluded.bytes, binary=excluded.binary, scanned_at=excluded.scanned_at`
  );
  const delSnap = db.prepare('DELETE FROM project_file_snapshots WHERE project_id = ? AND file_path = ?');

  const tx = db.transaction(() => {
    for (const d of deltas) {
      if (d.added === 0 && d.removed === 0) continue; // 0/0 never stored
      insertDelta.run(projectId, d.filePath, d.fileType, d.added, d.removed, d.total, baselineCommit, scannedAt, source, d.approx ? 1 : 0, sessionId);
    }
    for (const s of snapshotUpserts) {
      upsertSnap.run(projectId, s.file_path, s.content_hash, s.content, s.content_gz, s.total_lines, s.bytes, s.binary);
    }
    for (const rel of snapshotDeletes) {
      delSnap.run(projectId, rel);
    }
  });
  tx();
}

/** Evict content from snapshots untouched ≥ EVICT_DAYS (hash + totals kept). */
export function evictStaleContent(db: any, projectId: string): number {
  try {
    const info = db
      .prepare(
        `UPDATE project_file_snapshots SET content = NULL, content_gz = NULL
         WHERE project_id = ? AND binary = 0 AND content_gz IS NOT NULL
           AND scanned_at < datetime('now', '-${EVICT_DAYS} days')`
      )
      .run(projectId);
    return info.changes || 0;
  } catch {
    return 0;
  }
}
