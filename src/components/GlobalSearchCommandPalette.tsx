import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import { PALETTE_ENTRIES, type PaletteEntry } from '../pages/registry';
import { resolveIcon } from '../pages/registry/icons';

/**
 * GlobalSearchCommandPalette — Ctrl+K / Cmd+K.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ITEMS LIST IS NOT HERE. It is in `src/pages/registry/`.
 *
 * This file used to carry a hand-maintained `ITEMS: PaletteItem[]` of 103 rows.
 * It was wrong in ways nothing reported:
 *
 *   • 12 of its 59 `section` anchors pointed at `data-section` values that no
 *     component had ever written (`dash.summary`, `dash.timer`, `dash.activity`,
 *     `database.browse`, `guide.tutorial`, `guide.specs`, `finance.budget`, …).
 *     Selecting one navigated to the right page and then failed to scroll, after
 *     a silent 1.85s retry loop.
 *   • The reverse also held: 18 real anchors had no palette row at all — including
 *     every one of the Life page's seven tabs, so `Life → Notes` was unreachable.
 *   • 3 rows and 4 registry keys pointed at `/focus`, which is not a route. It hit
 *     the `*` catch-all and rendered NotFoundPage.
 *   • `/penguin-console`, `/simple-terminal`, `/ide-help`, `/lecture/*` and the
 *     whole `/labs` page were absent, as were 29 Terminal sub-tabs, all 9 Content
 *     Engine stages, and the `/reports` Rankings tab.
 *
 * Rows are now DERIVED from the page manifests, so a row cannot point at an
 * anchor that does not exist — `npm run validate:pages` fails the build if it
 * tries. Count went 103 -> 203 with no new hand-written list.
 *
 * Search is also no longer naive substring matching. The old filter was
 * `label.includes(q) || keywords.some(k => k.includes(q)) || group.includes(q)`,
 * which ranked everything equally: typing "notes" matched `Life → Notes` and
 * `Terminal → Context → Notes` in arbitrary order, with no preference for an
 * exact label, a label prefix, or a shorter path. `score()` below fixes that.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Where a row sends you, resolved to a concrete target. */
export interface PaletteItem extends PaletteEntry {}

const ITEMS: PaletteEntry[] = PALETTE_ENTRIES

/**
 * Rank matches instead of filtering them.
 *
 * Deliberately simple and explainable — every score contribution has a reason a
 * user could predict:
 *   exact label      1000  you asked for this by name
 *   label prefix      700  "note" -> "Notes"
 *   word-start hit    500  "gold" matches "Life — Gold"
 *   label substring   300  "note" still finds "Notes & Drafts"
 *   keyword hit       200  catches synonyms like "cv" -> "Resume"
 *   group hit         100  weakest: "life" finds the whole Life group
 * Every query token must match something, and a shorter path wins ties, so the
 * specific row ("Life — Notes") outranks the broad one.
 */
