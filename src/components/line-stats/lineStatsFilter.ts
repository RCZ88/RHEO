/**
 * lineStatsFilter — the ONE normalisation layer for Code Stats.
 *
 * WHY THIS FILE EXISTS
 * The file list is produced by the main-process walker (`count-project-lines`,
 * src/main.ts ~12427) and persisted to `project_line_stats`. Two defects live in
 * that data, and both are invisible at the render layer:
 *
 *   1. The same logical file can appear more than once (two spellings of the same
 *      resolved absolute path — `src/a.ts` vs `src/./a.ts` vs `src/x/../a.ts`).
 *      It shows up repeatedly in the table and is counted repeatedly in the cards.
 *      FIX: dedupe on the RESOLVED ABSOLUTE PATH. Never on basename — two different
 *      `index.ts` files in different folders are genuinely different files.
 *
 *   2. Backup copies (`*.bak`, `*.bak-<stamp>`, `*.backup*`, `<name>2.ts`, and the
 *      whole `agent/backups/` + `.opencode-backups/` trees) are counted as real code.
 *      This repo alone has ~979 `*.bak*` files.
 *      FIX: exclude by pattern, and by a directory ignore-list the user controls.
 *
 * Everything is a pure function over plain data so it can be unit-probed with plain
 * node (no React, no node builtins — the renderer has no `path` module).
 *
 * NOTHING IS DROPPED SILENTLY: every exclusion is counted by reason and the report
 * is rendered by `IgnoreNotice`, so the numbers are explainable rather than
 * mysteriously smaller.
 */

import type { LineCountResult, LineStatsData, FileTypeSummary } from '../../types/line-stats';

// ---------------------------------------------------------------------------
// 1. Path resolution (pure, no node `path`)
// ---------------------------------------------------------------------------

/** `\` -> `/`. Windows and POSIX spellings of the same file must compare equal. */
export function toSlash(p: string): string {
  return p.replace(/\\/g, '/');
}

function isAbsoluteLike(p: string): boolean {
  return p.startsWith('/') || /^[A-Za-z]:\//.test(p);
}

/**
 * Resolve `p` against `base` and collapse `.` / `..` / duplicate separators.
 * Handles POSIX (`/a/b`), Windows drive (`C:/a/b`) and UNC (`//host/share`).
 * This is the dedupe key: two rows whose resolved form is equal are the SAME file.
 */
export function resolvePathFrom(base: string | undefined, p: string): string {
  let full = toSlash(String(p ?? ''));
  if (!isAbsoluteLike(full)) {
    const b = toSlash(String(base ?? '')).replace(/\/+$/, '');
    full = b ? `${b}/${full}` : full;
  }
  const drive = /^[A-Za-z]:\//.exec(full);
  const rooted = full.startsWith('/') || !!drive;
  // With a drive letter the `C:` token must be a PREFIX, not a path segment —
  // otherwise `C:/a/b/../c` keeps a stray `C:` segment and the key is wrong.
  const body = drive ? full.slice(3) : full;
  const out: string[] = [];
  for (const seg of body.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else if (!rooted) out.push('..');
      continue;
    }
    out.push(seg);
  }
  const prefix = drive ? drive[0] : (full.startsWith('/') ? '/' : '');
  return prefix + out.join('/');
}

function dirOf(rel: string): string {
  const i = rel.lastIndexOf('/');
  return i < 0 ? '' : rel.slice(0, i);
}

function baseOf(rel: string): string {
  const i = rel.lastIndexOf('/');
  return i < 0 ? rel : rel.slice(i + 1);
}

// ---------------------------------------------------------------------------
// 2. Ignore-list (bug 3: the user-facing setting)
// ---------------------------------------------------------------------------

/**
 * DEFAULT IGNORE LIST — directory names (or multi-segment paths like
 * `agent/backups`) excluded from every count and chart. Ordered by how much
 * noise each one removes.
 */
