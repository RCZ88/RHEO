// Smart Search Service — in-memory inverted index with fuzzy matching
// Runs in Electron main process. UI is renderer-only.

import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SearchableSegment {
  id: string;            // unique segment id
  pageId: string;        // which page/overlay owns this
  title: string;         // heading / label
  text: string;          // full searchable text
  section?: string;      // sub-section within page
  keywords?: string[];   // extra tokens that aren't in text
  rank?: number;         // 0-1 boost (higher = appears first for tie-breaking)
}

interface IndexedSegment extends SearchableSegment {
  tokens: string[];      // normalized tokens from text + keywords
  tokenSet: Set<string>;
}

// ── Index ────────────────────────────────────────────────────────────────────

class SearchIndex {
  private segments: Map<string, IndexedSegment> = new Map();
  private tokenIndex: Map<string, Set<string>> = new Map(); // token → segment ids
  private pageIndex: Map<string, Set<string>> = new Map();   // pageId → segment ids

  clear() {
    this.segments.clear();
    this.tokenIndex.clear();
    this.pageIndex.clear();
  }

  /** Register or update a segment. Remove old tokens first if id already exists. */
  upsert(seg: SearchableSegment) {
    const existing = this.segments.get(seg.id);
    if (existing) {
      // remove old tokens
      for (const t of existing.tokens) {
        const set = this.tokenIndex.get(t);
        if (set) { set.delete(seg.id); if (set.size === 0) this.tokenIndex.delete(t); }
      }
      const pageSet = this.pageIndex.get(existing.pageId);
      if (pageSet) { pageSet.delete(seg.id); if (pageSet.size === 0) this.pageIndex.delete(existing.pageId); }
    }

    const tokens = tokenize(seg.text + ' ' + (seg.keywords?.join(' ') ?? ''));
    const indexed: IndexedSegment = { ...seg, tokens, tokenSet: new Set(tokens) };
    this.segments.set(seg.id, indexed);

    for (const t of tokens) {
      if (!this.tokenIndex.has(t)) this.tokenIndex.set(t, new Set());
      this.tokenIndex.get(t)!.add(seg.id);
    }

    if (!this.pageIndex.has(seg.pageId)) this.pageIndex.set(seg.pageId, new Set());
    this.pageIndex.get(seg.pageId)!.add(seg.id);
  }

  /** Remove a segment by id. */
  remove(id: string) {
    const seg = this.segments.get(id);
    if (!seg) return;
    for (const t of seg.tokens) {
      const set = this.tokenIndex.get(t);
      if (set) { set.delete(id); if (set.size === 0) this.tokenIndex.delete(t); }
    }
    const pageSet = this.pageIndex.get(seg.pageId);
    if (pageSet) { pageSet.delete(id); if (pageSet.size === 0) this.pageIndex.delete(seg.pageId); }
    this.segments.delete(id);
  }

  /** Remove all segments for a page. */
  removePage(pageId: string) {
    const ids = this.pageIndex.get(pageId);
    if (!ids) return;
    for (const id of ids) this.remove(id);
  }

  /** Fuzzy search. Returns ranked results. */
  query(raw: string, opts: { limit?: number; ctxChars?: number } = {}): SearchHit[] {
    const limit = opts.limit ?? 50;
    const ctxChars = opts.ctxChars ?? 120;
    const terms = tokenize(raw);
    if (terms.length === 0) return [];

    const scores = new Map<string, number>();

    // Score each segment by how well it matches the query terms
    for (const seg of this.segments.values()) {
      let score = 0;
      // per-term best match
      for (const term of terms) {
        const termScore = bestTermScore(term, seg);
        if (termScore > 0) score += termScore;
      }
      if (score > 0) {
        // boost by rank + title matches
        score *= 1 + (seg.rank ?? 0.5);
        if (terms.some(t => seg.title.toLowerCase().includes(t))) score *= 1.5;
        scores.set(seg.id, score);
      }
    }

    // Sort by score desc, then by rank desc
    const sorted = [...scores.entries()]
      .sort((a, b) => b[1] - a[1] || (this.segments.get(b[0])?.rank ?? 0.5) - (this.segments.get(a[0])?.rank ?? 0.5))
      .slice(0, limit);

    return sorted.map(([id]) => {
      const seg = this.segments.get(id)!;
      // Build context snippet around first matching term
      const text = (seg.text || '').slice(0, 2000);
      const lower = text.toLowerCase();
      let snippet = '';
      let bestPos = -1;
      let bestLen = 0;
      for (const term of terms) {
        const pos = lower.indexOf(term);
        if (pos >= 0 && (pos > bestPos || (pos === bestPos && term.length > bestLen))) {
          bestPos = pos;
          bestLen = term.length;
        }
      }
      if (bestPos >= 0) {
        const start = Math.max(0, bestPos - ctxChars);
        const end = Math.min(text.length, bestPos + ctxChars + (terms[0]?.length ?? 0));
        snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
      } else {
        snippet = text.slice(0, ctxChars * 2) + (text.length > ctxChars * 2 ? '...' : '');
      }
      return {
        id: seg.id,
        pageId: seg.pageId,
        title: seg.title,
        section: seg.section ?? '',
        snippet,
        score: scores.get(id) ?? 0,
      };
    });
  }