function score(item: PaletteEntry, tokens: string[]): number {
  const label = item.label.toLowerCase()
  const group = item.group.toLowerCase()
  const keywords = item.keywords.map(k => k.toLowerCase())
  let total = 0

  for (const token of tokens) {
    let best = 0
    if (label === token) best = 1000
    else if (label.startsWith(token)) best = 700
    else if (new RegExp(`\\b${escapeRe(token)}`).test(label)) best = 500
    else if (label.includes(token)) best = 300
    else if (keywords.some(k => k === token)) best = 250
    else if (keywords.some(k => k.includes(token))) best = 200
    else if (group.includes(token)) best = 100
    // Every token must contribute. Without this, "life notes" would match any
    // row containing "life" OR "notes", which is how the old filter behaved.
    if (best === 0) return 0
    total += best
  }

  // A row whose OWN LABEL covers every token beats one that only matched some
  // of them via inherited page keywords.
  //
  // Without this, "life notes" ranked `Life` above `Life — Notes`: "life" scored
  // an exact-label 1000 against the page row, and every Life tab inherits the
  // page's keywords — which include "notes" — so all of them matched too. The
  // result was that the exact tab you named came third. Same for
  // "resume build" -> `Resume Builder` instead of `Resume — Build / Editor`.
  // Page keywords are deliberately inherited by every child, which is great for
  // recall and bad for precision; this bonus is the precision correction.
  if (tokens.length > 1 && tokens.every(t => label.includes(t))) total += 400

  // Prefer the shallower, more specific row on a tie.
  const depth = item.id.split('/').length + item.id.split('#').length
  return total * 10 - depth
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function GlobalSearchCommandPalette({ isOpen, onClose, onNavigate }: {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (item: PaletteItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return ITEMS;
    // Ranked, not just filtered — see `score()`.
    return ITEMS
      .map((item) => ({ item, s: score(item, tokens) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.item);
  }, [query]);

  /** Groups, in first-appearance order so ranking survives into the headings. */
  const groups = useMemo(() => [...new Set(filtered.map(i => i.group))], [filtered]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard lives on the INPUT, not only on window.
  //
  // Why this changed: the handler used to sit on a window bubble-phase listener.
  // Any listener between the input and window that calls stopPropagation() — or
  // simply any future capture-phase handler — silently kills Enter, and the
  // palette looks alive while being keyboard-dead. React's onKeyDown on the
  // focused element is the only delivery path that cannot be swallowed from the
  // outside, so it is now the single source of truth. The window listener is
  // kept ONLY as a fallback for keys pressed while focus is outside the input,
  // and it bails out when the event already came from the input (no double-fire).
  // Commit reads from REFS, never from a useCallback closure.
  //
  // Why: the previous version closed over `filtered[selectedIndex]` inside a
  // useCallback whose deps included an `onNavigate` prop that is a fresh inline
  // arrow on every App render. That combination makes the memoised callback
  // and the live render disagree, and the failure is invisible — the palette
  // looks alive, arrows move the highlight, and Enter silently does nothing.
  // Refs written during render are always current, so this path cannot go stale.
  const filteredRef = useRef(filtered);
  const selectedIndexRef = useRef(selectedIndex);
  filteredRef.current = filtered;
  selectedIndexRef.current = selectedIndex;

  const move = useCallback(
    (delta: number) => setSelectedIndex(i => Math.min(Math.max(i + delta, 0), Math.max(filteredRef.current.length - 1, 0))),
    [],
  );

  const commit = useCallback(() => {
    const i = selectedIndexRef.current;
    const item = filteredRef.current[i];
    console.log('[CommandPalette] commit requested', { index: i, total: filteredRef.current.length, id: item?.id ?? null });
    if (!item) return;
    // Probe hook: lets a runtime test assert the Enter path fired end-to-end
    // without scraping React internals.
    window.dispatchEvent(new CustomEvent('command-palette:commit', { detail: { id: item.id, index: i } }));
    onNavigateRef.current(item);
  }, []);

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
    if (e.key === 'Home') { e.preventDefault(); setSelectedIndex(0); return; }
    if (e.key === 'End') { e.preventDefault(); setSelectedIndex(Math.max(filteredRef.current.length - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(); }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      // The input owns its own keys — do not double-handle them.
      if (e.target === inputRef.current) return;
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, move, commit, onClose]);

  // Keep the highlighted row inside the scroll viewport. Without this, arrowing
  // past the fold moves an invisible selection and Enter then opens something
  // the user cannot see — the exact "Enter doesn't work" symptom.
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`);
    if (!el) return;
    const rTop = root.scrollTop;
    const rBot = rTop + root.clientHeight;
    const eTop = el.offsetTop;
    const eBot = eTop + el.offsetHeight;
    if (eTop < rTop) root.scrollTop = eTop;
    else if (eBot > rBot) root.scrollTop = eBot - root.clientHeight;
  }, [selectedIndex, filtered]);

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={filtered[selectedIndex] ? `cmd-${filtered[selectedIndex].id}` : undefined}
            aria-label="Search pages, tabs, sections and cards"
            placeholder="Search pages, tabs, sections, cards..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
          />
          <kbd className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div ref={listRef} id="command-palette-results" role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">No results found</div>
          )}
          {groups.map(group => {
            const groupItems = filtered.filter(i => i.group === group);
            return (
              <div key={group}>
                <div className="px-4 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{group}</div>
                {groupItems.map(item => {
                  const idx = filtered.indexOf(item);
                  const Icon = resolveIcon(item.icon);
                  return (
                    <button
                      key={item.id}
                      id={`cmd-${item.id}`}
                      role="option"
                      aria-selected={idx === selectedIndex}
                      data-idx={idx}
                      data-cmd-id={item.id}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                        idx === selectedIndex ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                      }`}
                      onClick={() => { selectedIndexRef.current = idx; setSelectedIndex(idx); commit(); }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="text-[10px] text-zinc-600 truncate">{item.detail || item.section || item.route}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer — makes the keyboard contract visible instead of folklore */}
        <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600">
          <span><span className="text-zinc-400">↑↓</span> navigate</span>
          <span><span className="text-zinc-400">↵</span> open</span>
          <span><span className="text-zinc-400">esc</span> close</span>
          <span className="ml-auto normal-case tracking-normal text-zinc-600">
            {filtered.length > 0 ? `${selectedIndex + 1} of ${filtered.length}` : 'no matches'}
          </span>
        </div>
      </div>
    </div>
  );
}