export const DEFAULT_IGNORE_DIRS: string[] = [
  'node_modules',
  'dist',
  'dist-electron',
  'dist-tmp',
  'build',
  '.git',
  'coverage',
  'agent/backups',
  '.opencode-backups',
  'backups',
  '.next',
  'out',
  'vendor',
  '.nuxt',
  '.svelte-kit',
  '.astro',
  '.docusaurus',
  '.angular',
  '.turbo',
  '.parcel-cache',
  '.cache',
  '.yarn',
  '.pnpm-store',
  'target',
  'obj',
  'bin',
  '.venv',
  'venv',
  '__pycache__',
  '.tox',
  '.mypy_cache',
  '.pytest_cache',
  '.nyc_output',
  '.idea',
  '.vscode',
  '.gradle',
  'tmp',
  'temp',
  'logs',
  'Pods',
  'bower_components',
  'jspm_packages',
  'flow-typed',
];

/** Normalise one ignore entry: slash form, no leading/trailing slash, lowercased. */
export function normaliseIgnoreEntry(entry: string): string {
  return toSlash(String(entry ?? '').trim())
    .replace(/^\.\//, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
    .toLowerCase();
}

/**
 * Does any PATH SEGMENT (or multi-segment run) of `rel` match the ignore list?
 * Matching is case-insensitive because the walker may report either spelling.
 */
export function matchIgnoreDir(rel: string, ignoreDirs: string[]): string | null {
  const segs = toSlash(rel).split('/').filter(Boolean).map(s => s.toLowerCase());
  for (const raw of ignoreDirs) {
    const entry = normaliseIgnoreEntry(raw);
    if (!entry) continue;
    if (!entry.includes('/')) {
      if (segs.includes(entry)) return entry;
      continue;
    }
    const parts = entry.split('/');
    for (let i = 0; i + parts.length <= segs.length; i++) {
      let ok = true;
      for (let j = 0; j < parts.length; j++) {
        if (segs[i + j] !== parts[j]) { ok = false; break; }
      }
      if (ok) return entry;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 3. Backup-file patterns (bug 2)
// ---------------------------------------------------------------------------

/**
 * BACKUP FILE PATTERNS — matched against the FILE NAME ONLY, never the path, so
 * a legitimate `dist-tools.ts` is not caught by the `.dist` style rules and a
 * legitimate folder called `out` is not needed for these to work.
 *
 * Verbatim list (also shown verbatim in the Ignore panel so nothing is hidden):
 *   *.bak          *.bak-*  *.bak.*   *.bak<digits>   *.bak2
 *   *.backup       *.backup.*  *.backup-<stamp>      *.backup-pre-<stamp>
 *   *.orig         *.rej     *.old     *.save
 *   *.swo/*.swp    *~         #*#  (emacs autosave)   .#*  (emacs lock)
 *   *.tmp          *.temp    *.copy    *.copy-<n>     *.disabled
 *   *.ts.orig.txt (double-suffix backup, e.g. `X.ts.bak.1`, `X.ts.orig.txt`)
 */
export const BACKUP_FILE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: '*.bak', re: /\.bak$/i },
  { label: '*.bak-* / *.bak.* / *.bak<digits>', re: /\.bak(?:[-._]|\d)/i },
  { label: '*.backup', re: /\.backup$/i },
  { label: '*.backup.* / *.backup-<stamp>', re: /\.backup[-._]/i },
  { label: '*.orig', re: /\.orig$/i },
  { label: '*.rej', re: /\.rej$/i },
  { label: '*.old', re: /\.old$/i },
  { label: '*.save', re: /\.save$/i },
  { label: '*.swp / *.swo', re: /\.sw[po]$/i },
  { label: '*~', re: /~$/ },
  { label: '#*# (emacs autosave)', re: /^#.*#$/ },
  { label: '.#* (emacs lock)', re: /^\.#/ },
  { label: '*.tmp / *.temp', re: /\.(?:tmp|temp)$/i },
  { label: '*.copy / *.copy-<n>', re: /\.copy(?:-\d+)?$/i },
  { label: '*.disabled', re: /\.disabled$/i },
  // Double-suffix: the marker is followed by MORE dots, e.g. `a.ts.bak.1`,
  // `a.ts.orig.txt`, `a.ts.backup.2`. This must be a bare `[-._]|$` boundary —
  // the previous `\.\w+$` tail made `a.ts.orig.txt` survive, because after
  // `.orig` the only remaining text (`.txt`) was consumed as the separator run
  // and then nothing was left for the mandatory trailing extension.
  { label: 'double-suffix (*.bak.1, *.orig.txt)', re: /\.(?:bak|orig|backup|old|save|rej|copy)(?:[-._]|$)/i },
];

/** First matching backup pattern for a file name, or null. */
export function matchBackupPattern(fileName: string): string | null {
  for (const p of BACKUP_FILE_PATTERNS) {
    if (p.re.test(fileName)) return p.label;
  }
  return null;
}

/**
 * `<name><digits>.<ext>` — the `flushTranscriptToDb2.ts` / `preload2.ts` shape.
 *
 * IMPORTANT: this rule is EVIDENCE-BASED, not a blind regex. `foo2.ts` is only
 * treated as a copy when `foo.ts` also exists in the SAME directory of the scan.
 * A blind `[A-Za-z]\d+\.ts` rule would delete `utf8.ts`, `base64.ts`, `sha256.ts`
 * and every Vite asset hash — which is exactly the "silently dropped data" the
 * spec forbids. When the original is absent the file is KEPT and reported.
 */
const DIGIT_SUFFIX = /^(.+?)([0-9]{1,3})$/;

/**
 * Orphan REPORTING threshold. The DROP rule above is evidence-based (it only
 * drops when the un-digitised original is actually present in the scan), so it
 * can afford to be trigger-happy. The REPORT cannot: `utf8.ts`, `sha256.ts`,
 * `base64.ts` are not copies of `utf.ts`/`sha.ts`/`base.ts`, and listing them
 * as "possible copies" is exactly the noise that makes an explainability report
 * get ignored. So a candidate is only surfaced when its stem is at least this
 * long — long enough that `<name><digits>` reads as a numbered copy rather than
 * as an encoding or algorithm name.
 */
const ORPHAN_MIN_STEM = 5;

export function digitCopyCandidate(rel: string): { original: string; digits: string; stem: string } | null {
  const dir = dirOf(rel);
  const base = baseOf(rel);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;                 // no extension, or dotfile
  const stem = base.slice(0, dot);
  const ext = base.slice(dot);              // includes the dot
  const m = DIGIT_SUFFIX.exec(stem);
  if (!m) return null;
  const head = m[1];
  // Reject `2.ts` (no real stem) and require the digit run to follow a name char.
  if (!head || !/[A-Za-z0-9_)\]]$/.test(head)) return null;
  const original = (dir ? `${dir}/` : '') + head + ext;
  return { original, digits: m[2], stem: head };
}

// ---------------------------------------------------------------------------
// 4. Settings (persisted via the existing get-preference / set-preference pair)
// ---------------------------------------------------------------------------

export interface FilterSettings {
  /** Directory names / relative paths excluded from the scan. */
  ignoreDirs: string[];
  /** Drop `*.bak`, `*.backup*`, `*~`, ... (bug 2). */
  excludeBackups: boolean;
  /** Drop `<name><digits>.<ext>` when the un-digitised original exists. */
  excludeDigitCopies: boolean;
  /** Deduplicate rows that resolve to the same absolute path (bug 1). */
  dedupe: boolean;
}

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  ignoreDirs: DEFAULT_IGNORE_DIRS,
  excludeBackups: true,
  excludeDigitCopies: true,
  dedupe: true,
};

export const FILTER_PREFERENCE_KEY = 'lineStatsFilterSettings';

function strArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = v
    .filter(x => typeof x === 'string')
    .map(x => normaliseIgnoreEntry(x))
    .filter(Boolean);
  return out.length ? out : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Coerce ANYTHING (possibly a stale/foreign preference value) into valid settings. */
export function sanitiseFilterSettings(raw: unknown): FilterSettings {
  const o = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  return {
    ignoreDirs: strArray(o.ignoreDirs, DEFAULT_IGNORE_DIRS),
    excludeBackups: bool(o.excludeBackups, DEFAULT_FILTER_SETTINGS.excludeBackups),
    excludeDigitCopies: bool(o.excludeDigitCopies, DEFAULT_FILTER_SETTINGS.excludeDigitCopies),
    dedupe: bool(o.dedupe, DEFAULT_FILTER_SETTINGS.dedupe),
  };
}

export async function loadFilterSettings(): Promise<FilterSettings> {
  const api = (globalThis as any)?.deskflowAPI;
  if (typeof api?.getPreference === 'function') {
    try {
      const res = await api.getPreference(FILTER_PREFERENCE_KEY);
      const value = res && typeof res === 'object' && 'value' in res ? res.value : res;
      if (value != null) return sanitiseFilterSettings(value);
    } catch { /* fall through to localStorage */ }
  }
  try {
    const raw = globalThis.localStorage?.getItem(FILTER_PREFERENCE_KEY);
    if (raw) return sanitiseFilterSettings(JSON.parse(raw));
  } catch { /* ignore */ }
  return { ...DEFAULT_FILTER_SETTINGS, ignoreDirs: [...DEFAULT_IGNORE_DIRS] };
}

export async function saveFilterSettings(settings: FilterSettings): Promise<void> {
  const clean = sanitiseFilterSettings(settings);
  try { globalThis.localStorage?.setItem(FILTER_PREFERENCE_KEY, JSON.stringify(clean)); } catch { /* ignore */ }
  const api = (globalThis as any)?.deskflowAPI;
  if (typeof api?.setPreference === 'function') {
    try { await api.setPreference(FILTER_PREFERENCE_KEY, clean); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// 5. The normaliser
// ---------------------------------------------------------------------------

export type ExclusionKind = 'ignoreDir' | 'backup' | 'digitCopy' | 'orphanDigit' | 'duplicate';

export interface ExcludedSample { path: string; reason: string }

export interface ExclusionReport {
  inputFiles: number;
  keptFiles: number;
  ignoredDirs: number;
  backups: number;
  digitCopies: number;
  /** `<name>2.ts` with no `<name>.ts` alongside — kept, but surfaced. */
  orphanDigits: number;
  duplicates: number;
  byRule: Record<string, number>;
  samples: Record<ExclusionKind, ExcludedSample[]>;
}

const MAX_SAMPLES = 25;

/**
 * `ExclusionKind` -> the plural counter field on the report. These MUST NOT be
 * derived from the kind name: `drop()` increments `COUNTER_FIELD[kind]`, and when
 * the two disagree (as `'duplicate'` vs `duplicates` did) the counter reads 0
 * while the file is genuinely dropped — the number and the list stop agreeing,
 * which is the one thing this report exists to prevent.
 */
const COUNTER_FIELD: Record<ExclusionKind, keyof ExclusionReport> = {
  ignoreDir: 'ignoredDirs',
  backup: 'backups',
  digitCopy: 'digitCopies',
  orphanDigit: 'orphanDigits',
  duplicate: 'duplicates',
};

function emptyReport(inputFiles: number): ExclusionReport {
  return {
    inputFiles, keptFiles: 0, ignoredDirs: 0, backups: 0, digitCopies: 0,
    orphanDigits: 0, duplicates: 0, byRule: {},
    samples: { ignoreDir: [], backup: [], digitCopy: [], orphanDigit: [], duplicate: [] },
  };
}

function drop(report: ExclusionReport, kind: ExclusionKind, path: string, reason: string) {
  const field = COUNTER_FIELD[kind];
  (report[field] as number) = ((report[field] as number) || 0) + 1;
  report.byRule[reason] = (report.byRule[reason] || 0) + 1;
  const bucket = report.samples[kind];
  if (bucket.length < MAX_SAMPLES) bucket.push({ path, reason });
}

export interface NormaliseOptions {
  /** Absolute project root; row paths from main are RELATIVE to it. */
  projectPath?: string;
  settings?: Partial<FilterSettings>;
  /** Extra ignore dirs merged on top (the in-progress text field). */
  extraIgnoreDirs?: string[];
}

export interface NormaliseResult {
  data: LineStatsData | null;
  report: ExclusionReport;
}

/**
 * THE normaliser. Every Code Stats surface (ProjectLineStats, CodeStatsTab,
 * FileDetailTable, FileTypeChart, LineStatsCards) renders whatever this returns —
 * there is deliberately no per-component filtering, because six components
 * filtering six different ways is how the same file ends up listed twice.
 *
 * `summary` is RECOMPUTED from the kept rows rather than trusted from the caller,
 * because the incoming summary already contains the excluded files' lines.
 */
export function normaliseLineStats(
  input: { files?: LineCountResult[]; summary?: unknown; scannedAt?: string; totalFiles?: number } | null | undefined,
  options: NormaliseOptions = {},
): NormaliseResult {
  const settings = sanitiseFilterSettings({ ...DEFAULT_FILTER_SETTINGS, ...(options.settings || {}) });
  const files = Array.isArray(input?.files) ? input!.files! : [];
  const report = emptyReport(files.length);

  const ignoreDirs = [...settings.ignoreDirs, ...(options.extraIgnoreDirs || []).map(normaliseIgnoreEntry)]
    .filter(Boolean);
  const ignoreSet = new Set(ignoreDirs.map(normaliseIgnoreEntry));

  // Pass 1 — resolve every row to an absolute path, and index which
  // `<stem>.<ext>` names exist so the digit-copy rule has evidence to work from.
  const resolved = files.map(f => {
    const rel = toSlash(String(f?.filePath ?? ''));
    return { row: f, rel, abs: resolvePathFrom(options.projectPath, rel) };
  });
  const presentNames = new Set<string>();
  const presentAbs = new Set<string>();
  for (const r of resolved) {
    const dir = dirOf(r.rel);
    presentNames.add(((dir ? `${dir}/` : '') + baseOf(r.rel)).toLowerCase());
    presentAbs.add(r.abs.toLowerCase());
  }

  // Pass 2 — classify. First match wins, in this order:
  //   ignored dir -> backup pattern -> digit copy -> duplicate.
  const seenAbs = new Set<string>();
  const kept: LineCountResult[] = [];

  for (const { row, rel, abs } of resolved) {
    if (!row || typeof row.filePath !== 'string' || !row.filePath) {
      drop(report, 'backup', rel || '(no path)', 'malformed row');
      continue;
    }
    const name = baseOf(rel);

    const ignoredDir = matchIgnoreDir(rel, [...ignoreSet]);
    if (ignoredDir) { drop(report, 'ignoreDir', rel, `ignored directory "${ignoredDir}"`); continue; }

    if (settings.excludeBackups) {
      const pat = matchBackupPattern(name);
      if (pat) { drop(report, 'backup', rel, pat); continue; }
    }

    if (settings.excludeDigitCopies) {
      const cand = digitCopyCandidate(rel);
      if (cand) {
        const originalAbs = resolvePathFrom(options.projectPath, cand.original);
        const originalPresent = presentNames.has(cand.original.toLowerCase()) || presentAbs.has(originalAbs.toLowerCase());
        if (originalPresent) {
          drop(report, 'digitCopy', rel, `digit-suffixed copy of ${cand.original}`);
          continue;   // MUST continue — dropping from the count but keeping the row
                      // makes the headline number disagree with the visible list.
        }
        // No original in the scan — KEEP the file, but surface it so the number
        // is explainable rather than mysteriously different.
        if (cand.stem.length >= ORPHAN_MIN_STEM) {
          drop(report, 'orphanDigit', rel, `no ${cand.original} in scan — kept`);
        }
      }
    }

    if (settings.dedupe) {
      const key = abs.toLowerCase();
      if (seenAbs.has(key)) { drop(report, 'duplicate', rel, `same file as ${abs}`); continue; }
      seenAbs.add(key);
    }

    kept.push(row);
  }

  // Recompute the per-language summary from the KEPT rows only.
  const summary: Record<string, FileTypeSummary> = {};
  for (const f of kept) {
    const lang = f.fileType || 'Unknown';
    if (!summary[lang]) summary[lang] = { count: 0, totalLines: 0, codeLines: 0, commentLines: 0, blankLines: 0 };
    const s = summary[lang];
    s.count++;
    s.totalLines += f.totalLines || 0;
    s.codeLines += f.codeLines || 0;
    s.commentLines += f.commentLines || 0;
    s.blankLines += f.blankLines || 0;
  }

  report.keptFiles = kept.length;

  const data: LineStatsData = {
    files: kept,
    summary,
    scannedAt: input?.scannedAt || '',
    totalFiles: kept.length,
  };
  return { data: files.length ? data : null, report };
}

export const TOTAL_EXCLUDED = (r: ExclusionReport) =>
  r.ignoredDirs + r.backups + r.digitCopies + r.duplicates;