  /** Autocomplete suggestions for a partial query. */
  suggest(raw: string, opts: { limit?: number } = {}): Suggestion[] {
    const limit = opts.limit ?? 12;
    const terms = tokenize(raw);
    if (terms.length === 0) return [];

    const seen = new Set<string>();
    const results: Suggestion[] = [];

    for (const seg of this.segments.values()) {
      const titleLower = seg.title.toLowerCase();
      for (const term of terms) {
        if (titleLower.includes(term) && !seen.has(seg.id)) {
          seen.add(seg.id);
          results.push({
            id: seg.id,
            text: seg.title + (seg.section ? ` — ${seg.section}` : ''),
            pageId: seg.pageId,
          });
          break;
        }
      }
      if (results.length >= limit) break;
    }
    return results;
  }

  /** Get all segment ids for a page (for replacing content). */
  getPageSegmentIds(pageId: string): string[] {
    return [...(this.pageIndex.get(pageId) ?? [])];
  }

  segmentCount(): number {
    return this.segments.size;
  }
}

// ── Tokenization ────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  // Lowercase, strip punctuation, split on whitespace, remove short tokens
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

function bestTermScore(term: string, seg: IndexedSegment): number {
  // Exact token match = 1.0
  if (seg.tokenSet.has(term)) return 1.0;
  // Prefix match = 0.7
  const prefixMatches = [...seg.tokenSet].filter(t => t.startsWith(term)).length;
  if (prefixMatches > 0) return 0.7 * Math.min(prefixMatches, 3) / 3;
  // Substring/ngram match = 0.3–0.5
  const subMatch = [...seg.tokenSet].some(t => t.includes(term));
  if (subMatch) return 0.4;
  // Fuzzy: chars in common (simple)
  const termChars = new Set(term);
  for (const t of seg.tokenSet) {
    if (t.length < 3) continue;
    let shared = 0;
    for (const c of termChars) if (t.includes(c)) shared++;
    const ratio = shared / Math.max(term.length, 1);
    if (ratio > 0.6) return 0.25 * ratio;
  }
  return 0;
}

// ── Result types ────────────────────────────────────────────────────────────

export interface SearchHit {
  id: string;
  pageId: string;
  title: string;
  section: string;
  snippet: string;
  score: number;
}

export interface Suggestion {
  id: string;
  text: string;
  pageId: string;
}

// ── Singleton ────────────────────────────────────────────────────────────────

export const searchIndex = new SearchIndex();

// ── IPC Handlers ────────────────────────────────────────────────────────────

export function registerSearchIpc() {
  // Register/update content for a page
  ipcMain.handle('smart-search:index', (_ev, segments: SearchableSegment[]) => {
    for (const s of segments) searchIndex.upsert(s);
    return { indexed: searchIndex.segmentCount() };
  });

  // Clear content for a page (call when page unloads)
  ipcMain.handle('smart-search:unindex-page', (_ev, pageId: string) => {
    searchIndex.removePage(pageId);
    return { remaining: searchIndex.segmentCount() };
  });

  // Full query
  ipcMain.handle('smart-search:query', (_ev, query: string, opts?: { limit?: number; ctxChars?: number }) => {
    return searchIndex.query(query, opts ?? {});
  });

  // Autocomplete
  ipcMain.handle('smart-search:suggest', (_ev, query: string, opts?: { limit?: number }) => {
    return searchIndex.suggest(query, opts ?? {});
  });

  // Clear entire index
  ipcMain.handle('smart-search:clear', () => {
    searchIndex.clear();
    return { indexed: 0 };
  });

  // Stats
  ipcMain.handle('smart-search:stats', () => ({
    indexed: searchIndex.segmentCount(),
  }));
}

// ── Convenience: hydrate from file (for pre-seeding on startup) ────────────

export function loadIndexFromFile(dbPath: string): boolean {
  try {
    if (!fs.existsSync(dbPath)) return false;
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const segments: SearchableSegment[] = JSON.parse(raw);
    for (const s of segments) searchIndex.upsert(s);
    return true;
  } catch {
    return false;
  }
}

export function saveIndexToFile(dbPath: string): boolean {
  try {
    const segs = [...searchIndex.segments.values()].map(({ tokens: _t, tokenSet: _s, ...rest }) => rest);
    fs.writeFileSync(dbPath, JSON.stringify(segs, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}
