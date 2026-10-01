import { useEffect, useMemo, useState } from 'react';
import { Search, Check, Sparkles, BookOpen, AlertTriangle, X, Clock, Loader2 } from 'lucide-react';
import { getHandbookData, peekData, type HandbookSection } from '../../services/learn/handbook-data';
import type { CommandNote } from './CommandNotesStore';
export type { CommandNote };

type Tab = 'browse' | 'saved' | 'history';

// The handbook legend's five tiers -> the HTML's card accent + badge colour.
const DEPTH_ACCENT: Record<string, string> = {
  core: 'acc-blu',
  daily: 'acc-grn',
  power: 'acc-pur',
  sudo: 'acc-amb',
  rescue: 'acc-red',
};
const DEPTH_HUE: Record<string, string> = {
  core: 'var(--hb-accent)',
  daily: 'var(--hb-green)',
  power: 'var(--hb-violet)',
  sudo: 'var(--hb-amber)',
  rescue: 'var(--hb-rose)',
};
const DEPTH_BADGE: Record<string, string> = {
  core: 'hb-badge-core',
  daily: 'hb-badge-daily',
  power: 'hb-badge-power',
  sudo: 'hb-badge-sudo',
  rescue: 'hb-badge-rescue',
};

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
    <div className="hb-scope relative flex flex-col h-full text-[13px] overflow-x-hidden" style={{ background: 'var(--hb-bg)' }}>
      <div className="hb-substrate-static" aria-hidden="true" />
      {/* tab bar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 pt-3 pb-2 border-b shrink-0" style={{ borderColor: 'var(--hb-line)' }}>
        {(['browse', 'saved', 'history'] as Tab[]).map((t) => {
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold transition-colors duration-150 min-w-0 shrink ${
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
              data.map((s, idx) => (
                <div key={s.title} className="mb-3 last:mb-0">
                  <div className="hb-sec-head">
                    <span className="hb-num">{s.number ?? String(idx + 1).padStart(2, '0')}</span>
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--hb-txt)' }}>{s.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded hb-badge ml-auto" style={{ background: 'var(--hb-panel)', color: 'var(--hb-dim)' }}>{s.commands.length}</span>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {s.commands.map((c) => (
                      <button
                        key={`${s.title}:${c.command}`}
                        onClick={() => onOpenModal({ command: c.command, section: s.title, sectionTitle: s.title })}
                        className={`hb-cmd-row ${DEPTH_ACCENT[c.depth] ?? ''}`}
                      >
                        <span className="hb-cmdline">
                          <span className="hb-dollar" style={{ color: c.isRoot ? 'var(--hb-amber)' : (DEPTH_HUE[c.depth] ?? 'var(--hb-accent)') }}>{c.isRoot ? '#' : '$'}</span>
                          <span className="hb-cmdname">{c.command}</span>
                          <span className={`hb-badge ${DEPTH_BADGE[c.depth] ?? ''} ml-auto shrink-0`}>{c.depth}</span>
                        </span>
                        {c.description && <span className="hb-cmddesc block">{c.description}</span>}
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
              <div className="w-12 h-12 rounded-xl grid place-items-center mb-3" style={{ background: 'var(--hb-panel)' }}><BookOpen size={22} style={{ color: 'var(--hb-dim)' }} /></div>
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
            <span className="text-[10px] px-1.5 py-0.5 rounded mono hb-badge hb-badge-daily">{note.command}</span>
            <div className="flex-1" />
            <span className="text-[10.5px] flex items-center gap-1" style={{ color: saving ? 'var(--hb-accent)' : 'var(--hb-dim)' }}>
              {saving && <Loader2 size={11} className="animate-spin" />}
              {saving ? (savingLabel || 'Saving…') : `saved ${new Date(note.savedAt).toLocaleString()}`}
            </span>
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
          <div className="hb-detail flex-1 overflow-y-auto">
            {detailTab === 'what' && (
              <div className="hb-field">
                <div className="hb-dt">what it does</div>
                <div className="hb-dv">{note.what || 'No description recorded.'}</div>
              </div>
            )}
            {detailTab === 'when' && (
              <div className="hb-field">
                <div className="hb-dt">when to use it</div>
                <div className="hb-dv">{note.when || 'No usage note recorded.'}</div>
              </div>
            )}
            {detailTab === 'gotcha' && (
              <div className="hb-field">
                <div className="hb-dt">the gotcha</div>
                <div className="hb-callout danger">
                  <div className="hb-ttl">careful</div>
                  {note.gotcha || 'No known gotcha recorded.'}
                </div>
              </div>
            )}
            {detailTab === 'params' && (
              <div className="hb-field">
                <div className="hb-dt">parameters</div>
                {note.params.length === 0 ? (
                  <div className="hb-dv">No parameters.</div>
                ) : (
                  note.params.map((p) => (
                    <div key={p.name} className="hb-param">
                      <span className="hb-param-flag">{p.name}</span>
                      <span className="hb-param-meaning">{p.meaning}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            {detailTab === 'safety' && (
              <div className="hb-field">
                <div className="hb-dt">safety</div>
                <div className="hb-callout danger">
                  <div className="hb-ttl">safety</div>
                  <div className="flex gap-2 items-start">
                    <AlertTriangle size={13} style={{ color: 'var(--hb-rose)', flexShrink: 0, marginTop: 2 }} />
                    <span>{note.safety || 'No safety note recorded.'}</span>
                  </div>
                </div>
              </div>
            )}
            {detailTab === 'related' && (
              <div className="hb-field">
                <div className="hb-dt">related</div>
                {note.related.length === 0 ? (
                  <div className="hb-dv">No related commands.</div>
                ) : (
                  <div className="hb-chips">
                    {note.related.map((r, i) => (
                      <span key={i} className="hb-chip-sm">{r}</span>
                    ))}
                  </div>
                )}
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
