// Terminal Switcher — address a terminal or an agent session by what it is
// doing, not by tab index. Lives over the workspace, opened with Ctrl/Cmd+`.
//
// Two groups because the two actions differ in kind:
//   • Focus  — a live terminal is already running. Instant and reversible.
//   • Resume — no live terminal, so this SPAWNS one. Riskier, hence it confirms.
// Ctrl+K stays app-global (App.tsx owns it) and Ctrl+F stays the find bar.

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Terminal as TerminalIcon, Play, Loader2, CornerDownLeft, Hash } from 'lucide-react';
import { SESSION_STATUS_STYLES } from '../../pages/terminal/TerminalGrid';

export interface SwitcherTab {
  id: string;
  name: string;
  agent: string;
  modelTier?: string;
}

export interface SwitcherSession {
  id: string;
  agent: string;
  topic: string;
  status?: string;
  category?: string;
  terminal_id?: string;
  created_at?: string;
}

export interface TerminalSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  activeTerminalId: string | null;
  tabs: SwitcherTab[];
  sessions: SwitcherSession[];
  onFocusTerminal: (terminalId: string) => void;
  onResumeSession: (session: SwitcherSession) => void;
}

interface Row {
  kind: 'terminal' | 'session';
  id: string;
  title: string;
  subtitle: string;
  agent: string;
  status?: string;
  category?: string;
  haystack: string;
}

// Subsequence match, so "cfgfix" finds "Fix config bug". Returns a score so the
// best match can lead, plus -1 for no match. Consecutive and word-start hits win.
function fuzzyScore(needle: string, haystack: string): number {
  if (!needle) return 0;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  const direct = h.indexOf(n);
  if (direct === 0) return 1000 - h.length;       // prefix — best
  if (direct > 0) return 600 - direct - h.length * 0.1; // substring
  // subsequence fallback
  let hi = 0;
  let score = 0;
  let streak = 0;
  for (let ni = 0; ni < n.length; ni++) {
    const ch = n[ni];
    const found = h.indexOf(ch, hi);
    if (found === -1) return -1;
    if (found === hi && ni > 0) { streak++; score += 10 + streak * 4; } else { streak = 0; }
    score += found === 0 || h[found - 1] === ' ' || h[found - 1] === '-' || h[found - 1] === '_' ? 6 : 1;
    hi = found + 1;
  }
  return score;
}

function statusOf(s?: string) {
  return SESSION_STATUS_STYLES[s || 'active'] || SESSION_STATUS_STYLES.active;
}

