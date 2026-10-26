/**
 * ingest — the JSONL spine for editor-reported change events (RESULT.md §5.5, §7).
 *
 * Editors (VS Code, IntelliJ, a Python watcher, …) never compute counts. They
 * append a one-line claim that a file changed to `changes.jsonl`; this service
 * tails that file, resolves the project, reads the file's CURRENT content from
 * disk, and runs it through the same `ledger.observe` engine the scan handler
 * uses. One diff engine, one observation memory ⇒ an editor event followed by a
 * scan records a delta exactly once.
 *
 * Transport is deliberately a flat append-only file: it preserves the
 * better-sqlite3 single-writer rule (only this Electron main process writes the
 * DB), is the offline queue by construction, needs no port or dependency, and
 * is the identical contract for every editor.
 */

import { observe, observeDeletion, persist, loadSnapshots, evictStaleContent, type Delta, type SnapshotRow } from './ledger';

const fs = require('fs');
const path = require('path');

const TAIL_MS = 2000; // poll every 2s
const MAX_STARTUP_BYTES = 5 * 1024 * 1024; // on boot, read at most the last 5MB
const MAX_LINE_BYTES = 1024 * 1024; // reject absurdly long lines

export interface IngestCounters {
  received: number;
  ingested: number;
  unchanged: number;
  droppedMalformed: number;
  droppedUnknownProject: number;
  droppedEscape: number;
  droppedVersion: number;
}

export interface IngestStatus {
  ingestPath: string;
  fileExists: boolean;
  bytes: number;
  counters: IngestCounters;
  lastEventAt: string | null;
  sources: { source: string; lastSeenAt: string }[];
}

interface Ctx {
  db: any;
  userDataPath: string;
  /** Resolve a normalized absolute projectPath → {id, path} for live projects. */
  resolveProject: (normalizedPath: string) => { id: string; path: string } | null;
}

function normalizePath(p: string, platform: string): string {
  let s = path.resolve(p || '');
  // strip trailing separators (but keep root "/")
  if (s.length > 1 && (s.endsWith(path.sep) || s.endsWith('/'))) s = s.slice(0, -1);
  if (platform === 'win32' || platform === 'darwin') s = s.toLowerCase();
  return s;
}

