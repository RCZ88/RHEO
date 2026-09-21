import { useState, useCallback, useEffect, useRef } from 'react';
import type { SearchableSegment, SearchHit } from '../services/search/index';

// ── Hook: register searchable content for the current page ───────────────────

export function useSmartSearch(pageId: string, segments: SearchableSegment[]) {
  const registered = useRef(false);

  useEffect(() => {
    if (!window.deskflowAPI?.smartSearchIndex) return;
    window.deskflowAPI.smartSearchIndex(segments).then(r => {
      console.debug('[SmartSearch] indexed', r.indexed, 'segments for', pageId);
    }).catch(err => console.error('[SmartSearch] index error:', err));
    registered.current = true;

    return () => {
      if (window.deskflowAPI?.smartSearchUnindexPage) {
        window.deskflowAPI.smartSearchUnindexPage(pageId).catch(() => {});
      }
      registered.current = false;
    };
  }, [pageId]);
}

// ── Hook: keyboard shortcut + overlay state (used in App shell) ───────────────

export function useAppSmartSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Listen for external open requests (e.g. sidebar button)
  useEffect(() => {
    const onExternalOpen = () => setOpen(true);
    window.addEventListener('smart-search:open', onExternalOpen as EventListener);
    return () => window.removeEventListener('smart-search:open', onExternalOpen as EventListener);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSelect = useCallback((hit: SearchHit) => {
    console.debug('[SmartSearch] selected:', hit);
    // Dispatch to the page; pages can listen on 'smart-search:select' to scroll/highlight
    window.dispatchEvent(new CustomEvent('smart-search:select', { detail: hit }));
    setOpen(false);
  }, []);

  // Keyboard shortcut: Ctrl+F only — find-in-page bar (page stays visible).
  // Ctrl+K opens the command palette separately (GlobalSearchCommandPalette).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key !== 'f') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (!(e.target as HTMLElement).dataset?.smartSearchInput) return;
      }
      // Let the browser handle Ctrl+F natively — do NOT dispatch custom overlay event
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { open, handleClose, handleSelect };
}

// ── Global open function (used by sidebar button, etc.) ──────────────────────

export function openSmartSearch() {
  window.dispatchEvent(new CustomEvent('smart-search:open'));
}

export interface SearchHit {
  id: string;
  pageId: string;
  title: string;
  section: string;
  snippet: string;
  score: number;
}
