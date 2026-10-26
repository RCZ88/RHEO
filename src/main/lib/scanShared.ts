/**
 * scanShared — the single source of truth for what the file-change ledger walks.
 *
 * Extracted so `count-project-lines` and `scan-project-changes` can never drift
 * (RESULT.md §5.1 step 3). The ledger consumes these; `count-project-lines`
 * still owns its inline copy today (a live surface, deliberately untouched),
 * but any future drift should be resolved by pointing it at this module.
 */

import { countLines } from './lineDiff';

/** Directory names skipped entirely during a project walk. */
export const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'build',
  '.next', '.nuxt', 'out', 'target', 'bin', 'obj', 'venv', '.venv',
  '__pycache__', '.tox', '.mypy_cache', '.pytest_cache', 'coverage',
  '.idea', '.vscode', 'tmp', '.temp', '.cache', 'dist-electron',
]);

/** Backup / copy artefacts matched on the file NAME only. */
export const BACKUP_RE = /(\.bak($|[-._\d])|\.backup($|[-._\d])|\.orig($|[-._])|\.rej$|\.old$|\.save$|\.sw[op]$|~$|^#.*#$|^\.#|\.(tmp|temp|copy|disabled)$)/i;

/** A numbered copy: `preload2.ts`, `foo3.tsx` — trailing digits before the ext. */
export const DIGITCOPY_RE = /^(.*?)(\d+)\.[A-Za-z0-9]+$/;

/**
 * Extensions considered "source" for line tracking. Mirrors the ext→language
 * map the line counter already owns; kept here so the ledger can filter without
 * importing the whole map.
 */
export const TRACKED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go',
  '.java', '.c', '.cpp', '.h', '.cs', '.rb', '.php', '.swift',
  '.kt', '.scala', '.r', '.vue', '.svelte', '.html', '.css',
  '.scss', '.less', '.json', '.yaml', '.yml', '.toml', '.xml',
  '.sql', '.sh', '.md', '.txt',
]);

/** Extension → coarse language label (subset of the line counter's map). */
export const EXT_LANG: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript',
  '.jsx': 'JavaScript', '.py': 'Python', '.rs': 'Rust', '.go': 'Go',
  '.java': 'Java', '.c': 'C', '.cpp': 'C++', '.h': 'C/C++',
  '.cs': 'C#', '.rb': 'Ruby', '.php': 'PHP', '.swift': 'Swift',
  '.kt': 'Kotlin', '.scala': 'Scala', '.r': 'R',
  '.vue': 'Vue', '.svelte': 'Svelte', '.html': 'HTML', '.css': 'CSS',
  '.scss': 'SCSS', '.less': 'LESS', '.json': 'JSON', '.yaml': 'YAML',
  '.yml': 'YAML', '.toml': 'TOML', '.xml': 'XML', '.sql': 'SQL',
  '.sh': 'Shell', '.md': 'Markdown', '.txt': 'Text',
};

/** Binary / generated / minified extensions the ledger never diffs. */
export const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.avif',
  '.pdf', '.zip', '.gz', '.tar', '.bz2', '.xz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.a', '.class', '.jar',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.wav', '.ogg', '.mov', '.avi', '.mkv',
  '.db', '.sqlite', '.sqlite3',
]);

/** Minified / lock files: single-line, huge, churn-heavy — skipped. */
export const MINIFIED_RE = /\.(min\.js|min\.css|bundle\.js|lock|lock\.json)$/i;

export interface WalkEntry {
  abs: string;
  rel: string;
  ext: string;
  size: number;
}

export interface WalkOptions {
  maxFiles?: number;
  ignoreDirs?: Set<string>;
  maxDepth?: number;
}

/**
 * Walk a project tree collecting candidate source files. Applies every skip
 * rule (dirs, backups, binary, minified, untracked extensions) up front so the
 * ledger and any future consumer see the same candidate set.
 */
export function walkProject(
  fs: any,
  path: any,
  root: string,
  opts: WalkOptions = {}
): WalkEntry[] {
  const maxFiles = opts.maxFiles ?? 20000;
  const maxDepth = opts.maxDepth ?? 12;
  const ignore = opts.ignoreDirs ?? SKIP_DIRS;
  const out: WalkEntry[] = [];
  let walked = 0;
  let truncated = false;

  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth || walked >= maxFiles) {
      if (walked >= maxFiles) truncated = true;
      return;
    }
    let entries: any[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (walked >= maxFiles) {
        truncated = true;
        return;
      }
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!ignore.has(e.name)) walk(full, depth + 1);
      } else if (e.isFile()) {
        walked++;
        if (BACKUP_RE.test(e.name)) continue;
        if (DIGITCOPY_RE.test(e.name)) continue;
        const ext = path.extname(e.name).toLowerCase();
        if (BINARY_EXTS.has(ext)) continue;
        if (MINIFIED_RE.test(e.name)) continue;
        if (!TRACKED_EXTS.has(ext)) continue;
        let size = 0;
        try {
          size = fs.statSync(full).size;
        } catch {
          continue;
        }
        out.push({ abs: full, rel: path.relative(root, full), ext, size });
      }
    }
  };

  walk(root, 0);
  return out;
}

export { countLines };