export function createIngestService(ctx: Ctx) {
  const platform = process.platform;
  const getUserDataPath = typeof ctx.getUserDataPath === 'function' ? ctx.getUserDataPath : () => ctx.userDataPath;
  const ingestPath =
    process.env.RHEO_INGEST_FILE || path.join(getUserDataPath(), 'changes.jsonl');

  let offset = 0;
  let timer: any = null;
  let started = false;
  const counters: IngestCounters = {
    received: 0,
    ingested: 0,
    unchanged: 0,
    droppedMalformed: 0,
    droppedUnknownProject: 0,
    droppedEscape: 0,
    droppedVersion: 0,
  };
  let lastEventAt: string | null = null;
  const sources = new Map<string, string>(); // source → lastSeenAt

  function ensureFile() {
    try {
      if (!fs.existsSync(ingestPath)) {
        fs.mkdirSync(path.dirname(ingestPath), { recursive: true });
        fs.writeFileSync(ingestPath, '', { mode: 0o600 });
      }
    } catch {
      /* best-effort */
    }
  }

  function rotateIfNeeded() {
    try {
      const st = fs.statSync(ingestPath);
      if (st.size > MAX_STARTUP_BYTES) {
        fs.renameSync(ingestPath, `${ingestPath}.1`);
        fs.writeFileSync(ingestPath, '', { mode: 0o600 });
      }
    } catch {
      /* best-effort */
    }
  }

  function resolveProject(p: string) {
    return ctx.resolveProject(normalizePath(p, platform));
  }

  function insideProject(projectRoot: string, filePath: string): boolean {
    const normRoot = normalizePath(projectRoot, platform);
    const normFile = normalizePath(filePath, platform);
    return normFile.startsWith(normRoot + path.sep) || normFile === normRoot;
  }

  /** Collapse a batch to the latest event per (projectPath, filePath). */
  function collapse(lines: string[]): any[] {
    const latest = new Map<string, any>();
    const order: string[] = [];
    for (const raw of lines) {
      if (!raw.trim()) continue;
      if (raw.length > MAX_LINE_BYTES) {
        counters.droppedMalformed++;
        continue;
      }
      let ev: any;
      try {
        ev = JSON.parse(raw);
      } catch {
        counters.droppedMalformed++;
        continue;
      }
      counters.received++;
      if (typeof ev.v !== 'number') {
        counters.droppedMalformed++;
        continue;
      }
      if (ev.v !== 1) {
        counters.droppedVersion++;
        continue;
      }
      if (ev.type === 'hello') {
        // hello is not collapsed; process immediately.
        if (ev.editor || ev.source) sources.set(String(ev.editor || ev.source), new Date().toISOString());
        continue;
      }
      const key = `${ev.projectPath}\u0000${ev.filePath}`;
      if (!latest.has(key)) order.push(key);
      latest.set(key, ev);
    }
    return order.map((k) => latest.get(k));
  }

  function processSave(ev: any) {
    const proj = resolveProject(ev.projectPath);
    if (!proj) {
      counters.droppedUnknownProject++;
      return;
    }
    if (!insideProject(proj.path, ev.filePath)) {
      counters.droppedEscape++;
      return;
    }
    const abs = path.resolve(ev.filePath);
    const rel = path.relative(path.resolve(proj.path), abs);
    const snapshots = loadSnapshots(ctx.db, proj.id);
    const prev = snapshots.get(rel);
    const obs = observe(rel, abs, prev);
    if (obs.skipUpsert) {
      counters.unchanged++;
      return;
    }
    const deltas: Delta[] = [];
    const upserts: SnapshotRow[] = [];
    const deletes: string[] = [];
    if (obs.delta) deltas.push(obs.delta);
    if (obs.snapshot) upserts.push(obs.snapshot);
    persist(ctx.db, proj.id, new Date().toISOString(), 'editor', null, null, deltas, upserts, deletes);
    if (obs.delta) counters.ingested++;
    else counters.unchanged++; // 0/0 advance
    if (ev.source) sources.set(String(ev.source), new Date().toISOString());
    lastEventAt = new Date().toISOString();
  }

  function processDelete(ev: any) {
    const proj = resolveProject(ev.projectPath);
    if (!proj) {
      counters.droppedUnknownProject++;
      return;
    }
    if (!insideProject(proj.path, ev.filePath)) {
      counters.droppedEscape++;
      return;
    }
    const rel = path.relative(path.resolve(proj.path), path.resolve(ev.filePath));
    const snapshots = loadSnapshots(ctx.db, proj.id);
    const prev = snapshots.get(rel);
    const delta = observeDeletion(rel, prev);
    const deltas: Delta[] = delta ? [delta] : [];
    persist(ctx.db, proj.id, new Date().toISOString(), 'editor', null, null, deltas, [], [rel]);
    if (delta) counters.ingested++;
    if (ev.source) sources.set(String(ev.source), new Date().toISOString());
    lastEventAt = new Date().toISOString();
  }

  function readNew() {
    ensureFile();
    let size = 0;
    try {
      size = fs.statSync(ingestPath).size;
    } catch {
      return;
    }
    if (size < offset) {
      offset = 0; // truncated / rotated
    }
    if (size === offset) return;
    let chunk: string;
    try {
      const fd = fs.openSync(ingestPath, 'r');
      const len = size - offset;
      const buf = Buffer.allocUnsafe(len);
      fs.readSync(fd, buf, 0, len, offset);
      fs.closeSync(fd);
      chunk = buf.toString('utf8');
    } catch {
      return;
    }
    offset = size;
    const lines = chunk.split('\n');
    // last element is the (possibly partial) tail after the final \n — but since
    // we only read whole bytes up to size and events end with \n, drop a trailing ''.
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    const events = collapse(lines);
    for (const ev of events) {
      try {
        if (ev.type === 'save') processSave(ev);
        else if (ev.type === 'delete') processDelete(ev);
      } catch {
        counters.droppedMalformed++;
      }
    }
  }

  function poll() {
    try {
      readNew();
    } catch {
      /* never let a poll crash the app */
    }
  }

  return {
    start() {
      if (started) return;
      started = true;
      ensureFile();
      rotateIfNeeded();
      // initial bounded read
      try {
        const st = fs.statSync(ingestPath);
        offset = st.size > MAX_STARTUP_BYTES ? st.size - MAX_STARTUP_BYTES : 0;
      } catch {
        offset = 0;
      }
      readNew();
      timer = setInterval(poll, TAIL_MS);
      if (timer.unref) timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      started = false;
    },
    /** Run one poll synchronously (used by probes / editor-changes:ingest). */
    poll,
    ingestOnce(lines: string[]): void {
      const events = collapse(lines);
      for (const ev of events) {
        try {
          if (ev.type === 'save') processSave(ev);
          else if (ev.type === 'delete') processDelete(ev);
        } catch {
          counters.droppedMalformed++;
        }
      }
    },
    status(): IngestStatus {
      let bytes = 0;
      let fileExists = false;
      try {
        const st = fs.statSync(ingestPath);
        bytes = st.size;
        fileExists = true;
      } catch {
        fileExists = false;
      }
      return {
        ingestPath,
        fileExists,
        bytes,
        counters: { ...counters },
        lastEventAt,
        sources: [...sources.entries()].map(([source, lastSeenAt]) => ({ source, lastSeenAt })),
      };
    },
  };
}
