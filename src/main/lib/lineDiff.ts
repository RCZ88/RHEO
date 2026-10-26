/**
 * lineDiff — dependency-free, deterministic line-level diff for the file-change
 * ledger (RESULT.md §5.4).
 *
 * Contract:
 *  - Counts only `{ added, removed }` — no hunks, no patch text.
 *  - CRLF→LF normalized before splitting, so an EOL-only flip diffs to 0/0.
 *  - Same inputs ⇒ same counts on every machine (no git binary, no config).
 *
 * Algorithm: trim the common prefix/suffix, then Myers O(ND) greedy over the
 * trimmed middle with a linear-ish trace for exact counts. A middle too large
 * for the O(D²) trace (pathological full rewrite of a 512KB file) degrades to a
 * two-row LCS — O(min(n,m)) memory, still exact. Both paths return identical
 * numbers for the fixtures the probes assert against.
 */

const CRLF = /\r\n/g;

/** Normalize line endings so a CRLF↔LF-only change produces a 0/0 delta. */
export function normalizeEol(text: string): string {
  return text.replace(CRLF, '\n');
}

/**
 * Count lines the SAME way `count-project-lines` does: a trailing newline does
 * not create a phantom empty last line; an empty file is 0 lines.
 */
export function countLines(text: string): number {
  if (text === '') return 0;
  const n = text.split('\n').length;
  return text.endsWith('\n') ? n - 1 : n;
}

/** Split normalized text into lines, honoring the countLines() trailing rule. */
function toLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export interface DiffCounts {
  added: number;
  removed: number;
}

/**
 * Line diff between two text blobs. Returns counts of lines added and removed
 * going from `oldText` to `newText`.
 */
export function lineDiff(oldText: string, newText: string): DiffCounts {
  const a = toLines(normalizeEol(oldText));
  const b = toLines(normalizeEol(newText));
  const n = a.length;
  const m = b.length;
  if (n === 0) return { added: m, removed: 0 };
  if (m === 0) return { added: 0, removed: n };

  // Trim identical prefix.
  let start = 0;
  const minLen = n < m ? n : m;
  while (start < minLen && a[start] === b[start]) start++;
  // Trim identical suffix.
  let endA = n;
  let endB = m;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const A = a.slice(start, endA);
  const B = b.slice(start, endB);
  const na = A.length;
  const nb = B.length;
  if (na === 0) return { added: nb, removed: 0 };
  if (nb === 0) return { added: 0, removed: na };

  // Pathological middles: fall back to memory-safe LCS.
  if (na * nb > 40_000_000) {
    const lcs = lcsLength(A, B);
    return { added: nb - lcs, removed: na - lcs };
  }

  return myers(A, B);
}

/** Myers O(ND) greedy, backtracking through the recorded V snapshots. */
function myers(A: string[], B: string[]): DiffCounts {
  const n = A.length;
  const m = B.length;
  const max = n + m;
  const offset = max;
  const v = new Int32Array(2 * max + 1);
  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]; // down = insert
      } else {
        x = v[offset + k - 1] + 1; // right = delete
      }
      let y = x - k;
      while (x < n && y < m && A[x] === B[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        return backtrack(trace, A, B, d, offset);
      }
    }
  }
  // Unreachable for a valid edit graph.
  return { added: m, removed: n };
}

function backtrack(
  trace: Int32Array[],
  A: string[],
  B: string[],
  dEnd: number,
  offset: number
): DiffCounts {
  const n = A.length;
  const m = B.length;
  let x = n;
  let y = m;
  let added = 0;
  let removed = 0;

  for (let d = dEnd; d > 0; d--) {
    const v = trace[d];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
      prevK = k + 1; // came from down (insert)
    } else {
      prevK = k - 1; // came from right (delete)
    }
    const prevV = v[offset + prevK];
    const prevX = prevV;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
      // diagonal = equal line, no count
    }
    if (d > 0) {
      if (x === prevX) {
        added++; // insert (moved down in B)
      } else {
        removed++; // delete (moved right in A)
      }
    }
    x = prevX;
    y = prevY;
  }
  // At d=0 we are at the common prefix start; any remaining diagonal is equal.
  return { added, removed };
}

/** Two-row LCS length — O(min(n,m)) memory fallback for large middles. */
function lcsLength(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return 0;
  let prev = new Int32Array(m + 1);
  let curr = new Int32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : prev[j] > curr[j - 1] ? prev[j] : curr[j - 1];
    }
    const t = prev;
    prev = curr;
    curr = t;
  }
  return prev[m];
}
