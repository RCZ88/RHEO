import { useEffect, useRef, useCallback } from 'react';
import type { SearchableSegment } from '../services/search/index';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SearchRegistration {
  pageId: string;
  segments: SearchableSegment[];
}

// ── Hook: register searchable content for the current page ───────────────────

/**
 * Call once per page/overlay mount with the segments you want searchable.
 * Automatically unindexes on unmount.
 *
 * @param pageId   unique page identifier (e.g. "dashboard", "analytics")
 * @param segments array of searchable segments
 */
export function useSmartSearch(pageId: string, segments: SearchableSegment[]) {
  const registered = useRef(false);

  useEffect(() => {
    if (!window.deskflowAPI?.smartSearchIndex) return;
    // Register
    window.deskflowAPI.smartSearchIndex(segments).then(r => {
      console.debug('[SmartSearch] indexed', r.indexed, 'segments for', pageId);
    }).catch(err => console.error('[SmartSearch] index error:', err));
    registered.current = true;

    // Unindex on unmount
    return () => {
      if (window.deskflowAPI?.smartSearchUnindexPage) {
        window.deskflowAPI.smartSearchUnindexPage(pageId).catch(() => {});
      }
      registered.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);
}

// ── Hook: keyboard shortcut (Ctrl+F / Ctrl+K) ───────────────────────────────

export function useSmartSearchShortcut(open: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F or Ctrl/Cmd + K
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'f' || e.key === 'F' || e.key === 'k' || e.key === 'K')) {
        // Don't hijack when typing in an input/textarea/select unless it's a contenteditable
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        // But DO hijack if the input is part of a search bar we own (data-smart-search-input)
        if (tag === 'INPUT' && (e.target as HTMLElement).dataset?.smartSearchInput) return;
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);
}
