import { ipcRenderer } from 'electron';
import type { SearchHit, Suggestion } from '../services/search/index';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SearchOptions {
  limit?: number;
  ctxChars?: number;
}

export interface SearchResult extends SearchHit {}

export interface SearchSuggestion {
  id: string;
  text: string;
  pageId: string;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function smartSearchIndex(segments: unknown[]): Promise<{ indexed: number }> {
  return ipcRenderer.invoke('smart-search:index', segments);
}

export async function smartSearchUnindexPage(pageId: string): Promise<{ remaining: number }> {
  return ipcRenderer.invoke('smart-search:unindex-page', pageId);
}

export async function smartSearchQuery(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
  return ipcRenderer.invoke('smart-search:query', query, opts);
}

export async function smartSearchSuggest(query: string, opts: { limit?: number } = {}): Promise<SearchSuggestion[]> {
  return ipcRenderer.invoke('smart-search:suggest', query, opts);
}

export async function smartSearchClear(): Promise<{ indexed: number }> {
  return ipcRenderer.invoke('smart-search:clear');
}

export async function smartSearchStats(): Promise<{ indexed: number }> {
  return ipcRenderer.invoke('smart-search:stats');
}