export function TerminalSwitcher({
  isOpen, onClose, activeTerminalId, tabs, sessions, onFocusTerminal, onResumeSession,
}: TerminalSwitcherProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [confirmResume, setConfirmResume] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelected(0);
    setConfirmResume(null);
    setBusy(false);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [isOpen]);

  const rows = useMemo<Row[]>(() => {
    const liveIds = new Set(tabs.map(t => t.id));
    const termRows: Row[] = tabs.map(t => ({
      kind: 'terminal' as const,
      id: t.id,
      title: t.name || 'Terminal',
      subtitle: t.id === activeTerminalId ? 'Focused' : (t.modelTier ? `model: ${t.modelTier}` : 'idle'),
      agent: t.agent || 'shell',
      haystack: `${t.name} ${t.agent} ${t.modelTier || ''} ${t.id}`,
    }));
    // A session whose terminal is still open would be a duplicate target.
    const sessRows: Row[] = sessions
      .filter(s => !s.terminal_id || !liveIds.has(s.terminal_id))
      .map(s => ({
        kind: 'session' as const,
        id: s.id,
        title: s.topic || 'Untitled session',
        subtitle: s.created_at ? `saved ${s.created_at.slice(0, 10)}` : 'saved session',
        agent: s.agent || 'claude',
        status: s.status,
        category: s.category,
        haystack: `${s.topic} ${s.agent} ${s.category || ''} ${s.id}`,
      }));
    const all = [...termRows, ...sessRows];
    if (!query.trim()) return all;
    return all
      .map(r => ({ r, s: fuzzyScore(query.trim(), r.haystack) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.r);
  }, [tabs, sessions, activeTerminalId, query]);

  useEffect(() => { setSelected(0); }, [query]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const commit = useCallback((row: Row) => {
    if (row.kind === 'terminal') {
      onFocusTerminal(row.id);
      onClose();
      return;
    }
    // Resuming spawns a PTY — make the human confirm it first.
    setConfirmResume(row);
  }, [onFocusTerminal, onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (confirmResume) { setConfirmResume(null); return; }
      onClose();
      return;
    }
    if (confirmResume) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[selected];
      if (row) commit(row);
    }
  };

  const runResume = async () => {
    if (!confirmResume) return;
    const target = confirmResume;
    setBusy(true);
    try {
      await onResumeSession(target as unknown as SwitcherSession);
      onClose();
    } finally {
      setBusy(false);
      setConfirmResume(null);
    }
  };

  if (!isOpen) return null;

  const termCount = rows.filter(r => r.kind === 'terminal').length;
  const sessCount = rows.length - termCount;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[14vh] px-4" onClick={onClose}>
      {/* LAMINAR: flat scrim, no backdrop-blur on chrome. */}
      <div className="absolute inset-0 bg-zinc-900/80 animate-in fade-in-0 duration-150" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a terminal or session"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-xl bg-zinc-900 border border-[var(--ws-border)] shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden"
      >
        {/* Search field */}
        <div className="flex items-center gap-2 px-3 h-11 border-b border-[var(--ws-border)]">
          <Search className="w-4 h-4 shrink-0 text-zinc-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Jump to a terminal or session…"
            aria-label="Search terminals and sessions"
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
          />
          <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-500">ESC</kbd>
        </div>

        {confirmResume ? (
          // Confirm state — resuming spawns a new PTY, so never do it on one Enter.
          <div className="p-4">
            <p className="text-sm text-zinc-200">
              Start a terminal for <span className="font-medium text-zinc-50">{confirmResume.title}</span>?
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              This launches {confirmResume.agent} and reopens the saved session in it.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2">
              <button
                onClick={() => setConfirmResume(null)}
                disabled={busy}
                className="w-full px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--page-accent)]/60 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={runResume}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 w-full px-4 py-2 rounded-xl text-sm font-semibold text-zinc-950 bg-[color:var(--page-accent)] hover:opacity-90 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--page-accent)]/60 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />Starting…</> : <><Play className="w-3.5 h-3.5" aria-hidden="true" />Resume session</>}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1" role="listbox" aria-label="Results">
              {/* Empty state explains what would be here, not "no data". */}
              {rows.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs text-zinc-400">No terminal or session matches “{query}”.</p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Open one with <span className="text-zinc-400">+ New Session</span>, or search by agent name.
                  </p>
                </div>
              )}

              {termCount > 0 && (
                <div role="group" aria-label="Live terminals">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-600">
                    Live terminals{query ? ` · ${termCount}` : ''}
                  </div>
                  {rows.map((r, i) => r.kind === 'terminal' ? (
                    <button
                      key={`t-${r.id}`}
                      role="option"
                      aria-selected={i === selected}
                      data-selected={i === selected}
                      onClick={() => commit(r)}
                      onMouseMove={() => setSelected(i)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100 focus-visible:outline-none ${
                        i === selected ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      <TerminalIcon className="w-3.5 h-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-zinc-100 truncate">{r.title}</span>
                          {r.id === activeTerminalId && (
                            <span className="shrink-0 text-[9px] px-1 py-px rounded bg-[color:var(--page-accent)]/20 text-[color:var(--page-accent)]">focused</span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate">{r.agent} · {r.subtitle}</p>
                      </div>
                      <CornerDownLeft className="w-3 h-3 shrink-0 text-zinc-700" aria-hidden="true" />
                    </button>
                  ) : null)}
                </div>
              )}

              {sessCount > 0 && (
                <div role="group" aria-label="Saved sessions">
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-600 border-t border-[var(--ws-border)] mt-1 pt-2.5">
                    Saved sessions{query ? ` · ${sessCount}` : ''}
                  </div>
                  {rows.map((r, i) => r.kind === 'session' ? (
                    <button
                      key={`s-${r.id}`}
                      role="option"
                      aria-selected={i === selected}
                      data-selected={i === selected}
                      onClick={() => commit(r)}
                      onMouseMove={() => setSelected(i)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100 focus-visible:outline-none ${
                        i === selected ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusOf(r.status).dot}`}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-zinc-100 truncate block">{r.title}</span>
                        <p className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                          {r.category && <span className="inline-flex items-center gap-0.5"><Hash className="w-2.5 h-2.5" />{r.category}</span>}
                          {r.category && <span>·</span>}
                          <span>{r.agent}</span>
                        </p>
                      </div>
                      <Play className="w-3 h-3 shrink-0 text-zinc-700" aria-hidden="true" />
                    </button>
                  ) : null)}
                </div>
              )}
            </div>

            {/* Footer: keyboard contract, always visible so it is learnable. */}
            <div className="px-3 py-2 border-t border-[var(--ws-border)] flex items-center gap-3 text-[10px] text-zinc-600">
              <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">↵</kbd> go</span>
              <span className="ml-auto">sessions resume in a new terminal</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
