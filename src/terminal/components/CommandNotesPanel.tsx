import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Search, Copy, Check, Sparkles, BookOpen, AlertTriangle, Trash2, Plus, X, ChevronDown, ChevronRight, Clipboard, Loader2, Clock } from 'lucide-react';
import { getHandbookData, peekData, type HandbookSection } from '../../services/learn/handbook-data';
import type { CommandNote } from './CommandNotesStore';
export type { CommandNote };

type Tab = 'browse' | 'saved' | 'history';

const emptyTab: { tab: Tab; setTab: (t: Tab) => void } = { tab: 'browse', setTab: () => {} };

export function CommandNotesPanel({
  store,
  onOpenModal,
  activeNoteId,
  onSelectNote,
  notes,
  saving,
  savingLabel,
}: {
  store: any;
  onOpenModal: (cmd?: { command: string; section: string; sectionTitle: string }) => void;
  activeNoteId?: string;
  onSelectNote: (id: string) => void;
  notes: CommandNote[];
  saving: boolean;
  savingLabel: string;
}) {
  const [tab, setTab] = useState<Tab>('browse');
  const [q, setQ] = useState('');
  const [detailTab, setDetailTab] = useState<'what' | 'when' | 'gotcha' | 'params' | 'safety' | 'related'>('what');
  const [hbData, setHbData] = useState<HandbookSection[] | null>(null);

  useEffect(() => {
    let alive = true;
    const cached = peekData();
    if (cached) { setHbData(cached.sections); return; }
    getHandbookData().then((d) => { if (alive) setHbData(d.sections); });
    return () => { alive = false; };
  }, []);

  const data = useMemo(() => {
    const sections = hbData;
    if (!sections) return [];
    if (!q.trim()) return sections;
    const ql = q.toLowerCase();
    const out: typeof sections = [];
    for (const s of sections) {
      const cs = s.commands.filter((c) =>
        c.command.toLowerCase().includes(ql) ||
        c.description.toLowerCase().includes(ql)
      );
      if (cs.length) out.push({ ...s, commands: cs });
    }
    return out;
  }, [hbData, q]);

  const note = notes.find((n) => n.id === activeNoteId);

  return (
    <div className="hb-scope flex flex-col h-full text-[13px] overflow-x-hidden" style={{ background: 'var(--hb-bg)' }}>
      {/* tab bar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 pt-3 pb-2 border-b shrink-0" style={{ borderColor: 'var(--hb-line)' }}>
        {(['browse', 'saved', 'history'] as Tab[]).map((t) => {
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 min-w-0 shrink ${
                isActive
                  ? 'text-[var(--hb-accent)]'
                  : 'text-[var(--hb-dim)] hover:text-[var(--hb-txt)] hover:bg-[var(--hb-panel)]'
              }`}
              style={isActive ? { background: 'color-mix(in srgb, var(--hb-accent) 10%, transparent)' } : {}}
            >
              {t === 'browse' && <BookOpen size={13} style={{ color: isActive ? 'var(--hb-accent)' : 'var(--hb-dim)' }} />}
              {t === 'saved' && <Check size={13} style={{ color: isActive ? 'var(--hb-accent)' : 'var(--hb-dim)' }} />}
              {t === 'history' && <Clock size={13} style={{ color: isActive ? 'var(--hb-accent)' : 'var(--hb-dim)' }} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'saved' ? ` · ${notes.length}` : ''}
            </button>
          );
        })}
        <button
          onClick={() => onOpenModal()}
          className="ml-auto h-8 px-2.5 rounded-lg text-white text-[11.5px] font-semibold flex items-center gap-1.5 shrink-0 transition hover:opacity-90 active:scale-[0.97]"
          style={{ background: 'var(--hb-accent)' }}
        >
          <Sparkles size={13} /> Generate
        </button>
      </div>

      {/* browse */}
      {tab === 'browse' && (
        <div className="flex flex-col h-full">
          <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ borderColor: 'var(--hb-line)' }}>
            <Search size={13} style={{ color: 'var(--hb-dim)', flexShrink: 0 }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search commands…"
              className="flex-1 h-8 px-2 rounded-lg border text-[12.5px] outline-none mono"
              style={{ background: 'var(--hb-bg)', borderColor: 'var(--hb-line)', color: 'var(--hb-txt)' }}
            />
            {q && (
              <button onClick={() => setQ('')} className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ color: 'var(--hb-dim)', background: 'var(--hb-bg)' }}><X size={13} /></button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {!hbData ? (
              <div className="text-center py-10 text-[12.5px]" style={{ color: 'var(--hb-dim)' }}>Loading handbook…</div>
            ) : data.length === 0 ? (
              <div className="text-center py-10 text-[12.5px]" style={{ color: 'var(--hb-dim)' }}>No commands match “{q}”.</div>
            ) : (
              data.map((s) => (
                <div key={s.title} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2 px-2 py-2 rounded-lg" style={{ color: 'var(--hb-dim)' }}>
                    <ChevronRight size={12} className="shrink-0" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">{s.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--hb-bg)' }}>{s.commands.length}</span>
                  </div>
                  <div className="space-y-1.5 pl-4">
                    {s.commands.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onOpenModal({ command: c.command, section: s.title, sectionTitle: s.title })}
                        className="w-full text-left px-3 py-2.5 rounded-lg border text-[12.5px] transition hover:border-[var(--hb-accent)]"
                        style={{ borderColor: 'var(--hb-line)', background: 'var(--hb-bg)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color ?? 'var(--hb-dim)' }} />
                          <span className="font-semibold truncate" style={{ color: 'var(--hb-txt)' }}>{c.command}</span>
                          <span className="ml-auto shrink-0 text-[9.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ background: 'var(--hb-panel)', color: 'var(--hb-dim)' }}>{c.depth}</span>
                        </div>
                        {c.description && <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--hb-dim)' }}>{c.description}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* saved */}
      {tab === 'saved' && (
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-12 h-12 rounded-2xl grid place-items-center mb-3" style={{ background: 'var(--hb-panel)' }}><BookOpen size={22} style={{ color: 'var(--hb-dim)' }} /></div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--hb-dim)' }}>No saved notes yet</div>
              <div className="text-[11.5px] mt-1" style={{ color: 'var(--hb-dim)' }}>Generate a prompt from a command, paste the AI response, and save.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onSelectNote(n.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${activeNoteId === n.id ? 'border-[var(--hb-accent)]' : ''}`}
                  style={{ borderColor: 'var(--hb-line)', background: 'var(--hb-bg)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--hb-accent)' }} />
                    <span className="font-semibold truncate flex-1" style={{ color: 'var(--hb-txt)' }}>{n.title}</span>
                    <span className="text-[10px] mono shrink-0" style={{ color: 'var(--hb-dim)' }}>{n.command}</span>
                  </div>
                  <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--hb-dim)' }}>{n.summary}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10.5px]" style={{ color: 'var(--hb-dim)' }}>
                    <span>{n.section}</span>
                    <span>·</span>
                    <span>{new Date(n.savedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* detail */}
      {note && (
        <div className="border-t flex flex-col" style={{ borderColor: 'var(--hb-line)' }}>
          <div className="flex items-center gap-2 px-3 py-2 shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--hb-dim)' }}>{note.section}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded mono" style={{ background: 'var(--hb-panel)', color: 'var(--hb-dim)' }}>{note.command}</span>
            <div className="flex-1" />
            <span className="text-[10.5px]" style={{ color: 'var(--hb-dim)' }}>saved {new Date(note.savedAt).toLocaleString()}</span>
          </div>
          <div className="flex gap-1 px-3 py-1.5 shrink-0 border-b" style={{ borderColor: 'var(--hb-line)' }}>
            {(['what', 'when', 'gotcha', 'params', 'safety', 'related'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDetailTab(t)}
                className={`text-[10.5px] font-semibold px-2 py-0.5 rounded transition ${detailTab === t ? 'text-[var(--hb-accent)]' : 'text-[var(--hb-dim)]'}`}
              >
                {t === 'what' ? 'What' : t === 'when' ? 'When' : t === 'gotcha' ? 'Gotcha' : t === 'params' ? 'Params' : t === 'safety' ? 'Safety' : 'Related'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {detailTab === 'what' && <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--hb-txt)' }}>{note.what}</div>}
            {detailTab === 'when' && <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--hb-txt)' }}>{note.when}</div>}
            {detailTab === 'gotcha' && (
              <div className="rounded-lg p-3 border-l-2 text-[12.5px] leading-relaxed" style={{ borderColor: '#f87171', color: 'var(--hb-txt)', background: 'color-mix(in srgb, #f87171 8%, transparent)' }}>{note.gotcha}</div>
            )}
            {detailTab === 'params' && (
              <div className="space-y-1.5">
                {note.params.map((p) => (
                  <div key={p.name} className="flex gap-2 text-[12px]">
                    <span className="font-semibold shrink-0 px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--hb-accent) 15%, transparent)', color: 'var(--hb-accent)' }}>{p.name}</span>
                    <span style={{ color: 'var(--hb-txt)' }}>{p.meaning}</span>
                  </div>
                ))}
                {note.params.length === 0 && <div className="text-[11.5px]" style={{ color: 'var(--hb-dim)' }}>No parameters.</div>}
              </div>
            )}
            {detailTab === 'safety' && <div className="flex gap-2 text-[12.5px] leading-relaxed items-start"><AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} /><span style={{ color: 'var(--hb-txt)' }}>{note.safety}</span></div>}
            {detailTab === 'related' && (
              <div className="flex flex-wrap gap-1.5">
                {note.related.map((r, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded mono" style={{ background: 'var(--hb-panel)', color: 'var(--hb-dim)' }}>{r}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* history */}
      {tab === 'history' && (
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {notes.length === 0 ? (
            <div className="text-center py-10 text-[12.5px]" style={{ color: 'var(--hb-dim)' }}>No prompt history.</div>
          ) : (
            <div className="space-y-1">
              {notes.slice().reverse().map((n) => (
                <div key={n.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11.5px]" style={{ color: 'var(--hb-dim)' }}>
                  <Sparkles size={11} style={{ flexShrink: 0 }} />
                  <span className="truncate">{n.command}</span>
                  <span className="ml-auto shrink-0">{new Date(n.savedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
